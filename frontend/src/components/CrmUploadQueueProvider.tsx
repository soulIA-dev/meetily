'use client';

/**
 * Runs the CRM upload queue retry loop: once on startup and every 10 minutes
 * afterwards, per the "retry on start + every 10 min" requirement. Renders
 * nothing; mount once near the root, inside CrmSessionProvider.
 */

import { useEffect, useRef } from 'react';
import { useCrmSession } from '@/contexts/CrmSessionContext';
import { processCrmUploadQueue, getCrmUploadRetryIntervalMs } from '@/services/crmUploadQueue';

export function CrmUploadQueueProvider() {
  const { baseUrl, token, isLoading } = useCrmSession();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isLoading || !token) return;

    // Retry immediately on startup / whenever we (re)gain a session.
    processCrmUploadQueue(baseUrl, token).catch((error) => {
      console.error('[CrmUploadQueueProvider] Startup queue processing failed:', error);
    });

    intervalRef.current = setInterval(() => {
      processCrmUploadQueue(baseUrl, token).catch((error) => {
        console.error('[CrmUploadQueueProvider] Scheduled queue processing failed:', error);
      });
    }, getCrmUploadRetryIntervalMs());

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [baseUrl, token, isLoading]);

  return null;
}
