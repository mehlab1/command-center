"use client";

import { usePerformance } from "@/lib/queries";
import { RatingSparkline } from "./RatingSparkline";
import { OnTimeSequence } from "./OnTimeSequence";

export function PerformancePanel() {
  const { data: devs, isLoading } = usePerformance();
  const rated = devs?.filter((d) => d.history.length > 0) ?? [];

  return (
    <section>
      <h2 className="font-heading text-lg text-text mb-2">Performance</h2>
      {isLoading && <p className="text-sm text-text-muted">Loading…</p>}
      {devs && rated.length === 0 && (
        <p className="text-sm text-text-muted">No rated tasks yet — ratings show up here once you rate completed work.</p>
      )}
      <div className="flex flex-col gap-2">
        {rated.map((d) => (
          <div key={d.devId} className="rounded-md border border-line bg-paper p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-text">{d.devName}</p>
              <p className="font-heading text-lg text-signal">{d.avgRating?.toFixed(1)}</p>
            </div>
            <RatingSparkline history={d.history} />
            <div className="flex items-center justify-between gap-2 mt-1">
              <OnTimeSequence history={d.history} />
              <p className="text-xs text-text-muted">{Math.round(d.onTimePercent ?? 0)}% on time</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
