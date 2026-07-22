"use client";

import { ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// Shared shell for every manual create/edit form — bottom sheet on mobile
// (matches the app's mobile-first design), same visual language as
// ConfirmationCard/VaultSecretWidget (signal-bordered, bracket-tag header).
export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-lg sm:rounded-lg border-2 border-signal bg-paper p-4 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="tag-led inline-block text-xs font-semibold text-signal">[ {title.toUpperCase()} ]</p>
          <button onClick={onClose} className="text-xs text-text-muted font-heading" aria-label="Close">
            CLOSE
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
