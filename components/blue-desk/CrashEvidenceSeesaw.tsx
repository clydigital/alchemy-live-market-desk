import type {CSSProperties} from "react";
import type {CrashEvidenceBalance} from "@/lib/bluebelly-crash-evidence-balance";
import s from "./CrashEvidenceSeesaw.module.css";

function WeightBlocks({x,units,side}:{x:number;units:number;side:"opportunity"|"crash"}){
 // Fractional final blocks represent less than 0.25; exact totals remain text.
 const count=Math.ceil(units*4-0.000001);
 const full=Math.floor(units*4+0.000001);
 return <g data-weight-blocks={side} aria-hidden="true">
  {Array.from({length:count},(_,i)=>{
   const col=i%6,row=Math.floor(i/6);
   return <rect key={i} x={x-64+col*22} y={241-row*21} rx="3"
    width={i<full?19:Math.max(0,19*(units*4-full))} height="17"
    fill={side==="opportunity"?"#36c49b":"#fa7479"}
    stroke={side==="opportunity"?"#b0ffdf":"#ffbec5"} strokeWidth="1.4"/>;
  })}
 </g>;
}
function pan(x:number,side:"opportunity"|"crash",units:number){
 const stroke=side==="opportunity"?"#36c49b":"#fa7479";
 return <g className={`${s.panCounter} ${side==="opportunity"?s.panLeft:s.panRight}`} data-pan={side}>
  <path d={`M ${x} 162 L ${x-70} 262 M ${x} 162 L ${x+70} 262`}
   fill="none" stroke={stroke} strokeWidth="3" opacity=".85"/>
  <path d={`M ${x-78} 262 Q ${x} 279 ${x+78} 262`} fill="none"
   stroke={stroke} strokeWidth="12" strokeLinecap="round"/>
  <path d={`M ${x-68} 253 H ${x+68}`} stroke={stroke} strokeWidth="2" opacity=".65"/>
  <WeightBlocks x={x} units={units} side={side}/>
 </g>;
}

