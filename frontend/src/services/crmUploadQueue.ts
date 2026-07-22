/**
 * CRM Upload Queue
 *
 * Persists pending "upload this meeting to the CRM" jobs (transcript text +
 * later the compressed dual-track audio) so a failed upload (no network,
 * CRM down) is retried instead of lost. Processed on app startup and every
 * 10 minutes by CrmUploadQueueProvider, and immediately after a meeting is
 * enqueued.
 */

import { Store } from '@tauri-apps/plugin-store';
import { crmService } from './crmService';

const STORE_FILE = 'crm-upload-queue.json';
const JOBS_KEY = 'jobs';
const RETRY_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes, per spec

export interface CrmUploadJob {
  id: string;
  meetingId: string;
  title: string;
  transcript: string;
  durationSeconds: number;
  recordedAt: string; // ISO 8601
  /** Path to the compressed .m4a on disk, once available. */
  audioFilePath: string | null;
  remoteTranscriptId: string | number | null;
  transcriptUploaded: boolean;
  audioUploaded: boolean;
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = Store.load(STORE_FILE);
  }
  return storePromise;
}

async function readJobs(): Promise<CrmUploadJob[]> {
  const store = await getStore();
  return (await store.get<CrmUploadJob[]>(JOBS_KEY)) || [];
}

async function writeJobs(jobs: CrmUploadJob[]): Promise<void> {
  const store = await getStore();
  await store.set(JOBS_KEY, jobs);
  await store.save();
}

function newJobId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Queues a meeting for CRM upload (transcript now, audio path can be added
 * later via `attachAudioPath` once ffmpeg compression finishes).
 */
export async function enqueueMeetingUpload(input: {
  meetingId: string;
  title: string;
  transcript: string;
  durationSeconds: number;
  recordedAt: string;
  audioFilePath: string | null;
}): Promise<CrmUploadJob> {
  const jobs = await readJobs();

  const job: CrmUploadJob = {
    id: newJobId(),
    meetingId: input.meetingId,
    title: input.title,
    transcript: input.transcript,
    durationSeconds: input.durationSeconds,
    recordedAt: input.recordedAt,
    audioFilePath: input.audioFilePath,
    remoteTranscriptId: null,
    transcriptUploaded: false,
    audioUploaded: false,
    attempts: 0,
    lastError: null,
    createdAt: new Date().toISOString(),
  };

  jobs.push(job);
  await writeJobs(jobs);
  return job;
}

/**
 * Attaches (or replaces) the compressed audio path of an already-queued job,
 * e.g. once ffmpeg finishes compressing after the transcript step already ran.
 */
export async function attachAudioPathToJob(jobId: string, audioFilePath: string): Promise<void> {
  const jobs = await readJobs();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return;
  job.audioFilePath = audioFilePath;
  job.audioUploaded = false;
  await writeJobs(jobs);
}

let isProcessing = false;

/**
 * Walks every pending job and tries to finish it (transcript upload, then
 * audio upload). Safe to call repeatedly/concurrently: re-entrant calls are
 * ignored while a run is already in progress.
 */
export async function processCrmUploadQueue(baseUrl: string, token: string | null): Promise<void> {
  if (!token) return; // nothing we can do without a session
  if (isProcessing) return;
  isProcessing = true;

  try {
    let jobs = await readJobs();
    if (jobs.length === 0) return;

    for (const job of jobs) {
      if (job.transcriptUploaded && (job.audioUploaded || !job.audioFilePath)) {
        continue; // fully done (or nothing left to upload)
      }

      try {
        if (!job.transcriptUploaded) {
          const result = await crmService.uploadTranscript(baseUrl, token, {
            title: job.title,
            transcript: job.transcript,
            durationSeconds: job.durationSeconds,
            recordedAt: job.recordedAt,
            engine: 'parakeet-live',
          });
          job.remoteTranscriptId = result.id;
          job.transcriptUploaded = true;
          job.lastError = null;
        }

        if (job.transcriptUploaded && job.audioFilePath && !job.audioUploaded && job.remoteTranscriptId != null) {
          await crmService.uploadAudio(baseUrl, token, job.remoteTranscriptId, job.audioFilePath);
          job.audioUploaded = true;
          job.lastError = null;
        }
      } catch (error) {
        job.attempts += 1;
        job.lastError = error instanceof Error ? error.message : String(error);
        console.warn(`[crmUploadQueue] Job ${job.id} failed (attempt ${job.attempts}):`, job.lastError);
      }
    }

    // Drop fully-completed jobs, persist the rest (with updated progress/errors).
    jobs = jobs.filter((job) => !(job.transcriptUploaded && (job.audioUploaded || !job.audioFilePath)));
    await writeJobs(jobs);
  } finally {
    isProcessing = false;
  }
}

export function getCrmUploadRetryIntervalMs(): number {
  return RETRY_INTERVAL_MS;
}

export async function getPendingCrmUploadCount(): Promise<number> {
  const jobs = await readJobs();
  return jobs.length;
}
