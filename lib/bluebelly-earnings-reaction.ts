/**
 * A bounded, manually source-reviewed post-close market-reaction packet for
 * existing publicly readable earnings scorecards. Not a new ingestion engine,
 * a causal attribution engine, or canonical Evidence / Story admission.
 *
 * Future packets must satisfy the same time/source checks before rendering.
 * Never infer a company-specific cause from a percentage change alone.
 */
export type EarningsReactionPacket={
 id:string;ticker:string;sessionDay:string;availableAfter:string;
 regularClose:{usd:number;changePct:number;at:string;sourceUrl:string};
 extended:{usd:number;at:string;sourceUrl:string};
 companyFact:string;expectation:string;interpretation:string;countercase:string;nextTest:string;
 issuerUrl:string;reportingUrl:string;
 attribution:"REPORTED_INTERPRETATION"|"UNRESOLVED_CAUSE";
};
export type AuditedReaction=EarningsReactionPacket & {extendedChangePct:number};

const PACKETS:readonly EarningsReactionPacket[]=[
 {
  id:"intel-2026q3",ticker:"INTC",sessionDay:"2026-10-29",
  availableAfter:"2026-10-30T00:00:00Z",
  regularClose:{usd:92.07,changePct:-3.62,at:"2026-10-29T20:00:00Z",sourceUrl:"https://stockanalysis.com/stocks/intc/history/"},
  extended:{usd:70.90,at:"2026-10-29T23:59:00Z",sourceUrl:"https://stockanalysis.com/stocks/intc/history/"},
  issuerUrl:"https://www.intc.com/news-events/press-releases/detail/1786/intel-reports-third-quarter-2026-financial-results",
  reportingUrl:"https://www.reuters.com/business/intel-signals-slower-growth-pc-market-remains-under-pressure-2026-10-29/",
  companyFact:"Q3 revenue grew 21% to $16.5bn and adjusted EPS was $0.52, but Intel guided Q4 sales to $15–16bn and adjusted EPS to $0.25. Management cited continued PC weakness and a manufacturing disruption in Israel.",
  expectation:"Reuters reported roughly $17.07bn in analyst expectations for Q4 revenue, above Intel's $15.5bn guidance midpoint. This reported comparator is not an independently frozen, same-provider pre-release consensus dataset.",
  interpretation:"Reuters attributed the sharp post-close selloff to guidance below expectations, manufacturing/supply constraints and continuing cash spending. A better quarter did not resolve investors' forward-year concerns.",
  countercase:"The plant disruption may prove temporary; rapid server CPU demand and restored supply could improve cash generation. The relative contribution of each explanation to the share-price change cannot be measured.",
  nextTest:"Track Q4 delivered sales, cash usage, factory recovery and gross margin against the newly published guidance.",
  attribution:"REPORTED_INTERPRETATION"
 },
 {
  id:"amazon-2026q3",ticker:"AMZN",sessionDay:"2026-10-29",
  availableAfter:"2026-10-30T00:00:00Z",
  regularClose:{usd:243.79,changePct:-4.25,at:"2026-10-29T20:00:00Z",sourceUrl:"https://stockanalysis.com/stocks/amzn/history/"},
  extended:{usd:225.85,at:"2026-10-29T23:47:00Z",sourceUrl:"https://stockanalysis.com/stocks/amzn/"},
  issuerUrl:"https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/default.aspx",
  reportingUrl:"https://www.reuters.com/business/retail-consumer/amazon-projects-fourth-quarter-sales-below-estimates-2026-10-29/",
  companyFact:"AWS sales grew 39.3% to $46bn, but full-year 2026 cash capex was forecast at about $220bn. TRAILING-TWELVE-MONTH free cash flow was −$42.4bn, versus +$14.8bn a year earlier; it is not Q3 operating loss.",
  expectation:"Reuters/LSEG put Q4 revenue consensus at about $244.51bn versus Amazon's $240–247bn guidance (midpoint $243.5bn). This is reported pre-release expectation, not a fully reconciled historical analyst feed.",
  interpretation:"Reuters reported that the weaker holiday-quarter midpoint and AI infrastructure cash intensity overshadowed AWS growth. The central question was whether demand gains will ultimately earn enough after capital investment.",
  countercase:"AWS's 39.3% growth and rising operating profit could justify a front-loaded investment cycle; negative TTM free cash flow does not establish that AWS is unprofitable or AI demand is weak.",
  nextTest:"Compare AWS growth and group operating cash flow with Q4/2027 net cash capex, free cash flow and disclosed capacity commitments.",
  attribution:"REPORTED_INTERPRETATION"
 },
 {
  id:"sandisk-fy2027q1",ticker:"SNDK",sessionDay:"2026-10-29",
  availableAfter:"2026-10-30T00:00:00Z",
  regularClose:{usd:1330.05,changePct:-5.32,at:"2026-10-29T20:00:00Z",sourceUrl:"https://stockanalysis.com/stocks/sndk/history/"},
  extended:{usd:1279.49,at:"2026-10-29T23:59:00Z",sourceUrl:"https://stockanalysis.com/stocks/sndk/history/"},
  issuerUrl:"https://investor.sandisk.com/news-releases/news-release-details/sandisk-reports-fiscal-first-quarter-2027-financial-results",
  reportingUrl:"https://ca.investing.com/news/stock-market-news/why-is-sandisk-stock-sliding-today-93CH-4914583",
  companyFact:"Fiscal Q1 revenue was $11.031bn and non-GAAP EPS $49.51, with Q2 revenue guidance of $12.2–12.6bn and an announced 8-for-1 split. These results do not establish an earnings miss.",
  expectation:"Contemporaneous pre-release reporting cited about $10.7bn revenue and $46 in EPS expectations. These are attributed analyst figures, not a verified same-basis consensus-vintage comparison.",
  interpretation:"The regular-session 5.32% decline happened BEFORE the after-close results. Contemporaneous reporting described pre-earnings profit-taking, an exceptionally high expectations bar and broader memory-sector volatility; the later after-hours decline is observable but its specific cause remains unproved.",
  countercase:"Strong reported results and guidance could support future valuation if NAND prices, data-centre orders and cash conversion prove durable. Sector positioning or option-driven flows are plausible but have not been independently established.",
  nextTest:"Check the next completed cash session, relative MU/WDC performance, NAND pricing, segment margins and 8-for-1 split-adjusted comparisons.",
  attribution:"UNRESOLVED_CAUSE"
 }
];

