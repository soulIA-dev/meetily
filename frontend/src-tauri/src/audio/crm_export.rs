// CRM export helpers.
//
// The team-recorder pipeline (Soul IA Reuniones -> CRM) uploads the plain-text
// transcript right away and queues the heavier dual-track WAV for later
// speaker-separated reprocessing. Before it is queued, the WAV is compressed
// to a stereo AAC (.m4a) using the ffmpeg binary the app already bundles
// (see `ffmpeg.rs::find_ffmpeg_path`). The original .wav is never touched.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use log::{debug, error, info};

use super::dual_track::DUAL_TRACK_FILENAME;
use super::ffmpeg::find_ffmpeg_path;

/// Filename of the compressed sidecar produced next to `dual_track.wav`.
pub const CRM_AUDIO_EXPORT_FILENAME: &str = "dual_track.m4a";

/// Compresses the `dual_track.wav` of a meeting folder into a stereo AAC
/// (.m4a, 128k) sidecar ready to upload to the CRM. Returns the absolute
/// path of the generated file. The source .wav is left untouched.
#[tauri::command]
pub async fn crm_compress_meeting_audio(meeting_folder: String) -> Result<String, String> {
    let folder = PathBuf::from(&meeting_folder);
    let input_path = folder.join(DUAL_TRACK_FILENAME);
    let output_path = folder.join(CRM_AUDIO_EXPORT_FILENAME);

    if !input_path.exists() {
        return Err(format!(
            "dual_track.wav not found in meeting folder: {:?}",
            input_path
        ));
    }

    info!(
        "🎧 Compressing {:?} -> {:?} for CRM upload",
        input_path, output_path
    );

    // Blocking ffmpeg call: run it on a blocking thread so we do not stall
    // the async runtime while it encodes.
    let input_for_thread = input_path.clone();
    let output_for_thread = output_path.clone();
    let compress_result = tokio::task::spawn_blocking(move || {
        run_ffmpeg_compress(&input_for_thread, &output_for_thread)
    })
    .await
    .map_err(|e| format!("Compression task join error: {}", e))?;

    compress_result?;

    Ok(output_path.to_string_lossy().to_string())
}

fn run_ffmpeg_compress(input_path: &Path, output_path: &Path) -> Result<(), String> {
    let ffmpeg_path = find_ffmpeg_path()
        .ok_or_else(|| "FFmpeg not found. Cannot compress meeting audio.".to_string())?;

    debug!("Using FFmpeg at: {:?}", ffmpeg_path);

    let mut command = Command::new(ffmpeg_path);
    command
        .args([
            "-y", // overwrite if a previous compression attempt was interrupted
            "-i",
            input_path.to_str().ok_or("Invalid input path encoding")?,
            "-ac",
            "2", // force stereo (L=mic, R=system)
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            output_path.to_str().ok_or("Invalid output path encoding")?,
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    debug!("FFmpeg compress command: {:?}", command);

    let output = command
        .output()
        .map_err(|e| format!("Failed to spawn FFmpeg process: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("FFmpeg compression failed: {}", stderr);
        return Err(format!(
            "FFmpeg compression failed with status {}: {}",
            output.status, stderr
        ));
    }

    info!("✅ CRM audio export ready: {:?}", output_path);
    Ok(())
}
