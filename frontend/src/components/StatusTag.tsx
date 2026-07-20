// The signature element (DESIGN_TOKENS.md): a fixed-width, monospace,
// bracketed status readout — the one recurring device used everywhere status
// appears, styled as an inset "LED" panel rather than a flat color dot.
export type TagKind = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED" | "CREATE" | "EDIT" | "DELETE";

const CONFIG: Record<TagKind, { label: string; color: string }> = {
  TODO: { label: "TODO", color: "var(--todo)" },
  IN_PROGRESS: { label: "WIP", color: "var(--in-progress)" },
  DONE: { label: "DONE", color: "var(--done)" },
  BLOCKED: { label: "BLKD", color: "var(--blocked)" },
  CREATE: { label: "CREATE", color: "var(--done)" },
  EDIT: { label: "EDIT", color: "var(--in-progress)" },
  DELETE: { label: "DELETE", color: "var(--blocked)" },
};

export function StatusTag({ kind }: { kind: TagKind }) {
  const { label, color } = CONFIG[kind];
  return (
    <span
      className="tag-led inline-flex items-center rounded-sm border px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap"
      style={{
        color,
        borderColor: color,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      [ {label} ]
    </span>
  );
}
