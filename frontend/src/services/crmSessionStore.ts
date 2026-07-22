/**
 * CRM Session Store
 *
 * Persists the Soul IA / CRM connection settings and session token using
 * @tauri-apps/plugin-store, the same mechanism the rest of the app already
 * uses (see analytics.json usage in useRecordingStop.ts). Kept in its own
 * store file (crm-session.json) so it never collides with other app state.
 */

import { Store } from '@tauri-apps/plugin-store';
import { DEFAULT_CRM_BASE_URL, CrmUser } from './crmService';

const STORE_FILE = 'crm-session.json';

export interface CrmSession {
  baseUrl: string;
  token: string | null;
  user: CrmUser | null;
}

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = Store.load(STORE_FILE);
  }
  return storePromise;
}

export async function loadCrmSession(): Promise<CrmSession> {
  const store = await getStore();
  const baseUrl = (await store.get<string>('baseUrl')) || DEFAULT_CRM_BASE_URL;
  const token = (await store.get<string>('token')) ?? null;
  const user = (await store.get<CrmUser>('user')) ?? null;
  return { baseUrl, token, user };
}

export async function saveCrmBaseUrl(baseUrl: string): Promise<void> {
  const store = await getStore();
  await store.set('baseUrl', baseUrl);
  await store.save();
}

export async function saveCrmAuth(token: string, user: CrmUser): Promise<void> {
  const store = await getStore();
  await store.set('token', token);
  await store.set('user', user);
  await store.save();
}

export async function clearCrmAuth(): Promise<void> {
  const store = await getStore();
  await store.delete('token');
  await store.delete('user');
  await store.save();
}
