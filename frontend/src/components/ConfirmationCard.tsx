interface ConfirmationCardProps {
  summary: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Deliberately not a chat bubble — a distinct card with an accent border and
// explicit buttons, so a pending write can never be mistaken for something
// already said or already done (docs/07-frontend-design-system.md).
export function ConfirmationCard({ summary, busy, onConfirm, onCancel }: ConfirmationCardProps) {
  return (
    <div className="rounded-lg border-2 border-accent bg-surface-raised p-4 flex flex-col gap-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Confirm</p>
        <p className="text-base text-ink mt-1">{summary}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          disabled={busy}
          className="flex-1 rounded-sm border border-border py-2 text-sm font-medium text-ink disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="flex-1 rounded-sm bg-accent text-accent-contrast py-2 text-sm font-medium disabled:opacity-60"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
