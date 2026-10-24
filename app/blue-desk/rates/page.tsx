import Link from "next/link";
import { headers } from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import PublicGovernmentRateTrendChart from "@/components/blue-desk/PublicGovernmentRateTrendChart";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { publicMarketObservations, publicGovernmentRateTrends } from "@/lib/blue-desk-public-markets";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import desk from "../blue-desk.module.css";
import ui from "../public-insight.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "US Rates and Yield Curve | Bluebelly",
  description: "Source-dated Treasury yields and original-source rate trends.",
};
const IDS = ["us2y","us5y-fred","us10y-fred","us20y-fred","us30y-fred"];

export default async function Rates() {
  const host = (await headers()).get("host");
  const monitor = await getMarketMonitor().catch(() => null);
  const rows = publicMarketObservations(monitor?.rows || [], "rates");
  const tenors = IDS.map(id => rows.find(row => row.id === id)).filter(
    (row): row is NonNullable<typeof row> => Boolean(row),
  );
  const byId = new Map(tenors.map(row => [row.id,row]));
  const two = byId.get("us2y"), ten = byId.get("us10y-fred");
  // Different source observation dates cannot prove an exact same-session spread.
  const spread = two?.last != null && ten?.last != null && two.asOf &&
    two.asOf === ten.asOf ? (ten.last - two.last)*100 : null;
  const trend = publicGovernmentRateTrends(monitor?.rows || []);
  return <main className={desk.page} data-bluebelly-expanded="rates">
    <BlueDeskHeader activePath="/rates" />
    <div className={desk.content}>
      <header className={ui.intro}><div>
        <p className={desk.kicker}>RATES / DATED OBSERVATIONS</p>
        <h1>US Treasury rates</h1>
        <p>Compare the 2Y, 5Y, 10Y, 20Y and 30Y with their actual source dates.
          Yields alone cannot distinguish Fed repricing, inflation compensation
          and term premium. No intraday CPI reaction is inferred.</p>
      </div><Link href={blueDeskPublicHref("/blue-desk",host)}>← Market overview</Link></header>
      <section className={ui.section} aria-label="Curve summary">
        <div className={ui.three}>
          <article className={ui.card}><p className={ui.eyebrow}>2Y–10Y spread</p>
            <strong className={ui.big}>{spread===null ? "Unavailable" :
              (spread>=0?"+":"")+spread.toFixed(1)+" bp"}</strong>
            <p>{spread===null?"Awaiting matched observation dates":two?.asOf}</p></article>
          <article className={ui.card}><p className={ui.eyebrow}>Published tenor coverage</p>
            <strong className={ui.big}>{tenors.length}/5</strong><p>Source-admitted daily data</p></article>
          <article className={ui.card}><p className={ui.eyebrow}>Measurement basis</p>
            <strong className={ui.big}>Daily</strong><p>Not event-window ticks</p></article>
        </div>
      </section>
      <section className={ui.section} aria-labelledby="tenor-title">
        <h2 id="tenor-title">Treasury curve observations</h2>
        {tenors.length ? <div className={ui.grid}>{tenors.map(row =>
          <article className={ui.card} key={row.id}>
            <p className={ui.eyebrow}>{row.label}</p>
            <strong className={ui.big}>{row.last===null?"Unavailable":row.last.toFixed(3)+"%"}</strong>
            <p>{row.change===null ? "Prior-session change unavailable" :
              (row.change>=0?"+":"")+row.change.toFixed(1)+" bp versus prior observation"}</p>
            <small><DualTimestamp value={row.asOf} sourceDate={row.asOf}/></small>
            {row.sourceUrl ? <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">{row.sourceName} ↗</a> : null}
          </article>)}</div> : <div className={ui.empty}>Official-origin Treasury observations are currently unavailable.</div>}
      </section>
      {monitor ? <PublicGovernmentRateTrendChart series={trend} nowIso={monitor.updatedAt}/> : null}
      <section className={ui.section}>
        <h2>Where the signal meets other markets</h2>
        <p>Check whether a short-end move or long-end repricing accompanied DXY,
          gold and equities, using matched observation windows before asserting causality.</p>
        <div className={ui.tabs}>
          <Link href={blueDeskPublicHref("/blue-desk/markets?group=rates",host)}>Full market monitor →</Link>
          <Link href={blueDeskPublicHref("/blue-desk/what-changed",host)}>Recent catalysts →</Link>
        </div>
      </section>
    </div>
  </main>;
}
