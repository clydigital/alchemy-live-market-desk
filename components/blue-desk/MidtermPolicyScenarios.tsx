import type {CSSProperties} from "react";

// Dated editorial analysis. Outcome groups use the party holding both chambers after each
// 1950–2022 midterm, or split control, NOT unified control of the executive branch.
// ^GSPC cumulative closing-price returns from election close to the same calendar-day
// anniversary (or preceding session); n=19. This is descriptive, not causal.
const muted:CSSProperties={color:"var(--bb-muted)",fontSize:13,lineHeight:1.65};
const section:CSSProperties={border:"1px solid var(--bb-card-border)",background:"var(--bb-surface)",borderRadius:12,padding:"clamp(18px,3vw,34px)",marginTop:19};
const cell:CSSProperties={borderBottom:"1px solid var(--bb-card-border)",padding:"11px 12px",verticalAlign:"top",lineHeight:1.55};
const head:CSSProperties={...cell,fontSize:12,color:"var(--bb-muted)",fontWeight:800,textAlign:"left"};
const pct=(n:number)=>(n>=0?"+":"")+n.toFixed(2)+"%";
const source=(href:string,label:string)=><a href={href} rel="noopener noreferrer" target="_blank">{label}</a>;
const HISTORY=[
 {label:"Republicans hold both chambers",sample:4,week1:-0.18,week2:-0.21,month1:0.30,month6:10.19,month12:17.11,years:"1994, 1998, 2002, 2014"},
 {label:"Democrats hold both chambers",sample:11,week1:1.19,week2:0.32,month1:2.39,month6:16.49,month12:15.35,years:"1950, 1954, 1958, 1962, 1966, 1970, 1974, 1978, 1986, 1990, 2006"},
 {label:"Split House and Senate",sample:4,week1:2.19,week2:-0.58,month1:1.17,month6:11.62,month12:12.44,years:"1982, 2010, 2018, 2022"},
] as const;
const SECTORS=[
 {name:"Traditional energy / oil and gas",red:"Permit and regulatory continuity helps producers, but extra supply can weigh on oil prices.",blue:"More hearings and resistance to some expansion; Trump still directs federal agencies.",split:"Existing executive policy largely remains; funding and permitting deals matter."},
 {name:"Renewables / EV supply chain",red:"Existing reductions to EV and household clean-energy credits remain a headwind.",blue:"Potential negotiations to restore support; credits do not automatically return.",split:"Policy continuity; targeted bipartisan grid and energy deals are possible."},
 {name:"Big Tech / AI infrastructure",red:"Easier permits and tax continuity are positives; higher borrowing and power costs are the catch.",blue:"Greater antitrust and data-centre scrutiny; AI buildout need not stop.",split:"Possible narrower agreements on grid capacity, siting and who pays for upgrades."},
 {name:"Financials / banks",red:"Relative advantage from capital, enforcement and merger-policy continuity.",blue:"Oversight may intensify, but higher corporate taxes are not automatic.",split:"Regulatory continuity versus funding and legislative bargaining risks."},
 {name:"Healthcare / pharma",red:"Mixed: reduced programme spending could hurt providers even with lower regulatory burdens.",blue:"Greater defence of healthcare coverage; medicine-pricing negotiations may weigh on pharma.",split:"Potential insurance and drug-pricing compromises; outcomes remain company-specific."},
] as const;

