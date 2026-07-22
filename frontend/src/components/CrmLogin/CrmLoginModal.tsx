'use client';

/**
 * Soul IA / CRM login modal.
 *
 * Shown once on startup (after the technical onboarding, when there is no
 * saved token) and reachable again anytime from Settings > Soul IA / CRM.
 * Dismissible: the user can keep using the app without a session, they just
 * won't be able to record (gated separately in RecordingControls/Sidebar).
 */

import React, { useState } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { useCrmSession } from '@/contexts/CrmSessionContext';

interface CrmLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful login (in addition to closing the dialog). */
  onSuccess?: () => void;
}

export function CrmLoginModal({ open, onOpenChange, onSuccess }: CrmLoginModalProps) {
  const { login, isLoggingIn } = useCrmSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      setPassword('');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesion');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <VisuallyHidden>
          <DialogTitle>Iniciar sesion en Soul IA</DialogTitle>
        </VisuallyHidden>
        <form onSubmit={handleSubmit} className="py-2 space-y-4">
          <div className="flex flex-col items-center gap-2 mb-2">
            <Image src="/logo.png" alt="Soul IA" width={64} height={64} />
            <h3 className="text-lg font-semibold text-gray-900">Soul IA Reuniones</h3>
            <p className="text-sm text-gray-500 text-center">
              Inicia sesion con tus credenciales del CRM para grabar y subir tus reuniones
            </p>
          </div>

          <div>
            <label htmlFor="crm-login-email" className="block text-sm font-medium text-gray-700 mb-1">
              Correo
            </label>
            <input
              id="crm-login-email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F17001] focus:border-transparent"
              placeholder="tu@correo.com"
            />
          </div>

          <div>
            <label htmlFor="crm-login-password" className="block text-sm font-medium text-gray-700 mb-1">
              Contrasena
            </label>
            <input
              id="crm-login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F17001] focus:border-transparent"
              placeholder="********"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-[#F17001] hover:bg-[#d86400] disabled:opacity-60 disabled:cursor-not-allowed rounded-md transition-colors"
            >
              {isLoggingIn ? 'Entrando...' : 'Iniciar sesion'}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Ahora no
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
