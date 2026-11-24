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
      <div className={s.healthReadout} data-absorption-meter="sourced-account-health">
        <div className={s.healthLabels}><span>Current X Wire coverage · completed checks</span>
          <strong>{health.freshCompleted} / {health.monitored} monitored sources</strong></div>
        <div className={s.healthTrack} role="meter" aria-label="Complete fresh source checks"
          aria-valuemin={0} aria-valuemax={Math.max(1,health.monitored)}
          aria-valuenow={Math.min(health.freshCompleted,Math.max(1,health.monitored))}
          aria-valuetext={`${health.freshCompleted} of ${health.monitored} monitored sources have complete fresh checks`}>
          <span style={{width: `${Math.min(100,Math.max(0,Math.round(100*health.freshCompleted/Math.max(1,health.monitored))))}%`}}/>
        </div>
        <small>{Math.max(0,health.monitored-health.freshCompleted)} sources need a recent complete check. Historical gaps are tracked separately. Aggregate coverage is not proof that every post or claim is independently verified.</small>
      </div>
      <div className={s.metrics}>
        <div><strong>{health.posts24h.toLocaleString("en-GB")}</strong><span>X posts retrieved · 24h</span></div>
        <div><strong>{health.handedToResearch48h.toLocaleString("en-GB")}</strong><span>X leads handed to research · 48h</span></div>
        <div><strong>{health.completedRuns7d}</strong><span>Completed morning/evening research runs · 7d</span></div>
        <div><strong>{Math.max(0,health.monitored-health.freshCompleted)}</strong><span>Incomplete recent checks</span></div>
        <div><strong>{health.historicalGaps}</strong><span>Historical coverage gaps</span></div>
      </div>
      <p className={s.note}>
        {health.failedRuns7d} failed/blocked research run(s) in 7d. {health.publishedUpdates7d} canonical Story updates recorded by scheduled runs in 7d; agent-led research and recap use are not measured by this figure.
        {health.lastSourceAttemptAt?<> Last X source attempt: <time dateTime={health.lastSourceAttemptAt}>{new Date(health.lastSourceAttemptAt).toLocaleString("en-GB",{timeZone:"Asia/Kuala_Lumpur",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})} MYT</time>.</>:null}
        {health.lastResearchRun?<> Last successful research run: <time dateTime={health.lastResearchRun}>{new Date(health.lastResearchRun).toLocaleString("en-GB",{timeZone:"Asia/Kuala_Lumpur",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})} MYT</time>.</>:null}
      </p>
    </>}
  </section>;
}
