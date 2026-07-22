// Dual-track sidecar recorder
//
// The live pipeline mixes microphone + system audio into a single mono stream
// for VAD/transcription and for the saved recording. That mix destroys the one
// piece of information that makes speaker attribution trivial in remote
// meetings: which physical source (mic = local user, system = everyone else)
// each sample came from.
//
// This module taps the synchronized 50ms windows produced by the pipeline's
// ring buffer BEFORE they are mixed, and writes them as a stereo WAV sidecar
// (left = microphone, right = system audio) next to the normal recording.
// Nothing else in the app changes: playback, live transcription and the main
// audio file behave exactly as before.
//
// Addresses upstream feature requests #241 (multitrack audio) and #642
// (attribute transcripts to microphone or system audio).

use std::fs::File;
use std::io::{BufWriter, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

use anyhow::Result;
use log::{error, info, warn};
use tokio::sync::mpsc;

pub const DUAL_TRACK_FILENAME: &str = "dual_track.wav";

const CHANNELS: u16 = 2;
const BITS_PER_SAMPLE: u16 = 16;

/// Incremental stereo WAV writer (L = mic, R = system audio).
/// Header is written with zero sizes up front and patched on finalize,
/// so a crash mid-recording still leaves a recoverable (if unpatched) file.
pub struct DualTrackWriter {
    writer: BufWriter<File>,
    data_bytes: u32,
    sample_rate: u32,
    path: PathBuf,
}

impl DualTrackWriter {
    pub fn new(meeting_folder: &Path, sample_rate: u32) -> Result<Self> {
        let path = meeting_folder.join(DUAL_TRACK_FILENAME);
        let file = File::create(&path)?;
        let mut writer = BufWriter::new(file);
        write_wav_header(&mut writer, sample_rate, 0)?;
        info!("🎚️ Dual-track sidecar started: {:?}", path);
        Ok(Self {
            writer,
            data_bytes: 0,
            sample_rate,
            path,
        })
    }

    /// Append one synchronized window. Windows may differ in length by a few
    /// samples on the final flush; the shorter side is zero-padded.
    pub fn append_window(&mut self, mic: &[f32], system: &[f32]) -> Result<()> {
        let frames = mic.len().max(system.len());
        let mut buf = Vec::with_capacity(frames * (CHANNELS * BITS_PER_SAMPLE / 8) as usize);
        for i in 0..frames {
            let l = mic.get(i).copied().unwrap_or(0.0).clamp(-1.0, 1.0);
            let r = system.get(i).copied().unwrap_or(0.0).clamp(-1.0, 1.0);
            buf.extend_from_slice(&((l * 32767.0) as i16).to_le_bytes());
            buf.extend_from_slice(&((r * 32767.0) as i16).to_le_bytes());
        }
        self.writer.write_all(&buf)?;
        self.data_bytes = self.data_bytes.saturating_add(buf.len() as u32);
        Ok(())
    }

    /// Flush samples and patch the RIFF/data sizes in the header.
    pub fn finalize(self) -> Result<()> {
        let DualTrackWriter {
            writer,
            data_bytes,
            sample_rate,
            path,
        } = self;
        let mut file = writer.into_inner()?;
        file.seek(SeekFrom::Start(0))?;
        let mut header = Vec::with_capacity(44);
        write_wav_header(&mut header, sample_rate, data_bytes)?;
        file.write_all(&header)?;
        file.sync_all()?;
        info!(
            "🎚️ Dual-track sidecar finalized: {:?} ({} audio bytes)",
            path, data_bytes
        );
        Ok(())
    }
}

fn write_wav_header<W: Write>(w: &mut W, sample_rate: u32, data_bytes: u32) -> Result<()> {
    let block_align = CHANNELS * BITS_PER_SAMPLE / 8;
    let byte_rate = sample_rate * block_align as u32;
    w.write_all(b"RIFF")?;
    w.write_all(&(36u32.saturating_add(data_bytes)).to_le_bytes())?;
    w.write_all(b"WAVE")?;
    w.write_all(b"fmt ")?;
    w.write_all(&16u32.to_le_bytes())?;
    w.write_all(&1u16.to_le_bytes())?; // PCM
    w.write_all(&CHANNELS.to_le_bytes())?;
    w.write_all(&sample_rate.to_le_bytes())?;
    w.write_all(&byte_rate.to_le_bytes())?;
    w.write_all(&block_align.to_le_bytes())?;
    w.write_all(&BITS_PER_SAMPLE.to_le_bytes())?;
    w.write_all(b"data")?;
    w.write_all(&data_bytes.to_le_bytes())?;
    Ok(())
}

/// Spawn the dedicated writer thread. Returns the sender the pipeline uses to
/// push (mic_window, system_window) pairs. File I/O happens entirely on this
/// thread so the audio hot path never blocks on disk. When every sender is
/// dropped (recording stopped), the thread drains the channel and finalizes
/// the WAV header on its own; no explicit join is required.
pub fn spawn_dual_track_writer(
    meeting_folder: PathBuf,
    sample_rate: u32,
) -> Option<mpsc::UnboundedSender<(Vec<f32>, Vec<f32>)>> {
    let writer = match DualTrackWriter::new(&meeting_folder, sample_rate) {
        Ok(w) => w,
        Err(e) => {
            error!("Dual-track: could not create sidecar file: {}", e);
            return None;
        }
    };

    let (tx, mut rx) = mpsc::unbounded_channel::<(Vec<f32>, Vec<f32>)>();

    let spawned = std::thread::Builder::new()
        .name("dual-track-writer".into())
        .spawn(move || {
            let mut writer = writer;
            while let Some((mic, system)) = rx.blocking_recv() {
                if let Err(e) = writer.append_window(&mic, &system) {
                    error!("Dual-track: write failed, stopping sidecar: {}", e);
                    return;
                }
            }
            if let Err(e) = writer.finalize() {
                warn!("Dual-track: finalize failed: {}", e);
            }
        });

    match spawned {
        Ok(_) => Some(tx),
        Err(e) => {
            error!("Dual-track: could not spawn writer thread: {}", e);
            None
        }
    }
}
