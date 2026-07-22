'use client';

/**
 * Meeting Name Dialog Context
 *
 * Exposes `promptMeetingName(defaultTitle)`, an imperative "ask the user to
 * confirm/edit the meeting title" call usable from plain async code (the
 * useRecordingStop hook), backed by a Dialog rendered once near the app root.
 * Resolves with the (possibly edited) title, or the default title if the
 * user just confirms without changing anything.
 */

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';

interface MeetingNameDialogContextType {
  promptMeetingName: (defaultTitle: string) => Promise<string>;
}

const MeetingNameDialogContext = createContext<MeetingNameDialogContextType | undefined>(undefined);

export function MeetingNameDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const resolveRef = useRef<((value: string) => void) | null>(null);

  const promptMeetingName = useCallback((defaultTitle: string): Promise<string> => {
    return new Promise((resolve) => {
      setTitle(defaultTitle);
      resolveRef.current = resolve;
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const finalTitle = title.trim() || 'Reunion sin titulo';
    setIsOpen(false);
    resolveRef.current?.(finalTitle);
    resolveRef.current = null;
  }, [title]);

  return (
    <MeetingNameDialogContext.Provider value={{ promptMeetingName }}>
      {children}
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleConfirm(); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogTitle>Nombre de la reunion</DialogTitle>
          <div className="py-2">
            <label htmlFor="meeting-name-input" className="block text-sm font-medium text-gray-700 mb-2">
              Con este nombre se archiva en el CRM
            </label>
            <input
              id="meeting-name-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F17001] focus:border-transparent"
              autoFocus
            />
          </div>
          <DialogFooter>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-[#F17001] hover:bg-[#d86400] rounded-md transition-colors"
            >
              Guardar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MeetingNameDialogContext.Provider>
  );
}

export function useMeetingNameDialog() {
  const context = useContext(MeetingNameDialogContext);
  if (context === undefined) {
    throw new Error('useMeetingNameDialog must be used within a MeetingNameDialogProvider');
  }
  return context;
}