export default function CrashEvidenceSeesaw({balance}:{balance:CrashEvidenceBalance}){
 const angle=`${balance.angle}deg`;
 const style={"--seesaw-angle":angle,
  "--seesaw-overshoot":`${(balance.angle*1.12).toFixed(2)}deg`,
  "--seesaw-counter-angle":`${(-balance.angle).toFixed(2)}deg`,
  "--seesaw-counter-overshoot":`${(-balance.angle*1.12).toFixed(2)}deg`} as CSSProperties;
 const label=`${balance.verdict}. Opportunity ${balance.opportunityUnits.toFixed(2)} research units, including ${balance.transcript.opportunityUnits.toFixed(2)} transcript corroboration. Crash risk ${balance.crashUnits.toFixed(2)} research units, including ${balance.transcript.crashUnits.toFixed(2)} transcript corroboration. Neutral ${balance.neutralUnits.toFixed(1)}, unavailable ${balance.unknownUnits.toFixed(1)}. ${balance.eligibleCount} of three indicators observed. Not a probability.`;
 return <section className={s.wrap} style={style} data-crash-evidence-seesaw="source-dated-v1"
    data-seesaw-lean={balance.lean} data-eligible-inputs={balance.eligibleCount}
    aria-labelledby="evidence-seesaw-title">
  <div className={s.heading}>
   <div>
    <span className={s.kicker}>EVIDENCE BALANCE · SOURCE-DATED</span>
    <h3 id="evidence-seesaw-title">The market seesaw</h3>
    <p>{balance.verdict}. {balance.lean==="NEUTRAL"
     ?"There is no measurable signed pressure in the dated inputs."
     :"The beam responds proportionally to signed, dated market changes. A small tilt below thresholds is not a confirmed regime change."}</p>
   </div>
   <div className={s.status} data-balance-state={balance.lean}>
    <span>HEAVIER SIDE</span>
    <strong>{balance.lean==="CRASH_RISK"?"CRASH RISK":
      balance.lean==="OPPORTUNITY"?"OPPORTUNITY":
      balance.lean==="BALANCED"?"BALANCED":
      balance.lean==="NEUTRAL"?"NO DIRECTIONAL SIGNAL":"UNMEASURED"}</strong>
   </div>
  </div>

  <div className={s.panHeads}>
   <div className={s.opportunityHead}>
    <span>OPPORTUNITY</span>
    <strong>{balance.opportunityUnits.toFixed(2)} <small>units</small></strong>
    <small>Current pressure · not a confirmed recovery</small>
   </div>
   <div className={s.crashHead}>
    <span>CRASH RISK</span>
    <strong>{balance.crashUnits.toFixed(2)} <small>units</small></strong>
    <small>Current pressure · not past drawdown</small>
   </div>
  </div>

  <div className={s.stage} role="img" aria-label={label}>
   <svg viewBox="0 0 960 370" preserveAspectRatio="xMidYMid meet"
     aria-hidden="true" focusable="false">
    <defs>
     <linearGradient id="crash-seesaw-beam" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stopColor="#d0e3ed"/>
      <stop offset="1" stopColor="#6e899c"/>
     </linearGradient>
    </defs>
    <path d="M 68 330 H 892" stroke="#385064" strokeWidth="2" strokeDasharray="5 9" opacity=".72"/>
    <path d="M 480 156 L 425 320 H 535 Z" fill="#162e3d" stroke="#6f91a4" strokeWidth="4"/>
    <path d="M 453 294 H 507" stroke="#8eacc0" strokeWidth="4" opacity=".7"/>
    <g className={s.arm} data-arm-angle={balance.angle.toFixed(2)}>
     <path d="M 160 155 H 800" stroke="#1c3445" strokeWidth="24" strokeLinecap="round"/>
     <path d="M 160 155 H 800" stroke="url(#crash-seesaw-beam)" strokeWidth="12" strokeLinecap="round"/>
     <circle cx="170" cy="155" r="9" fill="#36c49b" stroke="#a0ffde" strokeWidth="3"/>
     <circle cx="790" cy="155" r="9" fill="#fa7479" stroke="#ffb3bd" strokeWidth="3"/>
     {pan(170,"opportunity",balance.opportunityUnits)}
     {pan(790,"crash",balance.crashUnits)}
    </g>
    <circle cx="480" cy="155" r="18" fill="#071522" stroke="#9ab6c7" strokeWidth="5"/>
    <circle cx="480" cy="155" r="6" fill="#dceaf0"/>
    <text x="480" y="358" textAnchor="middle" fill="#9eb8c9" fontSize="15"
     fontFamily="ui-monospace,monospace" fontWeight="800">PIVOT · SOURCE EVIDENCE</text>
   </svg>
  </div>
  <div className={s.summary}>
   <span><b>{balance.eligibleCount}/3</b> dated market observations</span>
   <span><b>{balance.neutralUnits.toFixed(2)}</b> unallocated/neutral units</span>
   <span><b>{balance.unknownUnits.toFixed(2)}</b> unavailable units</span>
   <span>Latest eligible market session: <b>{balance.latestSession??"NONE"}</b></span>
  </div>

  <section className={s.transcriptPanel} data-crash-transcript-score="reviewed-source-corroboration-v1"
    data-transcript-status={balance.transcript.status}
    data-transcript-matched={balance.transcript.corroboratedPublishers}
    aria-label="Automatically scored creator transcript agreement">
   <div className={s.transcriptHeader}>
    <div><span>SECONDARY RESEARCH · AUTO-CORROBORATED</span>
      <h4>Reviewed transcripts versus market data</h4></div>
    <strong>{balance.transcript.status==="UNAVAILABLE"?"FEED UNAVAILABLE":
      balance.transcript.status==="EMPTY"?"NO RECENT REVIEWS":
      balance.transcript.corroboratedPublishers?"MARKET-MATCHED CLAIMS":
      balance.transcript.confirmingMarketGates===0?"MARKET CONFIRMATION GATES CLOSED":"NO VERIFIED MATCHES"}</strong>
   </div>
   <div className={s.transcriptStats}>
    <div><span>Opportunity corroboration</span><strong data-transcript-side="opportunity">{balance.transcript.status==="AVAILABLE"&&balance.transcript.confirmingMarketGates===0?"GATED":"+"+balance.transcript.opportunityUnits.toFixed(2)}</strong></div>
    <div><span>Crash corroboration</span><strong data-transcript-side="crash">{balance.transcript.status==="AVAILABLE"&&balance.transcript.confirmingMarketGates===0?"GATED":"+"+balance.transcript.crashUnits.toFixed(2)}</strong></div>
    <div><span>Reviewed videos / distinct publishers</span><strong data-transcript-coverage="video-publisher">{balance.transcript.reviewedVideos} / {balance.transcript.reviewedPublishers}</strong></div>
    <div><span>Directional market confirmation gates</span><strong data-transcript-market-gates={balance.transcript.confirmingMarketGates}>{balance.transcript.confirmingMarketGates} / 3</strong></div>
   </div>
   <p className={s.transcriptLead}>Research is present: <b>{balance.transcript.observationalClaims}</b> structured observations or cited facts sampled; <b>{balance.transcript.eligibleClaims}</b> precise directional statements recognised by this narrow matcher; <b>{balance.transcript.corroboratedPublishers}</b> independent publisher matches. These are different stages, not interchangeable measures of signal strength.</p>
   {balance.transcript.researchThemes.length?<div className={s.themeGrid} aria-label="Topics in reviewed creator claims, unverified">
    <span>UNVERIFIED RESEARCH LEADS · distinct publishers mentioning each topic</span>
    <div>{balance.transcript.researchThemes.map(t=><span key={t.id} data-creator-theme={t.id}>{t.label} · {t.publishers}</span>)}</div>
   </div>:null}
   {balance.transcript.topics.length?
     <div className={s.transcriptTopics}>{balance.transcript.topics.map(t=>
      <span key={t.id} data-transcript-topic={t.id} data-transcript-direction={t.side}>
       {t.id.toUpperCase()} · {t.side==="CRASH_RISK"?"CRASH":"OPPORTUNITY"} · {t.units.toFixed(2)}u · {t.sourceDate}
      </span>)}</div>:
     <p className={s.transcriptEmpty}>{balance.transcript.confirmingMarketGates===0&&balance.transcript.status==="AVAILABLE"?
      "The three strong directional market gates are all mixed or unavailable. No reviewed creator claim can earn extra pan weight under this rule—even if the review contains useful research. Creator views remain tracked as unverified leads above.":
      "No independently market-matched directional creator statements qualify for extra weight. This does not imply creators are bullish, bearish or silent."}</p>}
   <p className={s.transcriptNote}>{balance.transcript.note}
     {" "}Published video age: {balance.transcript.lastVideoPublished?.slice(0,10)??"none in window"};
     {" "}validated market session: {balance.transcript.dataAsOf??"none"}.
   </p>
  </section>
  <div className={s.weightList} aria-label="Evidence sources and weight assignments">
   {balance.weights.map(w=><div key={w.id} className={s.weight} data-weight-source={w.id}
     data-weight-side={w.side} data-weight-signal={w.signal}
     data-weight-contribution={w.units.toFixed(2)}>
     <div className={s.weightTitle}><strong>{w.label}</strong>
      <span>{w.units.toFixed(2)} / {w.maximum.toFixed(1)} units</span></div>
     <p>{w.signal==="MIXED"&&w.units>0?
        (w.side==="CRASH_RISK"?"EARLY RISK PRESSURE":"EARLY OPPORTUNITY PRESSURE")+" · BELOW THRESHOLD":
       w.side==="CRASH_RISK"?"QUALIFIED CRASH PRESSURE":
       w.side==="OPPORTUNITY"?"QUALIFIED OPPORTUNITY PRESSURE":
       w.side==="NEUTRAL"?"NEITHER SIDE · MIXED":"NOT COUNTED · SOURCE MISSING"}</p>
     <small>{w.observedAt? "Source session "+w.observedAt+" · ":""}{w.observation}</small>
    </div>)}
  </div>
  <p className={s.caveat}>Primary market weighting: HY credit <b>2.0</b>, five-session breadth <b>1.5</b>, one-day equity tape <b>1.0</b>. Independently market-matched, reviewed creator observations can add <b>up to 1.0</b> secondary research unit (0.25 per creator; 0.5 per topic), never more than the primary measurements. A MIXED reading with qualified, dated signed magnitude can contribute a proportional <b>early</b> weight, without satisfying the stronger directional threshold. Missing observations contribute zero. The mixed four-ETF tape remains unweighted until a comparable directional magnitude is available. Creator agreement with those SAME market observations is not independent confirmation, and does not validate forecasts or mechanisms. These units are <b>not calibrated probabilities</b>, backtested risk estimates or trade instructions. Issuer cash flow and forced-selling evidence remain separate confirmation gates.</p>
 </section>;
}