export default function MidtermPolicyScenarios(){
 return <section style={section} data-midterm-policy-scenarios="pre-election-2026">
  <p style={{...muted,letterSpacing:".08em",fontWeight:800,color:"var(--bb-accent)"}}>PART 2 / WHO WINS THE RALLY?</p>
  <h2>Red, Blue or gridlock: who wins the midterm rally — and who gets left behind?</h2>
  <p>A positive index return does not mean every industry gets a lift. The post-midterm pattern tells us <em>what the broad market has often done</em>; the election result could change <em>which sectors benefit</em>. Then inflation, earnings and interest rates decide whether that rotation actually survives.</p>
  <h3>First, define the three outcomes correctly</h3>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,215px),1fr))",gap:12,margin:"14px 0 20px"}}>
   <div style={{border:"1px solid var(--bb-card-border)",borderRadius:10,padding:15,background:"var(--bb-bg)"}}>
    <strong>Republican sweep of Congress</strong>
    <p style={muted}>Republicans retain the House and Senate. With Trump still president, this is policy continuity and more room for Republican legislation, not a new tax cut guaranteed on Election Day.</p>
   </div>
   <div style={{border:"1px solid var(--bb-card-border)",borderRadius:10,padding:15,background:"var(--bb-bg)"}}>
    <strong>Democratic sweep of Congress</strong>
    <p style={muted}>Democrats take both chambers, but Trump remains president. Oversight and budget leverage increase; his veto and Senate rules constrain tax, tariff and regulatory rewrites.</p>
   </div>
   <div style={{border:"1px solid var(--bb-card-border)",borderRadius:10,padding:15,background:"var(--bb-bg)"}}>
    <strong>Split Congress</strong>
    <p style={muted}>Each party controls one chamber. Large legislation becomes harder; targeted compromises, investigations and spending confrontations matter more.</p>
   </div>
  </div>
  <p><strong>The clock matters:</strong> voting is on <strong>3 November 2026</strong>, while the next Congress begins on <strong>3 January 2027</strong>. The first weeks of trading reprice expectations; they do not reflect new lawmakers having already enacted policy. Even a Democratic sweep would not itself reverse Trump's tariff programme ({source("https://www.reuters.com/legal/government/democratic-wins-would-shift-congress-trade-debate-fall-short-us-tariff-rollbacks-2026-11-01/","Reuters' 1 November trade-policy analysis")}).</p>

  <h3 style={{marginTop:29}}>Do the post-election returns depend on congressional control?</h3>
  <p>They differ in our historical sample, but there are only four elections in two of the groups. These are observations, <strong>not estimates of a partisan performance premium</strong>.</p>
  <div style={{overflowX:"auto",margin:"16px 0"}}>
   <table style={{borderCollapse:"collapse",minWidth:680,width:"100%",fontSize:13,fontVariantNumeric:"tabular-nums"}}>
    <thead><tr>
     <th scope="col" style={head}>Congress elected</th><th scope="col" style={{...head,textAlign:"right"}}>N</th>
     <th scope="col" style={{...head,textAlign:"right"}}>1 wk</th><th scope="col" style={{...head,textAlign:"right"}}>2 wk</th>
     <th scope="col" style={{...head,textAlign:"right"}}>1 mo</th><th scope="col" style={{...head,textAlign:"right"}}>6 mo</th><th scope="col" style={{...head,textAlign:"right"}}>12 mo</th>
    </tr></thead>
    <tbody>{HISTORY.map(row=><tr key={row.label}>
     <th scope="row" style={{...cell,fontWeight:600,textAlign:"left"}}>{row.label}</th>
     <td style={{...cell,textAlign:"right"}}>{row.sample}</td>
     <td style={{...cell,textAlign:"right"}}>{pct(row.week1)}</td>
     <td style={{...cell,textAlign:"right"}}>{pct(row.week2)}</td>
     <td style={{...cell,textAlign:"right"}}>{pct(row.month1)}</td>
     <td style={{...cell,textAlign:"right"}}>{pct(row.month6)}</td>
     <td style={{...cell,textAlign:"right"}}>{pct(row.month12)}</td>
    </tr>)}</tbody>
   </table>
  </div>
  <p style={muted}>S&amp;P 500 cumulative price returns, 1950–2022. Party labels describe the Congress elected at each midterm, not the president or government in office during the first weeks. Republican-both: 1994, 1998, 2002, 2014; split: 1982, 2010, 2018, 2022; all 11 other years were Democratic-both. Classifications cross-checked against {source("https://history.house.gov/Institution/Majority-Changes/Majority-Changes/","House history")} and {source("https://www.senate.gov/history/partydiv.htm","Senate party division")}; returns independently calculated from the same {source("https://site.financialmodelingprep.com/developer/docs/stable/index-historical-price-eod-light","FMP ^GSPC daily series")} and conventions as Part 1. Dividends excluded. Different presidential administrations, macro regimes and tiny subgroup sizes prevent a causal comparison.</p>
  <p>One curiosity: the four split-Congress elections averaged <strong>+2.19%</strong> after a week but <strong>−0.58%</strong> after two weeks. This is a useful reminder that relief rallies can be reversed. It is <em>not</em> a reliable forecast for a split result in 2026.</p>

  <h3 style={{marginTop:29}}>Which industries could outperform — or lose momentum?</h3>
  <div style={{overflowX:"auto",marginTop:16}}>
   <table style={{borderCollapse:"collapse",minWidth:800,width:"100%",fontSize:13}}>
    <thead><tr>
     <th scope="col" style={{...head,width:"18%"}}>Industry</th><th scope="col" style={{...head,width:"27%"}}>Republican sweep</th>
     <th scope="col" style={{...head,width:"27%"}}>Democratic sweep</th><th scope="col" style={{...head,width:"28%"}}>Split Congress</th>
    </tr></thead>
    <tbody>{SECTORS.map(s=><tr key={s.name}>
     <th scope="row" style={{...cell,fontWeight:650,textAlign:"left"}}>{s.name}</th><td style={cell}>{s.red}</td><td style={cell}>{s.blue}</td><td style={cell}>{s.split}</td>
    </tr>)}</tbody>
   </table>
  </div>
  <p style={{...muted,marginTop:12}}>These are conditional policy exposures, not modelled returns or guaranteed winners and losers. Existing EV and household clean-energy tax credit expiries were accelerated under the 2025 tax law ({source("https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb","IRS guidance")}). AI, data-centre power and healthcare policy can also invite bipartisan compromises ({source("https://www.morganstanley.com/insights/articles/midterm-election-market-implications-institute-2026","Morgan Stanley, 14 October")}; {source("https://www.wellsfargoadvisors.com/research-analysis/reports/policy/2026-midterms.htm","Wells Fargo, 15 October")}).</p>

  <h3 style={{marginTop:29}}>The real bull-trap question: what do yields and earnings do?</h3>
  <p><strong>Red sweep + rising Treasury yields:</strong> banks, energy and construction may initially outperform on a friendlier policy outlook. But larger expected deficits or an oil-driven inflation scare could raise discount rates, squeezing expensive technology even while regulation eases.</p>
  <p><strong>Democratic sweep + easing yields:</strong> greater scrutiny could weigh on some energy, finance and AI infrastructure names. Yet an easing rate backdrop might support long-duration technology valuations despite headlines about regulation.</p>
  <p><strong>Split Congress + tighter credit:</strong> gridlock might restrain ambitious legislation, but it cannot stop deteriorating corporate finances. If credit spreads widen and semiconductor leaders fail to reclaim their 200-day averages, the historic midterm rally may not be tradable.</p>
  <p><strong>What to watch by horizon:</strong> in <strong>week one</strong>, compare bank/energy/AI leadership with Treasury yields; in <strong>week two</strong>, test whether the initial relief holds; by <strong>month one</strong>, inspect breadth, high-yield spreads and earnings guidance. By <strong>months two to three</strong>, the new Congress and budget agenda begin to matter. By <strong>months four to twelve</strong>, actual legislation, rates, AI cash conversion and earnings revisions should matter much more than the election headline.</p>
  <p style={{...muted,marginTop:14}}><strong>Editorial assessment (2 November 2026, pre-election):</strong> the election can rearrange the winners without validating the entire market rally. SPY versus equal-weight breadth, SMH/SOXX versus the 200DMA, US two- and ten-year yields, high-yield credit spreads, DXY, oil and actual free cash flow are stronger confirmation checks than party colour alone. This is scenario analysis, not a verified outcome or investment instruction. See also {source("https://www.schwab.com/learn/story/what-2026-midterms-could-mean-markets","Schwab's 2026 midterm outlook")}.</p>
 </section>;
}
