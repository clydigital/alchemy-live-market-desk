import type { MacroSeriesObservation } from "@/lib/data";
import type { OverviewEconomicRelease } from "./EconomicReleaseReminder";
import styles from "./macro-trend-monitor.module.css";

type Props = {
  observations: MacroSeriesObservation[];
  release: OverviewEconomicRelease | null;
  limit?: number;
};

type Measure = {
  key: "mom_change" | "yoy_change" | "value";
  label: string;
  suffix: string;
};

type Point = {
  date: string;
  value: number;
  preliminary: boolean;
};

type Card = {
  series: MacroSeriesObservation;
  measure: Measure;
  points: Point[];
  priority: number;
};

const MEASURE_ORDER: Record<Measure["key"], number> = { mom_change: 0, yoy_change: 1, value: 2 };

function numeric(value: unknown) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function monthLabel(value: string) {
  try {
    return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
      timeZone: "UTC",
      month: "short",
      year: "2-digit",
    }).toUpperCase();
  } catch {
    return value;
  }
}

function displayName(series: MacroSeriesObservation) {
  const known: Record<string, string> = {
    cpi_all: "Headline CPI",
    cpi_core: "Core CPI",
    ppi_final_demand: "PPI Final Demand",
    nfp: "Nonfarm Payrolls",
    nonfarm_payrolls: "Nonfarm Payrolls",
    unemployment_rate: "Unemployment Rate",
    average_hourly_earnings: "Average Hourly Earnings",
    initial_claims: "Initial Jobless Claims",
    jobless_claims: "Initial Jobless Claims",
    jolts: "JOLTS Job Openings",
    jolts_job_openings: "JOLTS Job Openings",
    ism_manufacturing: "ISM Manufacturing PMI",
    ism_new_orders: "ISM New Orders",
    ism_services: "ISM Services PMI",
    retail_sales: "Retail Sales",
    retail_sales_control: "Retail Sales Control Group",
    core_pce: "Core PCE",
    pce_core: "Core PCE",
    gdp_real: "Real GDP",
  };
  return known[series.series_key] || series.series_name || series.series_key.replaceAll("_", " ");
}

function focusKeys(release: OverviewEconomicRelease | null) {
  const text = `${release?.event || ""}`.toLowerCase();
  if (/consumer price|\bcpi\b/.test(text)) return ["cpi_all", "cpi_core", "cpi"];
  if (/producer price|\bppi\b/.test(text)) return ["ppi_final_demand", "ppi"];
  if (/personal consumption|\bpce\b/.test(text)) return ["core_pce", "pce_core", "pce_all", "pce"];
  if (/nonfarm|payroll|employment situation/.test(text)) return ["nfp", "nonfarm_payrolls", "unemployment_rate", "average_hourly_earnings"];
  if (/unemployment/.test(text)) return ["unemployment_rate", "nfp", "nonfarm_payrolls"];
  if (/jobless claims/.test(text)) return ["initial_claims", "jobless_claims", "continuing_claims"];
  if (/jolts/.test(text)) return ["jolts", "jolts_job_openings"];
  if (/\bism\b|\bpmi\b|manufactur/.test(text)) return ["ism_manufacturing", "ism_new_orders", "ism_services", "pmi"];
  if (/retail sales/.test(text)) return ["retail_sales", "retail_sales_control"];
  if (/\bgdp\b|gross domestic/.test(text)) return ["gdp_real", "gdp"];
  if (/fomc|rate decision|monetary policy|federal reserve|central bank/.test(text)) return ["cpi_all", "cpi_core", "nfp", "unemployment_rate", "core_pce"];
  return [];
}

function measures(rows: MacroSeriesObservation[]): Measure[] {
  const output: Measure[] = [];
  if (rows.some((row) => numeric(row.mom_change) != null)) output.push({ key: "mom_change", label: "MONTH-ON-MONTH", suffix: "%" });
  if (rows.some((row) => numeric(row.yoy_change) != null)) output.push({ key: "yoy_change", label: "YEAR-ON-YEAR", suffix: "%" });
  if (!output.length) output.push({ key: "value", label: "REPORTED LEVEL", suffix: "" });
  return output;
}

