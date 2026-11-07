import Link from "next/link";
import type {BluebellyAbsorptionHealth} from "@/lib/bluebelly-absorption-health";
import s from "./AbsorptionHealth.module.css";

export default function AbsorptionHealth({health}:{health:BluebellyAbsorptionHealth|null}){
  return <section className={s.panel} aria-label="Bluebelly ingestion and research health" data-bluebelly-absorption-health="aggregate">
    <header className={s.head}>
      <div><p className={s.kicker}>INFORMATION PIPELINE · OBSERVED STATUS</p><h2>Is Bluebelly absorbing new information?</h2></div>
      <Link href="/owner/x-wire">Owner X Wire details</Link>
    </header>
    {!health?<p className={s.missing}>Live intake metrics are unavailable. No green status is inferred.</p>:
    <>
      <div className={s.metrics}>
        <div><strong>{health.healthy}/{health.monitored}</strong><span>X sources with complete recent checks</span></div>
        <div><strong>{health.posts24h.toLocaleString("en-GB")}</strong><span>X posts retrieved · 24h</span></div>
        <div><strong>{health.handedToResearch48h.toLocaleString("en-GB")}</strong><span>X leads entered research intake · 48h</span></div>
        <div><strong>{health.completedRuns7d}</strong><span>Completed morning/evening research runs · 7d</span></div>
        <div><strong>{health.publishedUpdates7d}</strong><span>Story updates recorded by those runs · 7d</span></div>
      </div>
      <p className={s.note}>
        {health.historicalGaps} source(s) retain historical gaps; {health.failedRuns7d} failed/blocked research run(s) in 7d.
        Ingestion acceptance is not independent claim verification. Zero Story updates may be legitimate and is not proof that research was unused.
        {health.lastResearchRun?<> Last successful research run: <time dateTime={health.lastResearchRun}>{new Date(health.lastResearchRun).toLocaleString("en-GB",{timeZone:"Asia/Kuala_Lumpur",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})} MYT</time>.</>:null}
      </p>
    </>}
  </section>;
}
