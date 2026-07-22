interface SummaryCardProps {
  href: string;
  label: string;
  value: number;
  note?: string;
  alert?: boolean;
}

// The dashboard's whole redesign rests on this one component: a single
// number + a link, not a full inline panel. Tapping it is how you get to
// the detail — the dashboard itself only ever shows a handful of these.
export function SummaryCard({ href, label, value, note, alert }: SummaryCardProps) {
  return (
    <a
      href={href}
      className="rounded-md border border-line bg-paper p-3 flex flex-col gap-1 min-w-0"
    >
      <p className="text-xs text-text-muted font-heading truncate">{label.toUpperCase()}</p>
      <p className={`font-heading text-2xl ${alert ? "text-blocked" : "text-text"}`}>{value}</p>
      {note && <p className="text-xs text-text-muted truncate">{note}</p>}
    </a>
  );
}
