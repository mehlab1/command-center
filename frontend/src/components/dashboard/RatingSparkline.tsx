import { formatDate } from "@/lib/dateFormat";

interface Point {
  rating: number;
  createdAt: string;
  taskTitle: string;
}

// Single-series sparkline: thin 2px line, rounded ends, small markers,
// native <title> tooltips (works on tap for mobile, not just hover) —
// dataviz skill mark specs, scaled down for a compact dashboard card.
export function RatingSparkline({ history }: { history: Point[] }) {
  if (history.length === 0) return null;

  const width = 200;
  const height = 40;
  const pad = 6;
  const min = 1;
  const max = 5;

  const points = history.map((h, i) => {
    const x = history.length === 1 ? width / 2 : pad + (i / (history.length - 1)) * (width - pad * 2);
    const y = height - pad - ((h.rating - min) / (max - min)) * (height - pad * 2);
    return { x, y, h };
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path d={path} fill="none" stroke="var(--signal)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--signal)">
          <title>
            {p.h.taskTitle}: {p.h.rating}/5 ({formatDate(p.h.createdAt)})
          </title>
        </circle>
      ))}
    </svg>
  );
}
