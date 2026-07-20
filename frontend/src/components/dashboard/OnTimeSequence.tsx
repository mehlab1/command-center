interface Point {
  onTime: boolean;
  createdAt: string;
  taskTitle: string;
}

// A sequence of status dots (green = on time, red = late), oldest to newest —
// each dot IS a real status, not a decorative gradient, so it satisfies
// "color is never the only signal" via its <title> rather than needing a
// separate legend for a two-state series.
export function OnTimeSequence({ history }: { history: Point[] }) {
  if (history.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {history.map((h, i) => (
        <span
          key={i}
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: h.onTime ? "var(--done)" : "var(--blocked)" }}
          title={`${h.taskTitle}: ${h.onTime ? "on time" : "missed deadline"} (${new Date(h.createdAt).toLocaleDateString()})`}
        />
      ))}
    </div>
  );
}
