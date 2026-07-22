'use client';

/**
 * Settings > "Soul IA / CRM" tab: connection URL, session status,
 * login/logout. This is where the CRM base URL lives (editable for testing
 * against a non-production CRM); recording elsewhere is gated on having a
 * saved session token.
 */

import React, { useState } from 'react';
import { useCrmSession } from '@/contexts/CrmSessionContext';
import { CrmLoginModal } from '@/components/CrmLogin/CrmLoginModal';
import { DEFAULT_CRM_BASE_URL } from '@/services/crmService';

export function CrmSettings() {
  const { baseUrl, setBaseUrl, user, isAuthenticated, logout, isLoading } = useCrmSession();
  const [urlDraft, setUrlDraft] = useState(baseUrl);
  const [showLogin, setShowLogin] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Keep the draft in sync once the real value finishes loading.
  React.useEffect(() => {
    setUrlDraft(baseUrl);
  }, [baseUrl]);

  const handleSaveUrl = async () => {
    await setBaseUrl(urlDraft || DEFAULT_CRM_BASE_URL);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Soul IA / CRM</h2>
        <p className="text-sm text-gray-500 mt-1">
          Conecta esta app con el CRM de Soul IA para subir automaticamente el titulo y la
          transcripcion de cada reunion al terminar de grabar.
        </p>
      </div>

      {/* Session status */}
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-700">Sesion</div>
            {isLoading ? (
              <div className="text-sm text-gray-400 mt-0.5">Cargando...</div>
            ) : isAuthenticated ? (
              <div className="text-sm text-gray-900 mt-0.5">
                Conectado como <span className="font-semibold">{user?.name}</span>
                <span className="ml-2 inline-flex items-center rounded-full bg-[#01D6E0]/15 text-[#01A8B0] text-xs font-medium px-2 py-0.5">
                  activo
                </span>
              </div>
            ) : (
              <div className="text-sm text-gray-500 mt-0.5">No has iniciado sesion</div>
            )}
          </div>

          {isAuthenticated ? (
            <button
              onClick={() => logout()}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cerrar sesion
            </button>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="px-3 py-1.5 text-sm font-medium text-white bg-[#F17001] hover:bg-[#d86400] rounded-md transition-colors"
            >
              Iniciar sesion
            </button>
          )}
        </div>

        {!isAuthenticated && (
          <p className="text-xs text-gray-400 mt-2">
            Sin sesion no se puede grabar. Usa tus credenciales del CRM de Soul IA.
          </p>
        )}
      </div>

      {/* CRM URL */}
      <div className="rounded-lg border border-gray-200 p-4">
        <label htmlFor="crm-base-url" className="block text-sm font-medium text-gray-700 mb-1">
          URL del CRM
        </label>
        <p className="text-xs text-gray-400 mb-2">
          Por defecto apunta al CRM de produccion. Cambiala solo para pruebas contra otro entorno.
        </p>
        <div className="flex gap-2">
          <input
            id="crm-base-url"
            type="text"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#F17001] focus:border-transparent"
            placeholder={DEFAULT_CRM_BASE_URL}
          />
          <button
            onClick={handleSaveUrl}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Guardar
          </button>
        </div>
        {savedFeedback && <div className="text-xs text-[#01A8B0] mt-1">Guardado</div>}
      </div>

      <CrmLoginModal open={showLogin} onOpenChange={setShowLogin} />
    </div>
  );
}