/** Fail closed on malformed/unsourced clocks, implausible quote bases or future records. */
export function auditEarningsReaction(packet:EarningsReactionPacket,now=new Date()):{
 status:"ATTRIBUTED_REACTION"|"REACTION_ANALYSIS_INCOMPLETE";reaction:AuditedReaction|null;missing:string[];
}{
 const missing:string[]=[];
 const validUrl=(s:string)=>{try{const u=new URL(s);return u.protocol==="https:"&&!u.username&&!u.password;}catch{return false;}};
 const nowMs=+now,close=Date.parse(packet.regularClose.at),after=Date.parse(packet.extended.at),
  available=Date.parse(packet.availableAfter),day=Date.parse(packet.sessionDay+"T00:00:00Z");
 if(!Number.isFinite(nowMs)||!Number.isFinite(close)||!Number.isFinite(after)||
    !Number.isFinite(available)||!Number.isFinite(day)||nowMs<available||nowMs<after||
    nowMs-day>7*86400000||after<=close||after-close>24*3600000||
    new Date(close).toISOString().slice(0,10)!==packet.sessionDay||
    new Date(after).toISOString().slice(0,10)!==packet.sessionDay)
    missing.push("dated market-session chronology or public availability");
 if(!Number.isFinite(packet.regularClose.usd)||packet.regularClose.usd<=0||
    !Number.isFinite(packet.extended.usd)||packet.extended.usd<=0||
    !Number.isFinite(packet.regularClose.changePct)||Math.abs(packet.regularClose.changePct)>100)
    missing.push("comparable, positive USD quote and earlier-session change");
 for(const u of [packet.issuerUrl,packet.reportingUrl,packet.regularClose.sourceUrl,packet.extended.sourceUrl])
  if(!validUrl(u)){missing.push("original issuer, market quote and dated reporting source");break;}
 for(const field of [packet.companyFact,packet.expectation,packet.interpretation,packet.countercase,packet.nextTest])
  if(!field||field.length<45){missing.push("complete expected-versus-actual, interpretation, countercase and next-test analysis");break;}
 if(!["REPORTED_INTERPRETATION","UNRESOLVED_CAUSE"].includes(packet.attribution))
  missing.push("explicit causal uncertainty");
 if(missing.length)return {status:"REACTION_ANALYSIS_INCOMPLETE",reaction:null,missing};
 return {status:"ATTRIBUTED_REACTION",
   reaction:{...packet,extendedChangePct:Math.round((packet.extended.usd/packet.regularClose.usd-1)*10000)/100},
   missing:[]};
}
export function getDatedEarningsReaction(id:string,now=new Date()):AuditedReaction|null{
 if(!/^[a-z0-9-]{1,80}$/.test(id))return null;
 const packet=PACKETS.find(p=>p.id===id);
 return packet?auditEarningsReaction(packet,now).reaction:null;
}
