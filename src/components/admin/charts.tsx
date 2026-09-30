/** Hand-made SVG/CSS charts for Results (no chart library, per the performance budget). */
import { cx } from "@/components/ui";

export interface BarSeries {
  id: string;
  label: string;
  /** Tailwind fill class for bars + legend swatch, e.g. "fill-zinc-400". */
  fillClass: string;
  swatchClass: string;
  /** count per score (index = score). */
  counts: number[];
}

/** Grouped vertical bar chart: x = score 0..maxX, one bar per series per score. */
export function GroupedBarChart({ series, maxX, xLabel = "Score", yLabel = "Students" }: { series: BarSeries[]; maxX: number; xLabel?: string; yLabel?: string }) {
  const W = 720;
  const H = 260;
  const pad = { l: 40, r: 12, t: 12, b: 40 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const buckets = Math.max(1, maxX + 1);
  const maxY = Math.max(1, ...series.flatMap((s) => s.counts));
  const niceMax = maxY <= 5 ? maxY : Math.ceil(maxY / 5) * 5;
  const ticks = Array.from(new Set([0, Math.round(niceMax / 2), niceMax]));
  const band = innerW / buckets;
  const groupW = band * 0.8;
  const barW = groupW / Math.max(1, series.length);
  const labelEvery = buckets > 30 ? 5 : buckets > 15 ? 2 : 1;
  const y = (v: number) => pad.t + innerH - (v / niceMax) * innerH;

  const summary = series
    .map((s) => `${s.label}: ${s.counts.map((c, i) => (c ? `${c} at ${i}` : null)).filter(Boolean).join(", ") || "no data"}`)
    .join(". ");

  return (
    <figure>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted">
        {series.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5">
            <span className={cx("size-2.5 rounded-sm", s.swatchClass)} aria-hidden="true" />
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Score distribution. ${summary}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="stroke-zinc-200" strokeDasharray={t === 0 ? undefined : "3 4"} />
            <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-zinc-400 text-[11px]">
              {t}
            </text>
          </g>
        ))}
        {Array.from({ length: buckets }, (_, score) => {
          const gx = pad.l + score * band + (band - groupW) / 2;
          return (
            <g key={score}>
              {series.map((s, si) => {
                const c = s.counts[score] ?? 0;
                const h = (c / niceMax) * innerH;
                return (
                  <rect key={s.id} x={gx + si * barW} y={pad.t + innerH - h} width={Math.max(1, barW - 1.5)} height={h} rx={Math.min(3, barW / 3)} className={s.fillClass}>
                    <title>{`${s.label} · score ${score}: ${c} student${c === 1 ? "" : "s"}`}</title>
                  </rect>
                );
              })}
              {score % labelEvery === 0 && (
                <text x={pad.l + score * band + band / 2} y={H - pad.b + 16} textAnchor="middle" className="fill-zinc-500 text-[11px]">
                  {score}
                </text>
              )}
            </g>
          );
        })}
        <text x={pad.l + innerW / 2} y={H - 6} textAnchor="middle" className="fill-zinc-400 text-[11px]">
          {xLabel}
        </text>
        <text x={12} y={pad.t + innerH / 2} textAnchor="middle" transform={`rotate(-90 12 ${pad.t + innerH / 2})`} className="fill-zinc-400 text-[11px]">
          {yLabel}
        </text>
      </svg>
    </figure>
  );
}

/** Horizontal percentage bars (item analysis). Bars under `warnBelow` % turn red. */
export function PercentBars({ items, warnBelow = 60 }: { items: { key: string | number; label: string; title?: string; percent: number; n: number }[]; warnBelow?: number }) {
  return (
    <ul className="space-y-2.5">
      {items.map((it) => {
        const pct = Math.max(0, Math.min(100, it.percent));
        const warn = pct < warnBelow;
        return (
          <li key={it.key} className="grid grid-cols-[3rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm" title={it.title}>
            <span className="font-semibold text-muted">{it.label}</span>
            <span
              className="h-3 overflow-hidden rounded-full bg-zinc-100"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pct)}
              aria-label={`${it.label}: ${Math.round(pct)}% correct (n = ${it.n})${it.title ? ` — ${it.title}` : ""}`}
            >
              <span className={cx("block h-full rounded-full", warn ? "bg-danger" : "bg-tests")} style={{ width: `${pct}%` }} />
            </span>
            <span className={cx("text-right font-semibold tabular-nums", warn && "text-danger")}>{Math.round(pct)}%</span>
          </li>
        );
      })}
    </ul>
  );
}
