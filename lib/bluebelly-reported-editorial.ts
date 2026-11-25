import type {EditorialTopicId} from "./bluebelly-editorial-architecture.ts";

/**
 * Public, attributed reportage. Never promote this to SOURCE_VERIFIED, a
 * completed transaction or a canonical market cause. Expire from 48h lane.
 */
export type ReportedEditorial={
 id:string;headline:string;publishedAt:string;publisher:string;sourceUrl:string;
 reporting:string;why:string;countercase:string;nextTest:string;
 assetNames:readonly string[];
 kind?:"VERIFIED_INCIDENT"|"SERVICE_INCIDENT";
 topics?:readonly EditorialTopicId[];verificationLabel?:string;
 secondarySourceUrl?:string;secondarySourceName?:string;
};
const REPORTS:readonly ReportedEditorial[]=[
 {
 id:"xlk-critical-support-2026-11-25",
 headline:"XLK Is Nearly 10% Away From Critical Support",
 publishedAt:"2026-11-25T08:14:00.000Z",
 publisher:"AlchemyMarkets · Market analysis",
 sourceUrl:"https://www.reuters.com/business/media-telecom/global-markets-ai-cds-urgent-2026-11-25/",
 secondarySourceUrl:"https://www.goodman-macro.com/en/articles/20261125-main/",
 secondarySourceName:"24 November closing market data",
 verificationLabel:"DATED MARKET ANALYSIS · CONDITIONAL TECHNICAL LEVEL",
 topics:["ai","bonds","earnings","policy"],
 reporting:"Nvidia's board reinstated Jensen Huang as CEO on Monday, 23 November. Nvidia rose 31.5% and the technology ETF XLK rallied nearly 9%. On Tuesday XLK fell 3.26% to $157.09 and Nvidia fell 5.86%, even as nine of eleven sector ETFs advanced. Healthcare gained 2.95%, staples 1.66% and real estate 1.31%. Reuters reported renewed record five-year credit default swap spreads for several AI-linked borrowers, including Oracle and CoreWeave. A leadership crisis may have ended, but the financing question remains.",
 why:"Nvidia supplies chips to cloud and AI infrastructure operators; Oracle provides cloud computing and CoreWeave rents GPU capacity. Higher borrowing costs could constrain those buyers' capital expenditure and eventually affect semiconductor suppliers. The wider sector gains suggest rotation rather than indiscriminate equity selling. On the AlchemyMarkets logarithmic chart dated 25 November, XLK has returned inside its ascending channel from late 2022. The channel midpoint near $142.66 is 9.2% below the 24 November close and 6.9% below the chart's $153.24 overnight quote; it is a conditional technical support area, not a forecast.",
 countercase:"XLK remains approximately 5.4% above its 20 November close after the two sessions. Issuer-specific credit stress does not establish a broad corporate credit crisis, and one session of sector divergence does not prove lasting rotation or fund flows. The rising channel midpoint moves over time and a historical support test does not guarantee another bounce.",
 nextTest:"Watch the 25 November US PCE release and subsequent yield response, matched semiconductor and XLK closing returns, and broader corporate credit spreads. If XLK approaches $142.66, look for renewed buying pressure and stabilising semiconductor leadership; a decisive break below the midpoint raises the risk of a deeper correction towards the lower channel boundary.",
 assetNames:["XLK","NVDA","MU","INTC","ORCL","CRWV","SMH","SPY"],
 },
 {
 id:"anthropic-ipo-pricing-debut-2026-11-19",
 headline:"Anthropic prices at $83; first trade jumps, then AI risk appetite cools",
 // Conservative availability gate: dated 19 Nov intraday reporting, not an exchange execution clock.
 publishedAt:"2026-11-19T18:24:00.000Z",
 publisher:"Anthropic · SEC final pricing communication · 18 November 2026",
 sourceUrl:"https://www.sec.gov/Archives/edgar/data/2130357/000162828026074937/anthropicpbc-fwppricing.htm",
 secondarySourceUrl:"https://www.stocktitan.net/articles/stock-market-today-live-november-19-2026",
 secondarySourceName:"Stock Titan · 19 November intraday market reporting",
 verificationLabel:"SEC OFFER PRICING · REPORTED INTRADAY TAPE",
 topics:["ai","earnings"],
 reporting:"Anthropic priced 980m base shares at $83, implying $81.34bn of gross offering value, of which $79.377bn is gross primary issuance. A separate $26bn committed private placement brings the combined gross base offering and placement to $107.34bn before fees; this is not net cash received. Closing was scheduled for 20 November subject to conditions. Reported first trade was $111.50 (+34.3% versus offer); at the 13:04 ET observation ANT was $95.80 (+15.4% versus offer) and QQQ was down 1.14% versus prior close. These are dated intraday reports, not closing prices or matched event returns.",
 why:"The offering tests whether public capital can absorb AI-model development and compute funding at scale. An above-offer debut alongside fading intraday gains and weaker technology equities points to a useful research question about the breadth of investor appetite, not an established causal transmission from Anthropic to QQQ.",
 countercase:"A first-day reversal from the opening trade does not erase the premium to the offer; QQQ's prior-close comparison has a different base. Financing size is not operating profitability or evidence that settlement happened. The 147m-share underwriter option remains contingent.",
 nextTest:"Verify closing and actual net proceeds from issuer filings, option exercise and private placement completion. Compare final session and subsequent dated ANT, QQQ and SMH returns on comparable bases; revisit compute commitments and cash conversion.",
 assetNames:["ANT","QQQ","SMH","AI INFRASTRUCTURE"],
 },
 {
 id:"freddie-mac-mortgage-rate-2026-11-19",
 headline:"US 30-year mortgage rate rises to 7.28%, ending four weeks of declines",
 // Date-qualified weekly survey; conservative publication availability gate.
 publishedAt:"2026-11-19T18:24:00.000Z",
 publisher:"Freddie Mac · Primary Mortgage Market Survey · week of 19 November 2026",
 sourceUrl:"https://www.freddiemac.com/pmms",
 verificationLabel:"OFFICIAL FREDDIE MAC RELEASE · WEEKLY RATE",
 topics:["bonds"],
 reporting:"Freddie Mac's 19 November weekly survey puts the average US 30-year fixed mortgage rate at 7.28%, up from 7.11% the preceding week (17 basis points). This ends four consecutive weekly declines. The survey is a national weekly average, not a live mortgage quote or a Federal Reserve policy-rate change.",
 why:"Higher borrowing costs can strain housing affordability and slow mortgage demand and housing-related spending. The transmission depends on long Treasury yields, mortgage spreads, household income and purchase prices; monitor those independently.",
 countercase:"One weekly increase does not establish a new rate trend or an immediate fall in housing activity. Mortgage rates can move differently from the federal funds rate.",
 nextTest:"Compare the next PMMS observation, dated Treasury yields and mortgage spreads, purchase applications and housing activity. Do not infer a same-day asset-price cause from this weekly survey.",
 assetNames:["XHB","TLT","XLF"],
 },

 {
 id:"nvidia-ceo-transition-sec-2026-11-12",
 headline:"Nvidia confirms Huang exit; Kress takes interim CEO role ahead of earnings",
 // SEC 8-K accepted 12 Nov 08:52:41 UTC; underlying resignation effective 11 Nov.
 publishedAt:"2026-11-12T08:52:41.000Z",
 publisher:"Nvidia · Form 8-K Item 5.02 · filed 12 November 2026",
 sourceUrl:"https://www.sec.gov/Archives/edgar/data/1045810/000104581026000082/nvda-20261111.htm",
 secondarySourceUrl:"https://www.sec.gov/Archives/edgar/data/1045810/000104581026000082/nvidiaannouncesceotransiti.htm",
 secondarySourceName:"Nvidia · official CEO-transition announcement",
 verificationLabel:"OFFICIAL SEC FILING · LEADERSHIP TRANSITION",
 topics:["ai","earnings"],
 reporting:"Nvidia's SEC filing says the board accepted Jensen Huang's resignation as president, CEO and director effective 11 November. CFO Colette Kress became interim CEO while a permanent search proceeds; Nvidia appointed Harvey Jones chair. Its third-quarter fiscal 2027 results are scheduled for 17 November. The filing establishes the leadership change, NOT the cause of any personal allegations circulating online.",
 why:"The investable disagreement is whether loss of a founder changes customer purchasing, CUDA adoption, export strategy or capital allocation, even if signed demand and technical roadmaps persist. Separate a governance-risk discount from an actual deterioration in chip orders, gross margins or cash generation. Creator transcript arguments about the 'bank versus banker' and a technical capitulation are research hypotheses, not proof of causality.",
 countercase:"The official announcement says senior leadership expects operations and customer commitments to continue. A sharp share-price decline would not by itself prove a weaker AI demand outlook, and rebound speculation is not a validated price signal. Personal claims and analyst target-change numbers require their own sources.",
 nextTest:"Review Nvidia's 17 November earnings release, customer commitments, gross-margin and free-cash-flow guidance, CFO/board continuity and official policy developments. Compare dated NVDA, SMH, QQQ and major hyperscaler returns on matched sessions; check any claimed volume record against exchange series.",
 assetNames:["NVDA","SMH","QQQ","MSFT","GOOGL"],
 },
 {
 id:"fermi-hyperscaler-600mw-sec-2026-11-12",
 headline:"Fermi secures $200m power-development commitment, not a final AI lease",
 // Fermi's dated 12 Nov 07:00 EST release = 12:00 UTC.
 publishedAt:"2026-11-12T12:00:00.000Z",
 publisher:"Fermi Inc. · Q3 2026 issuer exhibit filed with SEC",
 sourceUrl:"https://www.sec.gov/Archives/edgar/data/2071778/000121390026118351/ea031197701ex99-1.htm",
 secondarySourceUrl:"https://www.ft.com/content/692fbfe8-da52-42c0-b436-9c4aff21fbdb",
 secondarySourceName:"Financial Times · reports Amazon as counterparty; company did not name it",
 verificationLabel:"ISSUER SEC EXHIBIT · FINAL LEASE PENDING",
 topics:["ai","energy","earnings"],
 reporting:"Fermi announced agreements with an unnamed investment-grade hyperscaler to advance 600 MW of power capacity at Project Matador beginning in 2027. The filings describe a $200m prepayment agreement, a $15m early-construction agreement and a further roughly $90m materials agreement still being finalised. The underlying hyperscaler letter of intent is non-binding and a definitive long-term lease is outstanding. Fermi also reported termination of the TensorWave lease and associated AMD credit support.",
 why:"A customer funding development early is evidence of demand for scarce, power-ready AI sites, but 600 MW of proposed capacity is not 600 MW of delivered or revenue-producing compute. Fermi was pre-revenue, with $315.5m in cash/restricted cash and $958.4m in net debt at 30 September. The investment test is tenant binding, financing, permits and timely energisation versus cash burn.",
 countercase:"A large signed development prepayment is economically meaningful and can ease near-term financing; however the counterparty name is undisclosed in Fermi's filing, and the Financial Times identification remains attributed reporting. Another terminated lease underscores execution risk. Do not label future capacity as operational or claim the $90m agreement has closed.",
 nextTest:"Check execution of the definitive 600 MW lease, evidence the prepayment was actually received, financing and land-lease milestones, permits, commissioning milestones and subsequent SEC cash/debt disclosures. Reconcile the reported Amazon name with a named filing before treating it as company-confirmed.",
 assetNames:["FRMI","AMZN","AMD","AI INFRASTRUCTURE"],
 },
 {
 id:"bahrain-drones-hormuz-conflicting-claims-2026-11-13",
 kind:"VERIFIED_INCIDENT",
 headline:"US reports intercepting Iranian drones; Hormuz attack claims remain disputed",
 // Source-date marker: 13 Nov 04:09 EST syndication of AP reporting; NOT a precise attack clock.
 publishedAt:"2026-11-13T09:09:00.000Z",
 publisher:"Associated Press · 13 November 2026 conflict reporting",
 sourceUrl:"https://apnews.com/article/5d73a23b5b8647d2515c35b267b36c08",
 secondarySourceUrl:"https://www.washingtonpost.com/national/2026/11/13/iran-us-bahrain-radar-strait-hormuz/760c7b46-df39-11f1-912c-4fbb80d73f7f_story.html",
 secondarySourceName:"Associated Press syndicated reporting · 13 November",
 verificationLabel:"AP-REPORTED INCIDENT · RIVAL CLAIMS UNVERIFIED",
 topics:["energy","policy","bonds"],
 reporting:"AP reported US military officials said two Iranian attack drones headed towards Bahrain were intercepted without injury or damage. Iran claimed its forces hit a US early-warning radar in Bahrain and that a liquefied petroleum gas tanker struck a mine in Hormuz; the US rejected the radar claim and the reported tanker strike was not independently verified. Iran also said it could not resume nuclear monitoring talks under military threat.",
 why:"Physical tanker passages, war-risk premiums, insurance, LNG/LPG and refined-product flows matter more for oil and inflation than a social-media escalation headline. Distinguish an intercepted attack from a successful radar strike, and a mine allegation from an identified damaged ship. The same distinction applies before repricing inflation or shipping assumptions.",
 countercase:"Credible interception reporting does not prove sustained disruption to the strait, and US denial does not independently settle every allegation. Crude and fuel price moves need matched market data and physical-flow confirmation, not chronology alone.",
 nextTest:"Check CENTCOM/Bahrain, IRNA/IAEA, UKMTO vessel notices, AIS passage volumes and dated freight/insurance quotes. Reassess crude, distillate and inflation channels only with physical confirmation.",
 assetNames:["BRENT","WTI","USO","TLT"],
 },
 {
 id:"microsoft-365-service-incident-2026-11-12",
 kind:"SERVICE_INCIDENT",
 headline:"Microsoft 365 outage: patch stabilises servers, final cause pending",
 // Source clock: Microsoft EX1550543 update at 08:06:25 UTC, 13 November.
 // This is not the start of the incident or a completion-of-recovery timestamp.
 publishedAt:"2026-11-13T08:06:25.000Z",
 publisher:"Microsoft 365 service-health advisory EX1550543 · PennO365 mirror",
 sourceUrl:"https://mailservices.isc.upenn.edu/computing/email/penno365/alerts/ms-incidents.html",
 secondarySourceUrl:"https://apnews.com/article/d92547a821930290db2964388016979a",
 secondarySourceName:"Associated Press · 13 November 2026",
 reporting:"A widespread Exchange Online connectivity incident began on 12 November, disrupting Outlook mailbox access and some Microsoft 365 functions. Microsoft's EX1550543 advisory on 13 November said an upstream authentication/routing configuration-component patch improved stability and was being deployed more broadly. Services were recovering unevenly, with intermittent access and delayed emails still reported. Microsoft said it was not aware of malicious activity causing the incident. Its final root-cause report was not yet available.",
 why:"A shared connection and routing layer can affect millions of organisations without a separate failure at each customer. Microsoft reported that unavailable servers shifted traffic onto surviving capacity, while the process establishing secure connections became overwhelmed. The investment question is whether recovery holds and whether repeated reliability problems produce credits, remediation costs or customer churn. This event alone does not establish a change in Azure demand, profitability or MSFT's fair value.",
 countercase:"The sequence is consistent with an internal infrastructure or configuration failure, but Microsoft's full post-incident report is pending. A correlated network change is not by itself a proven root cause. No evidence currently establishes a cyberattack, expired physical chips or expired security certificates. The share-price move cannot be assigned solely to this outage without a matched market/sector comparison.",
 nextTest:"Check Microsoft's EX1550543 and MO1550821 advisories for verified full resolution, then the promised post-incident report for root cause and prevention changes. Track service-credit or customer-impact disclosures; compare MSFT against QQQ and IGV over matching sessions; separately assess Azure growth and capital expenditure against cash generation at the next earnings release.",
 assetNames:["MSFT","IGV","QQQ"],
 },
 {
 id:"binance-security-incident-2026-10-30",
 kind:"VERIFIED_INCIDENT",
 headline:"Bitcoin tumbles after Binance details $6.3bn security incident",
 // Reuters' dated 29 Oct 20:38 ET market report; this is the earliest cited reporting clock,
 // NOT a claimed exact timestamp for Binance's subsequently published statement.
 publishedAt:"2026-10-30T00:38:00.000Z",
 publisher:"Binance · official security bulletin dated 30 October 2026",
 sourceUrl:"https://www.binance.com/zh-CN/support/announcement/detail/c5a8729a97ac486d963784d96c5642d7",
 secondarySourceUrl:"https://www.reuters.com/technology/bitcoin-cryptocurrency-prices-fall-after-binance-reports-security-issue-2026-10-30/",
 secondarySourceName:"Reuters · 30 October reported cryptocurrency reaction",
 reporting:"Binance says its initial investigation points to a possibly compromised DevOps laptop that enabled unauthorised withdrawal transactions. It estimates a $6.3bn total impact, with about $3bn frozen on-chain. The exchange says it found no evidence of a wallet private-key leak and promises to cover user losses with SAFU and company funds. Separately, Reuters reported that Bitcoin had fallen to a six-week low of $77,646, Ether to $2,238.76 and BNB was down more than 8% in its market snapshot. These are historical observations, not live quotes or a measured event-window attribution.",
 why:"The estimated $6.3bn impact is NOT a confirmed final cash loss. Assets frozen on-chain are not necessarily recovered and returned. Exchange liquidity, customer confidence, SAFU coverage and the knock-on effect for BTC, ETH and BNB are the economic questions. A wider technology-stock sell-off is a possible additional pressure, not proof the incident caused every crypto decline.",
 countercase:"Binance says user funds are safe and losses will be covered. Its initial forensic explanation and final net loss remain subject to investigation. The frozen amount could change; crypto prices were also exposed to broader risk-off selling.",
 nextTest:"Check Binance's official deposit/withdrawal restoration and revised proof of reserves, any independently confirmed recoveries and verified changes to the total impact. Compare dated BTC/USD, ETH/USD and BNB observations against the wider Nasdaq/risk-off tape before assigning causality.",
 assetNames:["BTCUSD","ETHUSD","BNB"],
 },
 {
 id:"tpg-ark-talks-2026-10-28",
 headline:"Report: TPG in talks to buy UK data-centre group Ark for about $5bn",
 publishedAt:"2026-10-28T06:13:00.000Z",
 publisher:"Reuters report citing Financial Times · not company-confirmed",
 sourceUrl:"https://live.euronext.com/en/financial-news/tpg-pursues-5-billion-acquisition-british-data-centre-group-ark-ft-reports",
 reporting:"Reuters relayed Financial Times reporting that TPG was discussing buying Ark Data Centres from Elliott Management at a valuation around $5bn. Reuters stated it could not independently verify the report; discussions were ongoing and a transaction was not guaranteed.",
 why:"In the deal story, the important number is an indicative enterprise valuation, not realised proceeds or a signed transaction. The test is whether an acquisition agreement, financing structure and EBITDA/capacity economics emerge.",
 countercase:"Talks may end without a deal, the headline valuation may change, and the companies have not confirmed a signed transaction.",
 nextTest:"Look for a dated exchange filing or original buyer/seller release before calling it a deal. Do not assert price moves were caused by these talks.",
 assetNames:["TPG","AI INFRASTRUCTURE"],
 }
] as const;
export function recentReportedEditorial(now:Date,hours=48){
 const t=now.getTime();
 if(!Number.isFinite(t)||!Number.isInteger(hours)||hours<1||hours>168)return [];
 return REPORTS.filter(r=>t>=Date.parse(r.publishedAt)&&t-Date.parse(r.publishedAt)<=hours*3600000);
}
export function reportedEditorialById(id:string,now:Date){
 if(!/^[a-z0-9-]{1,80}$/.test(id))return null;
 return recentReportedEditorial(now,168).find(x=>x.id===id)||null;
}
