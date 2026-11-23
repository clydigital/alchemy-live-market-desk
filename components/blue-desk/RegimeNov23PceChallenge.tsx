import type {ReactNode} from "react";

/** Source-dated, public-safe editorial fork; never a live price or canonical regime decision.
 * Private creator transcripts and user-specific FX signals never flow into this surface.
 */
type Scope="fed"|"bonds"|"ai"|"breadth"|"cross";
type Fork=Readonly<{headline:string;support:string;countercase:string;next:string}>;
const FORKS:Record<Scope,Fork>={
  fed:{
    headline:"PCE vs rate-hike pricing: can a softer inflation surprise break the dollar rally?",
    support:"Reuters reported 23 November dollar strength and near-fully-priced December tightening. October PCE had not yet been published in this research edition.",
    countercase:"A softer monthly reading than September is not necessarily a consensus miss. Inflation subcomponents, spending, revisions, US rate pricing and safe-haven flows could keep the dollar firm.",
    next:"Lock a timestamped pre-release core/headline PCE consensus; then compare BEA actuals with 2Y, real-yield and DXY reaction at the same event clock."
  },
  bonds:{
    headline:"The front end rebounded with AI. Will a softer PCE surprise reverse it?",
    support:"The Wall Street Journal's 23 November report put the US 2-year Treasury yield at about 4.694%, up 8.3 basis points during the rebound.",
    countercase:"A shift from bonds into risk assets can raise yields without proving a permanently higher Fed path; conversely, rate repricing and Treasury supply can offset a softer PCE print.",
    next:"Recheck official dated Treasury 2Y/10Y, TIPS real yields and breakevens; observe FOMC futures before and after PCE, and separate rate pressure from actual HY/CCC credit stress."
  },
  ai:{
    headline:"Jensen's return repaired a leadership shock, not the AI financing math.",
    support:"Nvidia confirmed Jensen Huang's reinstatement on 23 November. AI shares rebounded; the event alone establishes neither durable earnings upgrades nor easier funding.",
    countercase:"Higher 2Y/real yields can continue to pressure highly financed AI buildouts; cash conversion, debt terms, prepayments and concentrated customers still matter even when valuations rebound.",
    next:"Test Nvidia post-return guidance, CoreWeave/neocloud cash collections, debt/lease service, orders and funding, alongside SMH/QQQ and HY spreads after PCE."
  },
  breadth:{
    headline:"Is this a real broad market recovery or a narrow AI-led squeeze?",
    support:"The Nvidia-led 23 November recovery offers a meaningful countercase to relentless selling, but a one-day index rebound cannot demonstrate broad participation.",
    countercase:"VIX spikes or 'smart-money buying' claims in creator commentary do not identify actual flows. RSP/SPY measures equal-weight versus cap-weight S&P 500, not small caps.",
    next:"Compare completed-session RSP/SPY, SMH, QQQ, the 11 XL sectors, 50D/200D participation and HY credit over subsequent closes, not a single intraday surge."
  },
  cross:{
    headline:"Dollar higher, AI higher: reflationary recovery or temporary relief?",
    support:"The 23 November Nvidia reinstatement, strong dollar and front-end yield rebound support a risk-recovery/hawkish-Fed countercase.",
    countercase:"Below-consensus core PCE, falling 2Y/real yields and an independently verified failed DXY 4H/Daily EMA-band retest could weaken the dollar while helping duration-sensitive equities. Dollar safe-haven demand can break that linkage.",
    next:"Record November 25 core/headline PCE actual versus dated consensus, DXY/2Y/TIPS at T+5/30/120 minutes, then completed RSP/SPY, SMH/QQQ and credit sessions. Check technical invalidation separately."
  }
};
const SOURCES=[
 {name:"Nvidia · CEO reinstatement (23 Nov)",url:"https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Board-Reinstates-Jensen-Huang-as-President-CEO-and-Board-Director/default.aspx"},
 {name:"BEA · October PCE scheduled 25 Nov",url:"https://www.bea.gov/news/schedule/"},
 {name:"Reuters · dated dollar/Fed pricing report",url:"https://www.reuters.com/world/middle-east/dollar-edges-off-19-month-high-after-market-rout-yen-softens-2026-11-22/"},
 {name:"WSJ-derived · dated Treasury 2Y report",url:"https://ca.marketscreener.com/news/treasury-yields-rise-as-huang-returns-as-ceo-european-bond-yields-slip-update-ce7851dadd81f32d"}
] as const;

export function getNov23PceFork(scope:Scope):Fork{return FORKS[scope];}
export default function RegimeNov23PceChallenge({scope,now=new Date()}:{scope:Scope;now?:Date}):ReactNode{
 const view=FORKS[scope];
 const eventPassed=Number.isFinite(now.getTime())&&now.getTime()>=Date.parse("2026-11-25T13:30:00Z");
 return <section id="nov24-dxy-pce" data-regime-pce-research="2026-11-23-research-only"
   data-regime-pce-scope={scope} data-regime-research-status="RESEARCH_ONLY"
   aria-label="Dated PCE and dollar countercase"
   style={{margin:"16px 0 24px",padding:"20px clamp(16px,3vw,28px)",background:"var(--bb-surface)",
    border:"1px solid var(--bb-card-border)",borderRadius:10,lineHeight:1.6}}>
   <span style={{display:"block",textTransform:"uppercase",fontSize:11,fontWeight:800,letterSpacing:".09em",
     color:"var(--bb-accent)",marginBottom:7}}>
     23 NOV SOURCE SNAPSHOT / 24 NOV RESEARCH CHALLENGE · NOT AN UPDATED REGIME VERDICT
   </span>
   <h2 style={{fontSize:"clamp(20px,2.3vw,28px)",margin:"6px 0 10px"}}>{view.headline}</h2>
   <p><strong>Case for this view:</strong> {view.support}</p>
   <p><strong>Strongest countercase:</strong> {view.countercase}</p>
   <p><strong>Deciding test:</strong> {view.next}</p>
   <p style={{fontSize:13}}><strong>Event clock:</strong> BEA October PCE, 25 November 2026, 08:30 ET.
     {eventPassed?" The scheduled release time has passed: this historical research note MUST NOT be read as a fresh post-release verdict. Check a verified BEA release and current market tape.":" Release not yet observed in this dated research note."}
   </p>
   <p style={{fontSize:12,opacity:.85}}>A bearish DXY technical read is a conditional test, not a measured signal in this module. No inferred institutional flows,
     fabricated probabilities, trade entries, private creator data, portfolio information or automatic canonical Story/Regime changes.</p>
   <div style={{fontSize:12,paddingTop:10,borderTop:"1px solid var(--bb-card-border)"}}>
     <strong>Original and attributed sources:</strong>
     {SOURCES.map((source,index)=><span key={source.url}>{index?", ":" "}<a href={source.url}
       target="_blank" rel="noopener noreferrer">{source.name}</a></span>)}
   </div>
 </section>;
}
