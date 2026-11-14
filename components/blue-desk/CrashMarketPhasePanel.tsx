import type {CrashMarketPhase,MarketPhaseAsset,MarketPhaseState} from "@/lib/bluebelly-crash-market-phase";
import s from "./CrashMarketPhasePanel.module.css";

const PHASE_LABEL:Record<MarketPhaseState,string>={
 UNMEASURED:"INSUFFICIENT PRICE HISTORY",
 NEAR_HIGH:"NEAR SIX-MONTH HIGH",
 PULLBACK:"PULLBACK · BELOW 10%",
 SELLOFF:"CORRECTION / SELLOFF",
 REBOUND:"REBOUND · NOT CONFIRMED",
 RECOVERY_TEST:"RECOVERY TEST · UNCONFIRMED",
 RECLAIMED:"PRICE LEVEL RECLAIMED"
};
function display(value:number|null,suffix="%"):string{
 return value===null?"N/A":value.toFixed(2)+suffix;
}
function AssetCard({item}:{item:MarketPhaseAsset}){
 return <article className={s.asset} data-phase-asset={item.id}
   data-phase-state={item.state} data-phase-severity={item.severity}>
  <div className={s.assetHead}><h4>{item.label}</h4>
   <span>{PHASE_LABEL[item.state]}</span></div>
  <div className={s.metrics}>
   <div><small>Worst peak-to-trough · 126 sessions</small>
    <strong data-drawdown-depth={item.worstDrawdownPercent===null?"unavailable":item.worstDrawdownPercent.toFixed(2)}>
     {display(item.worstDrawdownPercent)}</strong></div>
   <div><small>Current distance below window high</small>
    <strong>{display(item.currentDrawdownPercent)}</strong></div>
  </div>
  {item.state!=="UNMEASURED"?
   <p className={s.phaseDetails}>
    {item.peakAt&&item.troughAt?
      "Observed peak "+item.peakAt+" → trough "+item.troughAt+
      " ("+item.peakToTroughSessions+" sessions). ":
      "No measured peak-to-trough fall. "}
    {item.worstDrawdownPercent!==null&&item.worstDrawdownPercent<=-10?
      "Loss recovered since that trough: "+display(item.recoveryOfLossPercent)+". ":
      ""}
    {item.explanation}</p>:
   <p className={s.phaseDetails}>{item.explanation}</p>}
  <div className={s.assetFoot}><span>{item.asOf?"Close "+item.asOf+" · "+item.observedSessions+" sessions":"Data incomplete"}</span>
   {item.sourceUrl?<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
     Price source ↗</a>:null}</div>
 </article>;
}
export default function CrashMarketPhasePanel({phase}:{phase:CrashMarketPhase}){
 return <section className={s.wrap} aria-labelledby="crash-market-phase-title"
   data-crash-market-phase="price-path-v1" data-phase-coverage={phase.covered}>
  <div className={s.heading}>
   <div><span className={s.kicker}>LOOK-BACK / PRICE DAMAGE ALREADY REALISED</span>
    <h3 id="crash-market-phase-title">Has the crash already happened?</h3>
    <p className={s.lead}>{phase.headline}</p><p>{phase.subline}</p></div>
   <div className={s.clock}>PRICE PATH · 126 SESSIONS
    <strong>{phase.covered} / 3 measured</strong>
    <small>Newest qualified close: {phase.session??"UNAVAILABLE"}</small></div>
  </div>
  <div className={s.assets}>
   {phase.assets.map(item=><AssetCard key={item.id} item={item}/>)}
  </div>
  <p className={s.caveat}>10% peak-to-trough is a price correction; 20% is a bear-market drawdown convention, <b>not automatic evidence of a rapid crash or systemic contagion</b>. This window can miss older shocks. A rebound measures the distance recovered from a recorded low, not whether credit, earnings or the longer-term trend have turned. The seesaw above measures <b>current directional pressure</b> and deliberately does not erase damage previously suffered.</p>
 </section>;
}
