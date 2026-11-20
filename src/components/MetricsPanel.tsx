import { useState } from 'react';
import { ArrowUp, Star } from 'lucide-react';
import {
  currencies,
  metrics,
  periods,
  profiles,
  profileSettings,
  type MetricId,
  type MetricSettings,
} from '../../shared/metrics';
import type { BusinessReport, Stats, Totals } from '../lib/api';
import { Field, Panel } from './PortalUI';

const metricIds = Object.keys(metrics) as MetricId[];
const isTraffic = (id: MetricId) => metrics[id][1] === 'traffic';
export function MetricEditor({
  value,
  change,
  locked,
}: {
  value: MetricSettings;
  change: (v: MetricSettings) => void;
  locked?: boolean;
}) {
  const update = (patch: Partial<MetricSettings>) =>
    change({ ...value, ...patch });
  const select = (id: MetricId) => {
    if (!value.selected.includes(id)) {
      update({ selected: [...value.selected, id] });
      return;
    }
    const targets = { ...value.targets };
    delete targets[id];
    update({
      selected: value.selected.filter((v) => v !== id),
      primary: value.primary === id ? null : value.primary,
      ready: value.ready.filter((v) => v !== id),
      targets,
    });
  };
  const move = (i: number) => {
    const selected = [...value.selected];
    [selected[i - 1], selected[i]] = [selected[i], selected[i - 1]];
    update({ selected });
  };
  return (
    <div className="stack">
      <div className="form-grid">
        <Field
          label="Profilul site-ului"
          hint="Schimbarea profilului înlocuiește selecția și țintele."
        >
          <select
            value={value.profile}
            onChange={(e) =>
              change(profileSettings(e.target.value, value.currency))
            }
          >
            {Object.entries(profiles).map(([id, profile]) => (
              <option key={id} value={id}>
                {profile.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Monedă"
          hint={
            locked
              ? 'Blocată după prima comandă raportată.'
              : 'Ținta pentru venituri se introduce în unități minore (bani, cenți).'
          }
        >
          <select
            value={value.currency}
            disabled={locked}
            onChange={(e) =>
              update({ currency: e.target.value as MetricSettings['currency'] })
            }
          >
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <details>
        <summary>Catalog de indicatori</summary>
        <div className="metric-checks">
          {metricIds.map((id) => (
            <label className="check" key={id}>
              <input
                type="checkbox"
                checked={value.selected.includes(id)}
                onChange={() => select(id)}
              />
              {metrics[id][0]}
            </label>
          ))}
        </div>
      </details>
      <div className="metric-settings">
        {value.selected.map((id, i) => (
          <div className="metric-row" key={id}>
            <div className="metric-title">
              <button
                type="button"
                className="icon-button"
                disabled={i === 0}
                aria-label={`Mută mai sus: ${metrics[id][0]}`}
                onClick={() => move(i)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-pressed={value.primary === id}
                aria-label={`Indicator principal: ${metrics[id][0]}`}
                onClick={() =>
                  update({ primary: value.primary === id ? null : id })
                }
              >
                <Star
                  size={17}
                  fill={value.primary === id ? 'currentColor' : 'none'}
                />
              </button>
              <span>{metrics[id][0]}</span>
            </div>
            <Field label="Țintă lunară">
              <input
                aria-label={`Țintă lunară: ${metrics[id][0]}`}
                inputMode="decimal"
                type="number"
                min={id === 'bounce_rate' ? 0.01 : 1}
                max={id === 'bounce_rate' ? 100 : 1e12}
                step={id === 'bounce_rate' ? 'any' : 1}
                value={value.targets[id] ?? ''}
                onChange={(e) => {
                  const targets = { ...value.targets };
                  if (e.target.value) targets[id] = Number(e.target.value);
                  else delete targets[id];
                  update({ targets });
                }}
              />
            </Field>
            {!isTraffic(id) && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={value.ready.includes(id)}
                  onChange={(e) =>
                    update({
                      ready: e.target.checked
                        ? [...value.ready, id]
                        : value.ready.filter((v) => v !== id),
                    })
                  }
                />
                Integrare pregătită
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
const labels = {
  analytics_engine: 'Analytics Engine',
  rollup: 'rollup zilnic',
  mixed: 'Analytics Engine + rollup zilnic',
};
const fmt = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 });
const bigFmt = new Intl.NumberFormat('ro-RO');
const money = (amount: number | string, currency: string) => {
  const cents = BigInt(amount),
    decimal =
      new Intl.NumberFormat('ro-RO')
        .formatToParts(1.1)
        .find((p) => p.type === 'decimal')?.value || ',';
  return `${bigFmt.format(cents / 100n)}${decimal}${String(cents % 100n).padStart(2, '0')} ${currency}`;
};
const display = (
  id: MetricId,
  value: number | string | null,
  currency: string,
) =>
  value === null
    ? '—'
    : id === 'revenue'
      ? money(value, currency)
      : id === 'bounce_rate'
        ? `${fmt.format(Number(value))}%`
        : fmt.format(Number(value));
const trafficValue = (total: Totals, id: MetricId) =>
  id === 'bounce_rate'
    ? total.sessions
      ? (100 * total.bounces) / total.sessions
      : 0
    : total[id as 'visitors' | 'sessions' | 'pageviews'];
export function Period({
  days,
  change,
}: {
  days: number;
  change: (d: number) => void;
}) {
  return (
    <Field label="Perioadă (UTC)">
      <select value={days} onChange={(e) => change(Number(e.target.value))}>
        {periods.map((d) => (
          <option key={d} value={d}>
            {d} zile
          </option>
        ))}
      </select>
    </Field>
  );
}
function Goal({
  id,
  current,
  target,
  currency,
}: {
  id: MetricId;
  current: number | string | null | undefined;
  target: number | undefined;
  currency: string;
}) {
  if (!target) return null;
  const pct =
    current == null
      ? 0
      : id === 'bounce_rate'
        ? Number(current) <= target
          ? 100
          : (target / Number(current)) * 100
        : Math.min(100, (100 * Number(current)) / target);
  return (
    <div className="goal">
      <span>
        Obiectiv lunar: {current == null ? '—' : display(id, current, currency)}{' '}
        / {id === 'bounce_rate' ? '≤ ' : ''}
        {display(id, target, currency)}
      </span>
      <progress
        value={pct}
        max={100}
        aria-label={`Progres obiectiv ${metrics[id][0]}`}
      />
    </div>
  );
}
function TrafficChart({
  stats,
  selected,
  currency,
}: {
  stats: Stats;
  selected: MetricId[];
  currency: string;
}) {
  const [chosen, setChosen] = useState<MetricId | undefined>();
  if (!selected.length || !stats.days.length) return null;
  const metric = chosen && selected.includes(chosen) ? chosen : selected[0];
  const numbers = stats.days.map((d) => trafficValue(d, metric)),
    high = Math.max(1, ...numbers),
    end = stats.days.at(-1)!;
  const coordinates = numbers
    .map(
      (n, i) =>
        `${(i / Math.max(numbers.length - 1, 1)) * 640},${155 - (n / high) * 145}`,
    )
    .join(' ');
  return (
    <Panel title="Evoluție zilnică">
      <div className="chart-meta">
        <Field label="Indicator">
          <select
            value={metric}
            onChange={(e) => setChosen(e.target.value as MetricId)}
          >
            {selected.map((id) => (
              <option value={id} key={id}>
                {metrics[id][0]}
              </option>
            ))}
          </select>
        </Field>
        <span className="muted">
          Scală: 0 – {display(metric, high, currency)}
        </span>
      </div>
      <svg
        className="chart"
        viewBox="0 0 640 164"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Evoluție: ${metrics[metric][0]}`}
      >
        <path d="M0 10H640 M0 82H640 M0 155H640" className="chart-grid" />
        <polyline
          points={coordinates}
          fill="none"
          stroke="var(--brand-primary)"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="chart-meta muted">
        <span>{stats.days[0].day}</span>
        <span>{end.day}</span>
      </div>
    </Panel>
  );
}
export function MetricsPanel({
  stats,
  report,
}: {
  stats: Stats;
  report: BusinessReport;
}) {
  const { settings } = report,
    { selected, currency, targets, primary } = settings;
  const traffic = selected.filter(isTraffic);
  return (
    <div className="stack report">
      {traffic.length > 0 && (
        <>
          <section>
            <div className="section-heading">
              <h2>Traficul site-ului</h2>
              <span className="muted">Sursă: {labels[stats.source]}</span>
            </div>
            <div className="card-grid">
              {traffic.map((id) => (
                <article key={id} className="stat-card">
                  <p>
                    {metrics[id][0]}{' '}
                    {primary === id && (
                      <Star size={14} aria-label="Principal" />
                    )}
                  </p>
                  <strong>
                    {display(id, trafficValue(stats.totals, id), currency)}
                  </strong>
                  <small className="muted">
                    Anterior:{' '}
                    {display(id, trafficValue(stats.previous, id), currency)}
                  </small>
                  <Goal
                    id={id}
                    current={report.trafficMonthly[id]}
                    target={targets[id]}
                    currency={currency}
                  />
                </article>
              ))}
            </div>
            {traffic.includes('visitors') && stats.liveVisitors !== null && (
              <p className="muted">
                Vizitatori în ultimele 5 minute:{' '}
                {fmt.format(stats.liveVisitors)}
              </p>
            )}
          </section>
          <TrafficChart stats={stats} selected={traffic} currency={currency} />
          {traffic.includes('pageviews') && (
            <Panel title="Top pagini">
              {stats.topPages.length ? (
                <ul className="ranked">
                  {stats.topPages.map((row) => (
                    <li key={row.path}>
                      <span>{row.path}</span>
                      <strong>{fmt.format(row.views)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Nu există pagini în perioada selectată.</p>
              )}
            </Panel>
          )}
        </>
      )}
      {report.values.length > 0 && (
        <section>
          <div className="section-heading">
            <h2>Rezultatele afacerii</h2>
            <span className="muted">Evenimente raportate de site</span>
          </div>
          <div className="card-grid">
            {report.values.map((entry) => (
              <article
                key={entry.id}
                className={`stat-card ${entry.id === primary ? 'featured' : ''}`}
              >
                <p>
                  {metrics[entry.id][0]}{' '}
                  {entry.id === primary && (
                    <Star size={15} aria-label="Principal" />
                  )}
                </p>
                <strong>{display(entry.id, entry.value, currency)}</strong>
                <small className="muted">
                  {entry.state === 'received'
                    ? 'Date primite'
                    : entry.state === 'ready'
                      ? 'Configurată, fără date'
                      : 'Necesită integrare'}
                </small>
                {entry.last_event !== null && (
                  <small className="muted">
                    Ultimul eveniment:{' '}
                    {new Date(entry.last_event).toLocaleString('ro-RO', {
                      timeZone: 'UTC',
                    })}{' '}
                    UTC
                  </small>
                )}
                <Goal
                  id={entry.id}
                  current={entry.monthly}
                  target={targets[entry.id]}
                  currency={currency}
                />
              </article>
            ))}
          </div>
        </section>
      )}
      {selected.length === 0 && (
        <p className="notice">
          Nu sunt selectați indicatori pentru acest site.
        </p>
      )}
    </div>
  );
}
