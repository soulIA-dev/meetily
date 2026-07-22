/**
 * Kicks off the "send this meeting to the CRM" flow right after a meeting is
 * saved to SQLite: compress the dual-track sidecar to .m4a (best effort),
 * queue the transcript + audio upload, and make one immediate attempt.
 * Failures just leave the job queued for the retry loop
 * (CrmUploadQueueProvider: startup + every 10 minutes).
 */

import { invoke } from '@tauri-apps/api/core';
import { Transcript } from '@/types';
import { enqueueMeetingUpload, processCrmUploadQueue } from '@/services/crmUploadQueue';

interface TriggerCrmMeetingUploadParams {
  meetingId: string;
  title: string;
  transcripts: Transcript[];
  folderPath: string | null;
  baseUrl: string;
  token: string | null;
}

function computeDurationSeconds(transcripts: Transcript[]): number {
  if (transcripts.length === 0) return 0;
  const last = transcripts[transcripts.length - 1];
  return last.audio_end_time || last.audio_start_time || 0;
}

/**
 * Builds the plain-text transcript from the in-memory transcript buffer
 * (transcriptsRef.current at save time): it is the exact, already
 * chronologically-ordered source that gets persisted to SQLite via
 * `api_save_transcript`, so re-reading the DB afterwards would just be a
 * slower way to get the same data.
 */
function buildTranscriptText(transcripts: Transcript[]): string {
  return transcripts.map((t) => t.text).join('\n');
}

export async function triggerCrmMeetingUpload(params: TriggerCrmMeetingUploadParams): Promise<void> {
  if (!params.token) {
    console.log('[crmMeetingUpload] No CRM session, skipping upload for meeting', params.meetingId);
    return;
  }

  const transcriptText = buildTranscriptText(params.transcripts);
  const durationSeconds = computeDurationSeconds(params.transcripts);
  // Approximate: transcript timestamps aren't threaded through to this hook,
  // so recordedAt is derived from "now minus duration". Good enough for the
  // CRM's meeting list; flagged in the handoff notes as a decision to revisit
  // if exact recording-start time is ever needed.
  const recordedAt = new Date(Date.now() - durationSeconds * 1000).toISOString();

  let audioFilePath: string | null = null;
  if (params.folderPath) {
    try {
      audioFilePath = await invoke<string>('crm_compress_meeting_audio', {
        meetingFolder: params.folderPath,
      });
    } catch (error) {
      console.warn('[crmMeetingUpload] Failed to compress dual-track audio for CRM upload:', error);
    }
  }

  await enqueueMeetingUpload({
    meetingId: params.meetingId,
    title: params.title,
    transcript: transcriptText,
    durationSeconds,
    recordedAt,
    audioFilePath,
  });

  await processCrmUploadQueue(params.baseUrl, params.token);
}