function buildCards(observations: MacroSeriesObservation[], release: OverviewEconomicRelease | null, limit: number) {
  const keys = focusKeys(release);
  const preferred = new Set(keys);
  const focused = keys.length
    ? observations.filter((row) => {
      const key = String(row.series_key || row.series_id || "").toLowerCase();
      return preferred.has(key) || keys.some((focus) => key.startsWith(`${focus}_`));
    })
    : [];
  const source = keys.length ? focused : observations;
  const groups = new Map<string, MacroSeriesObservation[]>();

  for (const row of source) {
    const key = row.series_key || row.series_id;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(row);
  }

  const cards: Card[] = [];
  for (const rows of groups.values()) {
    rows.sort((a, b) => Date.parse(a.observation_date) - Date.parse(b.observation_date));
    const series = rows.at(-1) || rows[0];
    for (const measure of measures(rows)) {
      const points = rows
        .map((row) => ({ date: row.observation_date, value: numeric(row[measure.key]), preliminary: Boolean(row.is_preliminary) }))
        .filter((point): point is Point => point.value != null)
        .slice(-12);
      if (points.length < 2) continue;
      const focusIndex = keys.indexOf(series.series_key);
      const priority = focusIndex >= 0 ? 100 - focusIndex * 8 : 20;
      cards.push({ series, measure, points, priority: priority + (measure.key === "mom_change" ? 2 : 0) });
    }
  }

  return cards
    .sort((a, b) => MEASURE_ORDER[a.measure.key] - MEASURE_ORDER[b.measure.key] || b.priority - a.priority || displayName(a.series).localeCompare(displayName(b.series)))
    .slice(0, limit);
}

function formatValue(value: number | undefined, suffix: string) {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value as number);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return `${(value as number).toFixed(digits)}${suffix}`;
}

function Sparkline({ points }: { points: Point[] }) {
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 280;
  const height = 92;
  const pad = 7;
  const coords = points.map((point, index) => ({
    x: pad + (points.length === 1 ? (width - pad * 2) / 2 : index * (width - pad * 2) / (points.length - 1)),
    y: pad + (height - pad * 2) - ((point.value - min) / range) * (height - pad * 2),
  }));
  const path = coords.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const last = coords.at(-1);

  return (
    <svg className={styles.sparkline} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Last 12 verified readings">
      <line x1="7" y1="46" x2="273" y2="46" />
      <path d={path} />
      {last ? <circle cx={last.x} cy={last.y} r="3.5" /> : null}
    </svg>
  );
}

export default function MacroTrendMonitor({ observations, release, limit = 6 }: Props) {
  const cards = buildCards(observations || [], release, limit);
  if (!cards.length) return null;
  const sections = Array.from(new Set(cards.map((card) => card.measure.key)))
    .sort((a, b) => MEASURE_ORDER[a] - MEASURE_ORDER[b])
    .map((measureKey) => ({ measureKey, cards: cards.filter((card) => card.measure.key === measureKey) }));

  return (
    <section className={styles.monitor} aria-label="Economic trend charts">
      <header className={styles.header}>
        <div>
          <span>Trend charts</span>
          <h2>{release ? `The last 12 readings behind ${release.event}` : "Recent macro trends"}</h2>
          <p>{release
            ? "One release, grouped by measure. Headline and core series stay together, with a simple divider between month-on-month, year-on-year and reported levels."
            : "Verified macro history grouped by measure, with simple dividers between sections."}</p>
        </div>
      </header>

      <div className={styles.grouped}>
        {sections.map((section) => (
          <section className={styles.measureSection} key={section.measureKey}>
            <div className={styles.measureLabel}>{section.cards[0]?.measure.label}</div>
            <div className={styles.grid}>
              {section.cards.map((card) => {
                const latest = card.points.at(-1);
                const previous = card.points.at(-2);
                return (
                  <article className={styles.card} key={`${card.series.series_key}-${card.measure.key}`}>
                    <div className={styles.cardHead}>
                      <div>
                        <span>{displayName(card.series)}</span>
                        <small>{card.measure.suffix || card.series.unit || "LEVEL"} · LAST {card.points.length} READINGS</small>
                      </div>
                      {latest?.preliminary ? <b>PRELIM</b> : null}
                    </div>
                    <Sparkline points={card.points} />
                    <div className={styles.values}>
                      <div><span>Latest</span><strong>{formatValue(latest?.value, card.measure.suffix)}</strong><small>{latest ? monthLabel(latest.date) : "—"}</small></div>
                      <div><span>Previous</span><strong>{formatValue(previous?.value, card.measure.suffix)}</strong><small>{previous ? monthLabel(previous.date) : "—"}</small></div>
                    </div>
                    <footer>{card.series.agency || "OFFICIAL SERIES"} · {card.series.frequency || "FREQUENCY N/A"}</footer>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
