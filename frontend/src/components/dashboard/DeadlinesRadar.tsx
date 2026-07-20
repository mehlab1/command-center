"use client";

import { useDeadlineRadar } from "@/lib/queries";
import { DeadlineRadarItem } from "@/lib/types";

function Row({ item }: { item: DeadlineRadarItem }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-sm text-text">{item.title}</span>
      <span className="text-xs text-text-muted">
        {item.kind} · {new Date(item.deadline).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}

function Bucket({ label, color, items }: { label: string; color: string; items: DeadlineRadarItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-md border border-line bg-paper p-3">
      <p className="tag-led inline-block text-xs font-semibold mb-1" style={{ color, borderColor: color }}>
        [ {label} ]
      </p>
      <div className="divide-y divide-line">
        {items.map((item) => (
          <Row key={`${item.kind}-${item.id}`} item={item} />
        ))}
      </div>
    </div>
  );
}

export function DeadlinesRadar() {
  const { data, isLoading } = useDeadlineRadar();

  const nothingDue =
    data && data.overdue.length === 0 && data.dueWithin1h.length === 0 && data.dueWithin24h.length === 0;

  return (
    <section>
      <h2 className="font-heading text-lg text-text mb-2">Deadlines radar</h2>
      {isLoading && <p className="text-sm text-text-muted">Loading…</p>}
      {nothingDue && <p className="text-sm text-text-muted">Nothing overdue or due soon.</p>}
      <div className="flex flex-col gap-2">
        <Bucket label="OVERDUE" color="var(--blocked)" items={data?.overdue ?? []} />
        <Bucket label="DUE < 1H" color="var(--in-progress)" items={data?.dueWithin1h ?? []} />
        <Bucket label="DUE < 24H" color="var(--todo)" items={data?.dueWithin24h ?? []} />
      </div>
    </section>
  );
}
