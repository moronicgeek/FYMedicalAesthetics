// Small server-rendered charts for the admin overview. One series each, in
// the charcoal brand colour; every value is also shown as text or in a table
// so nothing depends on reading a bar's length.

export type Bar = { key: string; label: string; short?: string; value: number };

export function StatTile({ label, value, detail }: { label: string; value: string | number; detail?: React.ReactNode }) {
  return (
    <div className="card">
      <dt className="muted">{label}</dt>
      <dd className="text-4xl font-bold text-brand-dark">{value}</dd>
      {detail && <dd className="mt-1 text-sm muted">{detail}</dd>}
    </div>
  );
}

// "▲ 3 more than the week before (12)", or "Level with ..." when unchanged.
export function Change({ now, before, label }: { now: number; before: number; label: string }) {
  const diff = now - before;
  if (diff === 0) return <>Level with {label} ({before})</>;
  return (
    <>
      <span className="font-bold text-ink">
        <span aria-hidden="true">{diff > 0 ? "▲" : "▼"} </span>
        {Math.abs(diff)} {diff > 0 ? "more" : "fewer"}
      </span>{" "}
      than {label} ({before})
    </>
  );
}

export function BarList({ bars, total, empty = "Nothing in this period." }: { bars: Bar[]; total?: number; empty?: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const sum = total ?? bars.reduce((n, b) => n + b.value, 0);
  if (bars.every((b) => b.value === 0)) return <p className="muted">{empty}</p>;
  return (
    <ul className="space-y-3">
      {bars.map((b) => (
        <li key={b.key} title={`${b.label}: ${b.value}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span>{b.label}</span>
            <span className="font-bold tabular-nums">
              {b.value}
              {sum > 0 && <span className="ml-2 text-sm font-normal muted">{Math.round((b.value / sum) * 100)}%</span>}
            </span>
          </div>
          <div className="mt-1 h-3 w-full bg-brand-soft" aria-hidden="true">
            <div className="h-3 rounded-r-[4px] bg-brand" style={{ width: `${(b.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ColumnChart({ bars, caption, unit }: { bars: Bar[]; caption: string; unit: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max];
  const dense = bars.length > 14;
  return (
    <figure>
      <div className="flex gap-2">
        <div className="relative h-48 w-6 shrink-0 text-right text-xs muted" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `calc(${(t / max) * 100}% - 0.5rem)` }}>
              {t}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative flex h-48 items-end gap-[2px] border-b-2 border-line" aria-hidden="true">
            {ticks.slice(1).map((t) => (
              <div key={t} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${(t / max) * 100}%` }} />
            ))}
            {bars.map((b) => (
              <div key={b.key} className="group relative flex h-full flex-1 items-end justify-center">
                <div className="w-full max-w-10 rounded-t-[4px] bg-brand group-hover:bg-brand-dark" style={{ height: `${(b.value / max) * 100}%`, minHeight: b.value ? 2 : 0 }} />
                <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-[4px] bg-brand-dark px-2 py-1 text-sm text-white group-hover:block">
                  {b.label}: <strong>{b.value}</strong> {unit}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-[2px] pt-1 text-xs muted" aria-hidden="true">
            {bars.map((b, i) => (
              <span key={b.key} className="flex-1 text-center">
                {!dense || i % 2 === 0 ? b.short ?? b.label : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-bold underline underline-offset-4">Show as a table</summary>
        <table className="table mt-2">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col" className="text-right">{unit[0].toUpperCase() + unit.slice(1)}</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((b) => (
              <tr key={b.key}>
                <td>{b.label}</td>
                <td className="text-right tabular-nums">{b.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

// One stacked bar showing how the visits ended, with a labelled legend.
export function OutcomeBar({ parts }: { parts: { label: string; value: number; className: string }[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  if (total === 0) return <p className="muted">No visits in this period.</p>;
  return (
    <div>
      <div className="flex h-6 w-full gap-[2px] overflow-hidden rounded-[4px]" aria-hidden="true">
        {parts.filter((p) => p.value > 0).map((p) => (
          <div key={p.label} className={p.className} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${p.value}`} />
        ))}
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className={`inline-block h-4 w-4 shrink-0 rounded-[2px] ${p.className}`} aria-hidden="true" />
            <span>
              {p.label}: <strong className="tabular-nums">{p.value}</strong>
              <span className="text-sm muted"> ({Math.round((p.value / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
