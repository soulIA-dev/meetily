/**
 * CRM Service (Soul IA "team recorder" integration)
 *
 * Thin wrapper around the CRM's team-recorder REST contract:
 *   POST {base}/api/team-recorder/auth/login
 *   POST {base}/api/team-recorder/transcripts
 *   POST {base}/api/team-recorder/transcripts/{id}/audio
 *
 * Plain `fetch()` is used on purpose (no extra Tauri plugin): the webview's
 * CSP `connect-src` in tauri.conf.json allow-lists the production CRM domain
 * plus `http://localhost:*` for local testing against a dev CRM.
 */

import { readFile } from '@tauri-apps/plugin-fs';

export const DEFAULT_CRM_BASE_URL = 'https://crm.soulia.info';

export interface CrmUser {
  id: string;
  name: string;
}

export interface CrmLoginResponse {
  token: string;
  user: CrmUser;
}

export interface CrmUploadTranscriptPayload {
  title: string;
  transcript: string;
  durationSeconds: number;
  recordedAt: string; // ISO 8601
  engine: 'parakeet-live';
}

export interface CrmUploadTranscriptResponse {
  id: string | number;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return `HTTP ${response.status}`;
    try {
      const json = JSON.parse(text);
      return json.message || json.error || text;
    } catch {
      return text;
    }
  } catch {
    return `HTTP ${response.status}`;
  }
}

export class CrmService {
  /**
   * Logs in against the CRM with the user's existing CRM credentials.
   */
  async login(baseUrl: string, email: string, password: string): Promise<CrmLoginResponse> {
    const url = `${normalizeBaseUrl(baseUrl)}/api/team-recorder/auth/login`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    return response.json() as Promise<CrmLoginResponse>;
  }

  /**
   * Uploads the meeting title + full transcript text. Returns the CRM's
   * transcript id, needed afterwards to attach the compressed audio.
   */
  async uploadTranscript(
    baseUrl: string,
    token: string,
    payload: CrmUploadTranscriptPayload
  ): Promise<CrmUploadTranscriptResponse> {
    const url = `${normalizeBaseUrl(baseUrl)}/api/team-recorder/transcripts`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    return response.json() as Promise<CrmUploadTranscriptResponse>;
  }

  /**
   * Uploads the compressed (.m4a) dual-track audio for an already-created
   * CRM transcript. Reads the file from disk via the fs plugin and sends it
   * as multipart/form-data (field name "audio").
   */
  async uploadAudio(
    baseUrl: string,
    token: string,
    transcriptId: string | number,
    audioFilePath: string
  ): Promise<void> {
    const bytes = await readFile(audioFilePath);
    // Copy into a plain ArrayBuffer-backed Uint8Array so Blob doesn't choke
    // on the SharedArrayBuffer-lookalike type Tauri sometimes returns.
    const fileName = audioFilePath.split(/[\\/]/).pop() || 'dual_track.m4a';
    const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/mp4' });

    const formData = new FormData();
    formData.append('audio', blob, fileName);

    const url = `${normalizeBaseUrl(baseUrl)}/api/team-recorder/transcripts/${transcriptId}/audio`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        // Do NOT set Content-Type manually: fetch must generate the
        // multipart boundary itself.
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
  }
}

export const crmService = new CrmService();
