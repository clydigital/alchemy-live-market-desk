/**
 * A dated editorial original-source snapshot, NOT an automatically ingested
 * NewsBrief or a private research/adjudication promotion.
 * These immutable decisions are source-checked and disappear from the 48h
 * recent tape when their verified release instant ages out.
 */
export type BankDecisionSnapshot={
 id:string;headline:string;bank:string;countryCode:"US"|"CA"|"NZ"|"AU"|"SE";sourceUrl:string;sourceName:string;
 releaseAt:string;observedStatement:string;expectedStatus:string;
 financialMechanism:string;alternative:string;nextTest:string;
 affectedAssets:readonly string[];rateLabel:string;decision:string;
};
const SNAPSHOTS:readonly BankDecisionSnapshot[]=[
 {
 id:"riksbank-2026-11-04",bank:"Sveriges Riksbank",countryCode:"SE",
 headline:"Riksbank raises policy rate 25bp to 2% as energy pressures build",
 releaseAt:"2026-11-04T08:30:00.000Z",
 sourceUrl:"https://www.riksbank.se/en-gb/press-and-published/notices-and-press-releases/press-releases/2026/policy-rate-raised-to-2-per-cent/",
 sourceName:"Sveriges Riksbank · 4 Nov policy statement",
 decision:"HIKE +25bp",rateLabel:"2.00%",
 observedStatement:"The bank raised its policy rate by 25bp from 1.75% to 2%, effective 11 November. Stronger domestic activity, Middle East energy costs and persistent inflation pressure support further possible hikes, conditional on the forecast. This Monetary Policy Update contains no new full forecast.",
 expectedStatus:"No original-source-matched frozen pre-decision consensus/OIS price has been validated. Do not assert a surprise from a hike alone.",
 financialMechanism:"Swedish borrowing costs and the SEK rate differential can change even as US yields fall; energy-related supply costs differ from the US political-growth shock.",
 alternative:"An anticipated hike and uncertainty around growth or imported inflation can offset the mechanical SEK rate differential.",
 nextTest:"Check dated SEK and Sweden 2-year yield before and after the original 09:30 CET release, consensus basis, CPIF and the 5 November BoE decision.",
 affectedAssets:["SEK","SE02Y","EURSEK"],
 },

 {
 id:"rba-2026-11-03",bank:"Reserve Bank of Australia",countryCode:"AU",
 headline:"RBA raises cash rate 25bp to 4.85% in a 6–3 vote",
 releaseAt:"2026-11-03T03:30:00.000Z",
 sourceUrl:"https://www.rba.gov.au/media-releases/2026/mr-26-30.html",
 sourceName:"Reserve Bank of Australia · 3 November Monetary Policy Board statement",
 decision:"HIKE +25bp",rateLabel:"4.85%",
 observedStatement:"The Monetary Policy Board raised the cash rate target by 25bp from 4.60% to 4.85%. Six members voted for the increase; three preferred to leave it at 4.60%. The Bank raised its inflation forecasts, expecting inflation to remain elevated through much of 2027, while acknowledging slower demand, falling housing prices and rising unemployment.",
 expectedStatus:"PRE-RELEASE EXPECTATION (2 November, SECONDARY-ATTRIBUTED): InvestingLive attributed to a Reuters survey that 31 of 32 economists expected a 25bp rise to 4.85%, with one predicting a hold. ACTUAL (3 November, OFFICIAL): +25bp to 4.85%, matching that reported majority economist forecast. The 6–3 vote and removal of explicit tightening bias affect the next-decision debate. The original Reuters poll and a frozen, directly observed OIS probability are not independently attached; the exact market-priced surprise is unknown.",
 financialMechanism:"Higher short rates feed through to variable-rate household mortgages, refinancing and business borrowing costs as lenders pass them on, weighing on discretionary demand and financing-sensitive property. Savers can benefit from higher deposit returns if banks reprice them. The 6–3 vote and lack of a firm further-hike commitment may matter more to AUD and front-end yields than an already widely expected 25bp increase. These are economic channels, not independently measured event-window asset moves.",
 alternative:"A rate increase need not produce a lasting AUD rally if traders already expected it or if the Bank's forecasts increase concerns about growth and household demand.",
 nextTest:"Compare AUD/USD, Australian 2-year yields and interbank-rate pricing before and after the official 14:30 AEDT release, using matching timestamps. Then compare the November inflation forecasts with August; do not assert a price reaction without observations.",
 affectedAssets:["AUDUSD","AU02Y","ASX"],
 },
 {
 id:"fed-2026-10-28",bank:"Federal Reserve",countryCode:"US",headline:"Fed holds at 3.75–4.00%; two officials wanted a hike",
 releaseAt:"2026-10-28T18:00:00.000Z",
 sourceUrl:"https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm",
 sourceName:"Federal Reserve · 28 October FOMC statement",decision:"HOLD",rateLabel:"3.75–4.00%",
 observedStatement:"The FOMC maintained the federal funds target range at 3.75–4.00%, by a 10–2 vote. Cook and Hammack preferred a 25bp increase. The statement described economic activity as expanding at a strong pace while inflation remained elevated.",
 expectedStatus:"No source-matched pre-release futures probability is attached; a rate hold alone does not establish a surprise.",
 financialMechanism:"The market question is not merely whether the Fed held. A divided vote and a stronger economic assessment can shift the path traders price for future short-term rates, then the dollar and risk assets.",
 alternative:"A hold can also signal caution while the Fed awaits data. Do not infer a sustained yield or USD move without timestamped before-and-after observations.",
 nextTest:"Check the US 2-year yield and DXY before and after 14:00 ET, plus the statement versus the prior meeting. Confirm whether the hawkish dissent altered priced policy expectations.",
 affectedAssets:["US02Y","DXY","SPX","GOLD"],
 },
 {
 id:"boc-2026-10-28",bank:"Bank of Canada",countryCode:"CA",headline:"Bank of Canada raises rates 25bp to 2.50%",
 releaseAt:"2026-10-28T13:45:00.000Z",
 sourceUrl:"https://www.bankofcanada.ca/2026/10/fad-press-release-2026-10-28/",
 sourceName:"Bank of Canada · 28 October policy statement",decision:"HIKE +25bp",rateLabel:"2.50%",
 observedStatement:"The Bank raised its overnight target by 25bp from 2.25% to 2.50%. Its Monetary Policy Report projects inflation around 3% for much of 2027, returning close to 2% in mid-2028.",
 expectedStatus:"A source-matched pre-release overnight-indexed-swap probability is unavailable; the hike is confirmed, its degree of surprise is not.",
 financialMechanism:"A higher policy rate raises Canada's short-rate anchor and can support CAD through the Canada–US rate differential, but tighter borrowing costs also challenge domestic demand.",
 alternative:"If the hike was fully anticipated, the CAD reaction can depend more on the forward guidance and global USD moves than on the 25bp headline.",
 nextTest:"Compare Canadian 2-year yields and USD/CAD on the 09:45 ET release clock; then read the MPR inflation and growth forecast revisions.",
 affectedAssets:["USDCAD","CA02Y","DXY"],
 },
 {
 id:"rbnz-2026-10-28",bank:"Reserve Bank of New Zealand",countryCode:"NZ",headline:"RBNZ holds at 2.75% in a narrow 4–3 vote",
 releaseAt:"2026-10-28T01:00:00.000Z",
 sourceUrl:"https://www.rbnz.govt.nz/news-and-events/news/2026/10/ocr-held-at-2-75-percent",
 sourceName:"RBNZ · Monetary Policy Review and meeting record",decision:"HOLD",rateLabel:"2.75%",
 observedStatement:"The RBNZ held the Official Cash Rate at 2.75% by four votes to three; three members preferred a 25bp increase. Annual inflation was 3.7% in September, with 4.4% forecast for December largely on fuel-price assumptions.",
 expectedStatus:"The decision is documented; no matched pre-release rate-implied hike probability is attached, so a surprise label cannot be quantified.",
 financialMechanism:"The committee is balancing cost-driven inflation against a weak domestic recovery. Relative NZD interest-rate expectations can shift even when the headline rate remains fixed.",
 alternative:"Keeping rates unchanged is not proof of a dovish pivot: all members saw tighter policy as likely, subject to the inflation and demand outlook.",
 nextTest:"Watch New Zealand front-end yields and NZD/USD on matched release timestamps. The next stated OCR decision is 9 December 2026.",
 affectedAssets:["NZDUSD","NZ02Y","DXY"],
 }
] as const;
export const BANK_DECISION_LOOKBACK_HOURS=48;
export function recentBankDecisions(now:Date,lookbackHours=48){
 const t=now.getTime();
 if(!Number.isFinite(t)||!Number.isInteger(lookbackHours)||lookbackHours<1||lookbackHours>168)return [];
 return SNAPSHOTS.filter(x=>t>=Date.parse(x.releaseAt)&&t-Date.parse(x.releaseAt)<=lookbackHours*3600000)
  .sort((a,b)=>Date.parse(b.releaseAt)-Date.parse(a.releaseAt));
}
export function bankDecisionById(id:string,now:Date){
 if(!/^[a-z0-9-]{1,70}$/.test(id))return null;
 return recentBankDecisions(now,168).find(x=>x.id===id)||null;
}
