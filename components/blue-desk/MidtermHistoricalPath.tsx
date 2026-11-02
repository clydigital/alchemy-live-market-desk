import type {CSSProperties} from "react";

// Source: Financial Modeling Prep ^GSPC daily index prices. 19 US midterms, 1950–2022.
// Each number is the arithmetic mean/median of cumulative election-close-to-horizon
// PRICE returns; observations use a preceding close if the target day had no session.
type Window = {label:string;average:number;median:number;positive:number};
const WEEKLY:Window[]=[
 {label:"1 week",average:1.11,median:1.37,positive:14},
 {label:"2 weeks",average:0.02,median:1.18,positive:10},
 {label:"3 weeks",average:0.70,median:0.66,positive:11},
 {label:"1 month",average:1.70,median:2.34,positive:15},
];
const MONTHLY:Window[]=[
 {label:"2 months",average:3.52,median:2.29,positive:15},
 {label:"3 months",average:7.70,median:7.57,positive:17},
 {label:"4 months",average:8.65,median:9.62,positive:18},
 {label:"5 months",average:10.98,median:10.69,positive:18},
 {label:"6 months",average:14.14,median:16.89,positive:19},
 {label:"7 months",average:14.09,median:13.22,positive:19},
 {label:"8 months",average:16.50,median:14.97,positive:19},
 {label:"9 months",average:16.04,median:17.55,positive:19},
 {label:"10 months",average:16.63,median:16.88,positive:17},
 {label:"11 months",average:16.67,median:17.47,positive:17},
 {label:"12 months",average:15.11,median:14.49,positive:19},
];
const PATH=[{label:"Election",average:0,median:0},...WEEKLY.map(({label,average,median})=>({label,average,median}))];
const pct=(n:number)=>(n>=0?"+":"")+n.toFixed(2)+"%";
const x=(i:number)=>72+180*i;
const y=(value:number)=>270-(value+0.5)/3.5*220;
const points=(field:"average"|"median")=>PATH.map((p,i)=>x(i)+","+y(p[field])).join(" ");
const section:CSSProperties={border:"1px solid var(--bb-card-border)",background:"var(--bb-surface)",borderRadius:12,padding:"clamp(18px,3vw,34px)",marginTop:19};
const muted:CSSProperties={color:"var(--bb-muted)",fontSize:13,lineHeight:1.65};
const cell:CSSProperties={padding:"10px 12px",borderBottom:"1px solid var(--bb-card-border)",textAlign:"right",whiteSpace:"nowrap",fontVariantNumeric:"tabular-nums"};
const head:CSSProperties={...cell,color:"var(--bb-muted)",fontSize:12,fontWeight:700};
function WindowTable({rows}:{rows:Window[]}){
 return <div style={{overflowX:"auto",marginTop:16}}>
  <table style={{width:"100%",minWidth:520,borderCollapse:"collapse",fontSize:14}}>
   <thead><tr><th scope="col" style={{...head,textAlign:"left"}}>Period after vote</th><th scope="col" style={head}>Average</th><th scope="col" style={head}>Median</th><th scope="col" style={head}>Positive years</th></tr></thead>
   <tbody>{rows.map(row=><tr key={row.label}><th scope="row" style={{...cell,textAlign:"left",fontWeight:600}}>{row.label}</th><td style={cell}>{pct(row.average)}</td><td style={cell}>{pct(row.median)}</td><td style={cell}>{row.positive}/19 ({Math.round(row.positive/19*100)}%)</td></tr>)}</tbody>
  </table>
 </div>;
}
function PathChart(){
 return <figure style={{margin:"21px 0 15px"}} data-midterm-path-chart="first-month-only">
  <figcaption style={{fontWeight:800,fontSize:18}}>The midterm path: the first 30 days</figcaption>
  <p style={{...muted,margin:"0 0 9px"}}>S&amp;P 500 cumulative price returns · 19 elections · 1950–2022</p>
  <div style={{border:"1px solid var(--bb-card-border)",borderRadius:12,background:"var(--bb-bg)",overflowX:"auto",padding:"10px 8px 2px"}}>
   <svg viewBox="0 0 860 340" width="100%" role="img" aria-labelledby="midterm-path-title midterm-path-description" style={{display:"block",minWidth:560,height:"auto"}}>
    <title id="midterm-path-title">Historical S&amp;P 500 path after US midterm elections</title>
    <desc id="midterm-path-description">Average cumulative price returns after one week, two weeks, three weeks, and one month were +1.11%, +0.02%, +0.70%, and +1.70%. Median returns were +1.37%, +1.18%, +0.66%, and +2.34%.</desc>
    {[-0.5,0,1,2,3].map(tick=><g key={tick}>
     <line x1={72} x2={812} y1={y(tick)} y2={y(tick)} stroke={tick===0?"var(--bb-muted)":"var(--bb-card-border)"} strokeWidth={tick===0?1.5:1} strokeDasharray={tick===0?"5 5":undefined}/>
     <text x={59} y={y(tick)+5} textAnchor="end" fontSize={14} fill="var(--bb-muted)">{tick===0?"0%":pct(tick).replace(".00","")}</text>
    </g>)}
    <polyline points={points("median")} fill="none" stroke="#57c9e8" strokeWidth={3} strokeDasharray="8 5" strokeLinejoin="round" strokeLinecap="round"/>
    <polyline points={points("average")} fill="none" stroke="var(--bb-accent)" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round"/>
    {PATH.map((p,i)=><g key={p.label}>
     <circle cx={x(i)} cy={y(p.median)} r={5} fill="#57c9e8" stroke="var(--bb-bg)" strokeWidth={2}/>
     <circle cx={x(i)} cy={y(p.average)} r={5.5} fill="var(--bb-accent)" stroke="var(--bb-bg)" strokeWidth={2}/>
     <text x={x(i)} y={307} textAnchor="middle" fontSize={14} fill="var(--bb-text)" fontWeight={i===0?400:650}>{p.label}</text>
     {i>0&&<text x={x(i)} y={y(p.average)-15} textAnchor="middle" fontSize={15} fontWeight={750} fill="var(--bb-accent)">{pct(p.average)}</text>}
    </g>)}
   </svg>
  </div>
  <div style={{display:"flex",alignItems:"center",gap:22,flexWrap:"wrap",fontSize:13,marginTop:10}}>
   <span><span aria-hidden="true" style={{display:"inline-block",width:24,borderTop:"4px solid var(--bb-accent)",verticalAlign:"middle",marginRight:8}}/>Average</span>
   <span><span aria-hidden="true" style={{display:"inline-block",width:24,borderTop:"3px dashed #57c9e8",verticalAlign:"middle",marginRight:8}}/>Median</span>
  </div>
  <p style={{...muted,margin:"10px 0 0"}}>The chart intentionally ends at one month; the 2–12 month data are shown only in the table. All points are cumulative from the same election close.</p>
 </figure>;
}
export default function MidtermHistoricalPath(){
 return <section style={section} data-midterm-window-research="historical-closing-prices-1950-2022">
  <p style={{...muted,letterSpacing:".08em",fontWeight:800,color:"var(--bb-accent)"}}>THE FIRST MONTH / HISTORICAL BASE RATES</p>
  <h2>Does the rally begin immediately — or is there a second-week trap?</h2>
  <p>The twelve-month statistic obscures a less dependable opening. The S&amp;P 500 was higher a week after <strong>14 of the 19</strong> elections since 1950, but by week two only <strong>10 of 19</strong> were positive. After one month the win rate improved to <strong>15 of 19</strong>. A strong first-week relief move was not a guarantee that gains held.</p>
  <PathChart/>
  <WindowTable rows={WEEKLY}/>
  <p style={{...muted,marginTop:14}}>The near-zero +0.02% average two-week return reflects sharp losses in certain elections, notably 1974 and 2018. Averages describe outcomes, not a model of a single continuous rally.</p>
  <h3 style={{marginTop:28}}>And after two months? The six-to-twelve-month record</h3>
  <p>Measured consistently from the election-date close, the average return rose to <strong>+3.52% after two months</strong>, <strong>+7.70% after three</strong> and <strong>+14.14% after six</strong>. All 19 elections were positive at months six through nine; the count then fell to 17/19 at months ten and eleven, before returning to 19/19 at month twelve.</p>
  <WindowTable rows={MONTHLY}/>
  <p>The jump from a mixed week two to a stronger six-month record makes <strong>holding period</strong> central to the thesis. The 1974 first month lost nearly 12% despite the index eventually finishing higher one year later. In 2018 it fell roughly 2.2% over the first month. Historical seasonality is not a stop-loss or substitute for reading yields, credit conditions, breadth and corporate earnings.</p>
  <p style={muted}><strong>Calculation:</strong> Independent analysis of <a href="https://site.financialmodelingprep.com/developer/docs/stable/index-historical-price-eod-light" target="_blank" rel="noopener noreferrer">Financial Modeling Prep's historical daily S&amp;P 500 (^GSPC) prices</a>, 19 midterms (1950–2022). Each base is Election Day closing price or the preceding session if unavailable. Weekly checkpoints are +7/+14/+21 calendar days; monthly checkpoints use the same calendar date 1–12 months later; any non-trading target uses the preceding available close. Reported means are arithmetic and all returns exclude dividends, transaction costs and inflation. Our independently calculated twelve-month mean is +15.11%, versus Capital Group's separately sourced +15.4%; source conventions must not be mixed. Historical outcomes are not forecasts or a canonical market-regime verdict.</p>
 </section>;
}
