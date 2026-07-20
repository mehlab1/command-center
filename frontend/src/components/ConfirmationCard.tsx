interface ConfirmationCardProps {
  summary: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Deliberately not a chat bubble — a distinct card with a signal-amber border
// and explicit tactile buttons, so a pending write can never be mistaken for
// something already said or already done (docs/07-frontend-design-system.md).
export function ConfirmationCard({ summary, busy, onConfirm, onCancel }: ConfirmationCardProps) {
  return (
    <div className="rounded-lg border-2 border-signal bg-paper p-4 flex flex-col gap-3">
      <div>
        <p className="tag-led inline-block text-xs font-semibold text-signal">[ CONFIRM ]</p>
        <p className="text-base text-text mt-1.5">{summary}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          disabled={busy}
          className="btn-tactile flex-1 rounded-sm border border-line bg-ink py-2 text-sm font-medium text-text disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="btn-tactile btn-tactile-signal flex-1 rounded-sm bg-signal text-signal-contrast py-2 text-sm font-semibold disabled:opacity-60"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
