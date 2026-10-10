import Link from "next/link";
import type { CaseType } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { businessOverview, OUTCOME_FILTERS, TREATMENT_LABEL, type Filters, type OutcomeFilter } from "@/lib/analytics";
import { earliestDate, parseView, PERIOD_VIEWS, resolvePeriod, type PeriodView } from "@/lib/periods";
import { getIvDrips } from "@/lib/settings";
import { clinicDateString } from "@/lib/time";
import { BarList, Change, ColumnChart, OutcomeBar, StatTile } from "@/components/OverviewCharts";

export const metadata = { title: "Business overview" };

type Search = { view?: string; date?: string; type?: string; drip?: string; staff?: string; outcome?: string };

const VIEW_LABEL: Record<PeriodView, string> = { day: "Day", week: "Week", month: "Month" };

function minutes(m: number | null) {
  if (m === null) return "None yet";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireUser(["ADMIN"]);
  const q = await searchParams;
  const view = parseView(q.view);
  const period = resolvePeriod(view, q.date);
  const filters: Filters = {
    type: q.type && q.type in TREATMENT_LABEL ? (q.type as CaseType) : undefined,
    drip: q.drip || undefined,
    staff: q.staff || undefined,
    outcome: q.outcome && q.outcome in OUTCOME_FILTERS ? (q.outcome as OutcomeFilter) : undefined,
  };
  if (filters.drip && filters.type && filters.type !== "IV_DRIP") filters.drip = undefined;
  const [data, configuredDrips] = await Promise.all([businessOverview(period, filters), getIvDrips()]);

  const drips = [...new Set([...configuredDrips, ...data.drips])].sort((a, b) => a.localeCompare(b));
  const filtered = Boolean(filters.type || filters.drip || filters.staff || filters.outcome);
  const href = (changes: Partial<Search>) => {
    const params = new URLSearchParams();
    const merged = { view, date: period.from, type: filters.type, drip: filters.drip, staff: filters.staff, outcome: filters.outcome, ...changes };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return `/overview?${params}`;
  };
  const today = clinicDateString();
  const { totals, doctor, clients, appointments } = data;
  const seen = totals.checkIns - totals.cancelled;
  const prevLabel = period.previous.label;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="muted">Business overview</p>
          <h1 className="page-title">{period.label}</h1>
        </div>
        <nav aria-label="Period" className="flex flex-wrap items-center gap-3">
          <div className="flex" role="group" aria-label="Show by">
            {PERIOD_VIEWS.map((v, i) => (
              <Link
                key={v}
                href={href({ view: v })}
                aria-current={v === view ? "page" : undefined}
                className={`btn ${v === view ? "btn-primary" : "btn-secondary"} ${i > 0 ? "-ml-[2px]" : ""}`}
              >
                {VIEW_LABEL[v]}
              </Link>
            ))}
          </div>
          <div className="flex gap-2">
            {period.prev ? (
              <Link href={href({ date: period.prev })} className="btn btn-secondary" aria-label={`Previous ${view}`}>
                <span aria-hidden="true">←</span> Earlier
              </Link>
            ) : (
              <span className="btn btn-secondary cursor-not-allowed opacity-50" aria-disabled="true" title="The overview goes back three months">
                <span aria-hidden="true">←</span> Earlier
              </span>
            )}
            {period.next ? (
              <Link href={href({ date: period.next })} className="btn btn-secondary" aria-label={`Next ${view}`}>
                Later <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <span className="btn btn-secondary cursor-not-allowed opacity-50" aria-disabled="true">
                Later <span aria-hidden="true">→</span>
              </span>
            )}
            {period.to < today && (
              <Link href={href({ date: today })} className="btn btn-secondary">
                {view === "day" ? "Today" : view === "week" ? "This week" : "This month"}
              </Link>
            )}
          </div>
        </nav>
      </div>

      <form method="get" action="/overview" className="card">
        <h2 className="section-title mb-4">Filter</h2>
        <input type="hidden" name="view" value={view} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="field" htmlFor="date">
            <span className="label">Go to date</span>
            <input id="date" name="date" type="date" className="input" defaultValue={period.from} min={earliestDate(today)} max={today} />
          </label>
          <label className="field" htmlFor="type">
            <span className="label">Treatment</span>
            <select id="type" name="type" className="input" defaultValue={filters.type ?? ""}>
              <option value="">All treatments</option>
              {(Object.keys(TREATMENT_LABEL) as CaseType[]).map((t) => (
                <option key={t} value={t}>{TREATMENT_LABEL[t]}</option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor="drip">
            <span className="label">IV drip</span>
            <select id="drip" name="drip" className="input" defaultValue={filters.drip ?? ""}>
              <option value="">All drips</option>
              {drips.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor="staff">
            <span className="label">Staff member</span>
            <select id="staff" name="staff" className="input" defaultValue={filters.staff ?? ""}>
              <option value="">Everyone</option>
              {data.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role}{s.active ? "" : ", left"})
                </option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor="outcome">
            <span className="label">Outcome</span>
            <select id="outcome" name="outcome" className="input" defaultValue={filters.outcome ?? ""}>
              <option value="">Any outcome</option>
              {(Object.keys(OUTCOME_FILTERS) as OutcomeFilter[]).map((o) => (
                <option key={o} value={o}>{OUTCOME_FILTERS[o]}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="submit" className="btn btn-primary">Show</button>
          {filtered && (
            <Link href={`/overview?view=${view}&date=${period.from}`} className="btn btn-secondary">Clear filters</Link>
          )}
        </div>
      </form>

      <section aria-labelledby="totals-heading">
        <h2 id="totals-heading" className="sr-only">Totals</h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Clients checked in" value={totals.checkIns} detail={<Change now={totals.checkIns} before={totals.prevCheckIns} label={prevLabel} />} />
          <StatTile label="Treatments completed" value={totals.completed} detail={<Change now={totals.completed} before={totals.prevCompleted} label={prevLabel} />} />
          <StatTile
            label="Not treated, referred"
            value={totals.notTreated}
            detail={seen > 0 ? `${Math.round((totals.notTreated / seen) * 100)}% of clients seen` : undefined}
          />
          <StatTile label="Typical visit length" value={minutes(totals.medianVisitMinutes)} detail="Check-in to case closed (median)" />
        </dl>
      </section>

      <section className="card" aria-labelledby="trend-heading">
        <h2 id="trend-heading" className="section-title mb-4">{view === "day" ? "Check-ins by hour" : "Check-ins by day"}</h2>
        <ColumnChart bars={data.timeline} unit="check-ins" caption={`Clients checked in ${view === "day" ? "each hour" : "each day"}, ${period.label}`} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card" aria-labelledby="outcome-heading">
          <h2 id="outcome-heading" className="section-title mb-4">How visits ended</h2>
          <OutcomeBar
            parts={[
              { label: "Completed", value: totals.completed, className: "bg-success" },
              { label: "Not treated, referred", value: totals.notTreated, className: "bg-danger" },
              { label: "Still open", value: totals.open, className: "bg-warning" },
              { label: "Left the waiting list", value: totals.cancelled, className: "bg-field" },
            ]}
          />
        </section>

        <section className="card" aria-labelledby="clients-heading">
          <h2 id="clients-heading" className="section-title mb-4">Clients</h2>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="muted">New clients</dt>
              <dd className="text-3xl font-bold">{clients.new}</dd>
              <dd className="text-sm muted">First ever visit</dd>
            </div>
            <div>
              <dt className="muted">Returning clients</dt>
              <dd className="text-3xl font-bold">{clients.returning}</dd>
              <dd className="text-sm muted">Visited before</dd>
            </div>
          </dl>
          {clients.unlinked > 0 && (
            <p className="mt-3 text-sm muted">
              {clients.unlinked} {clients.unlinked === 1 ? "visit has" : "visits have"} no client record yet (still in the waiting list, or left before their details were taken).
            </p>
          )}
        </section>

        <section className="card" aria-labelledby="treatment-heading">
          <h2 id="treatment-heading" className="section-title mb-4">Visits by treatment</h2>
          <BarList bars={data.byTreatment} />
        </section>

        <section className="card" aria-labelledby="drip-heading">
          <h2 id="drip-heading" className="section-title mb-4">IV drips given</h2>
          <BarList bars={data.byDrip} empty="No IV drips in this period." />
        </section>

        <section className="card" aria-labelledby="doctor-heading">
          <h2 id="doctor-heading" className="section-title mb-4">Doctor approvals (IV drips)</h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Asked", value: doctor.asked },
              { label: "Said YES", value: doctor.yes },
              { label: "Said NO", value: doctor.no },
              { label: "No reply yet", value: doctor.waiting },
            ].map((s) => (
              <div key={s.label}>
                <dt className="muted">{s.label}</dt>
                <dd className="text-3xl font-bold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-4 space-y-1">
            <li>Typical time for the doctor to reply: <strong>{minutes(doctor.medianReplyMinutes)}</strong></li>
            <li>Referred because vitals were out of range: <strong>{doctor.vitalsReferrals}</strong></li>
            <li>Referred because the doctor said no: <strong>{doctor.declinedReferrals}</strong></li>
          </ul>
        </section>

        <section className="card" aria-labelledby="appts-heading">
          <h2 id="appts-heading" className="section-title mb-4">Booked appointments</h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Booked", value: appointments.total },
              { label: "Attended", value: appointments.completed },
              { label: "No-shows", value: appointments.noShow },
              { label: "Cancelled", value: appointments.cancelled },
            ].map((s) => (
              <div key={s.label}>
                <dt className="muted">{s.label}</dt>
                <dd className="text-3xl font-bold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
          {(filters.type || filters.drip || filters.outcome) && (
            <p className="mt-3 text-sm muted">Appointments are only filtered by staff member.</p>
          )}
        </section>

        <section className="card" aria-labelledby="hours-heading">
          <h2 id="hours-heading" className="section-title mb-4">Busiest times of day</h2>
          <BarList bars={data.busiestHours} />
        </section>

        {view !== "day" && (
          <section className="card" aria-labelledby="weekday-heading">
            <h2 id="weekday-heading" className="section-title mb-4">Busiest days of the week</h2>
            <BarList bars={data.weekdays} />
          </section>
        )}
      </div>

      <section className="card overflow-x-auto" aria-labelledby="staff-heading">
        <h2 id="staff-heading" className="section-title mb-2">Staff workload</h2>
        {data.staffWorkload.length === 0 ? (
          <p className="muted">No treatments handled in this period.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Staff member</th>
                <th scope="col" className="text-right">Clients seen</th>
                <th scope="col" className="text-right">Completed</th>
                <th scope="col" className="text-right">IV approvals given</th>
              </tr>
            </thead>
            <tbody>
              {data.staffWorkload.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={href({ staff: s.id })}>{s.name}</Link>
                    <span className="block text-sm muted">{s.role}</span>
                  </td>
                  <td className="text-right tabular-nums">{s.treated}</td>
                  <td className="text-right tabular-nums">{s.completed}</td>
                  <td className="text-right tabular-nums">{s.approvals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-sm muted">Practitioners take IV drip clients through; doctors close injection and laser visits and approve IV drips.</p>
      </section>
    </div>
  );
}
