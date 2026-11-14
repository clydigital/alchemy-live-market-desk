import type {CSSProperties} from "react";
import type {CrashEvidenceBalance} from "@/lib/bluebelly-crash-evidence-balance";
import s from "./CrashEvidenceSeesaw.module.css";

function WeightBlocks({x,units,side}:{x:number;units:number;side:"opportunity"|"crash"}){
 const count=Math.round(units*2); // one block is exactly 0.5 fixed research unit
 return <g data-weight-blocks={side} aria-hidden="true">
  {Array.from({length:count},(_,i)=>{
   const col=i%3,row=Math.floor(i/3);
   return <rect key={i} x={x-48+col*34} y={250-23-row*23} rx="3" width="29" height="19"
    fill={side==="opportunity"?"#36c49b":"#fa7479"}
    stroke={side==="opportunity"?"#b0ffdf":"#ffbec5"} strokeWidth="1.4"/>;
  })}
 </g>;
}
function pan(x:number,side:"opportunity"|"crash",units:number){
 const stroke=side==="opportunity"?"#36c49b":"#fa7479";
 return <g data-pan={side}>
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
 const style={"--seesaw-angle":angle} as CSSProperties;
 const label=`${balance.verdict}. Opportunity ${balance.opportunityUnits.toFixed(1)} research units. Crash risk ${balance.crashUnits.toFixed(1)} research units. Neutral ${balance.neutralUnits.toFixed(1)}, unavailable ${balance.unknownUnits.toFixed(1)}. ${balance.eligibleCount} of three indicators observed. Not a probability.`;
 const blockWord=(v:number)=>v===1?"block":"blocks";
 return <section className={s.wrap} style={style} data-crash-evidence-seesaw="source-dated-v1"
    data-seesaw-lean={balance.lean} data-eligible-inputs={balance.eligibleCount}
    aria-labelledby="evidence-seesaw-title">
  <div className={s.heading}>
   <div>
    <span className={s.kicker}>EVIDENCE BALANCE · SOURCE-DATED</span>
    <h3 id="evidence-seesaw-title">The market seesaw</h3>
    <p>{balance.verdict}. As new qualified data arrive, the heavier side tilts down.</p>
   </div>
   <div className={s.status} data-balance-state={balance.lean}>
    <span>HEAVIER SIDE</span>
    <strong>{balance.lean==="CRASH_RISK"?"CRASH RISK":
      balance.lean==="OPPORTUNITY"?"OPPORTUNITY":
      balance.lean==="BALANCED"?"BALANCED":"UNMEASURED"}</strong>
   </div>
  </div>

  <div className={s.panHeads}>
   <div className={s.opportunityHead}>
    <span>OPPORTUNITY</span>
    <strong>{balance.opportunityUnits.toFixed(1)} <small>units</small></strong>
    <small>Evidence of durable recovery</small>
   </div>
   <div className={s.crashHead}>
    <span>CRASH RISK</span>
    <strong>{balance.crashUnits.toFixed(1)} <small>units</small></strong>
    <small>Evidence of systemic pressure</small>
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
   <span><b>{balance.eligibleCount}/3</b> source-qualified observations</span>
   <span><b>{balance.neutralUnits.toFixed(1)}</b> neutral units</span>
   <span><b>{balance.unknownUnits.toFixed(1)}</b> unavailable units</span>
   <span>Latest eligible session: <b>{balance.latestSession??"NONE"}</b></span>
  </div>

  <div className={s.weightList} aria-label="Evidence sources and weight assignments">
   {balance.weights.map(w=><div key={w.id} className={s.weight} data-weight-source={w.id}
     data-weight-side={w.side}>
     <div className={s.weightTitle}><strong>{w.label}</strong>
      <span>{w.maximum.toFixed(1)} research {w.maximum===1?"unit":"units"}</span></div>
     <p>{w.side==="CRASH_RISK"?"WEIGHS TOWARD CRASH":
       w.side==="OPPORTUNITY"?"WEIGHS TOWARD OPPORTUNITY":
       w.side==="NEUTRAL"?"NEITHER SIDE · MIXED":"NOT COUNTED · SOURCE MISSING"}</p>
     <small>{w.observedAt? "Source session "+w.observedAt+" · ":""}{w.observation}</small>
    </div>)}
  </div>
  <p className={s.caveat}>Fixed transparent research importance: HY credit <b>2.0</b>, five-session breadth <b>1.5</b>, one-day equity tape <b>1.0</b>. Each directional observation loads its side; mixed and missing evidence load neither. The weights are <b>not calibrated probabilities</b>, independently backtested risk estimates or trade instructions. Equity tape and breadth partly overlap; issuer cash flow and forced-selling evidence remain separate confirmation gates.</p>
 </section>;
}
