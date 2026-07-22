'use client';

/**
 * CRM Session Context
 *
 * Tracks whether the current user is logged into the Soul IA CRM
 * (team-recorder auth), which CRM base URL to use, and exposes
 * login/logout. Recording is gated on `isAuthenticated` elsewhere
 * (RecordingControls, Sidebar).
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { crmService, CrmUser, DEFAULT_CRM_BASE_URL } from '@/services/crmService';
import { loadCrmSession, saveCrmAuth, saveCrmBaseUrl, clearCrmAuth } from '@/services/crmSessionStore';

interface CrmSessionContextType {
  baseUrl: string;
  setBaseUrl: (url: string) => Promise<void>;
  token: string | null;
  user: CrmUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginError: string | null;
  isLoggingIn: boolean;
}

const CrmSessionContext = createContext<CrmSessionContextType | undefined>(undefined);

export function CrmSessionProvider({ children }: { children: ReactNode }) {
  const [baseUrl, setBaseUrlState] = useState<string>(DEFAULT_CRM_BASE_URL);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<CrmUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCrmSession()
      .then((session) => {
        if (cancelled) return;
        setBaseUrlState(session.baseUrl);
        setToken(session.token);
        setUser(session.user);
      })
      .catch((error) => {
        console.error('[CrmSessionContext] Failed to load CRM session:', error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setBaseUrl = useCallback(async (url: string) => {
    const trimmed = url.trim() || DEFAULT_CRM_BASE_URL;
    setBaseUrlState(trimmed);
    await saveCrmBaseUrl(trimmed);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoggingIn(true);
      setLoginError(null);
      try {
        const result = await crmService.login(baseUrl, email, password);
        await saveCrmAuth(result.token, result.user);
        setToken(result.token);
        setUser(result.user);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo iniciar sesion';
        setLoginError(message);
        throw error;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [baseUrl]
  );

  const logout = useCallback(async () => {
    await clearCrmAuth();
    setToken(null);
    setUser(null);
  }, []);

  const value: CrmSessionContextType = useMemo(
    () => ({
      baseUrl,
      setBaseUrl,
      token,
      user,
      isAuthenticated: !!token,
      isLoading,
      login,
      logout,
      loginError,
      isLoggingIn,
    }),
    [baseUrl, setBaseUrl, token, user, isLoading, login, logout, loginError, isLoggingIn]
  );

  return <CrmSessionContext.Provider value={value}>{children}</CrmSessionContext.Provider>;
}

export function useCrmSession() {
  const context = useContext(CrmSessionContext);
  if (context === undefined) {
    throw new Error('useCrmSession must be used within a CrmSessionProvider');
  }
  return context;
}
