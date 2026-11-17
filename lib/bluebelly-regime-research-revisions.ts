import type {EditorialRegimeId} from "./bluebelly-editorial-architecture.ts";
import {projectQuestionAssessment,type QuestionRecord,type QuestionRevision,type QuestionSource} from "./bluebelly-question-assessment.ts";

// A dated source review in the existing editorial question model. This is not a
// new ingest stream or a mutation of the canonical Regime/Story verdict.
const IEA:QuestionSource={name:"IEA November oil market report",url:"https://www.iea.org/reports/oil-market-report-november-2026",publishedOn:"2026-11-13"};
const WCS:QuestionSource={name:"Reuters / CalRock, WCS differential",url:"https://boereport.com/2026/11/16/discount-on-western-canada-select-widens-64/amp/",publishedOn:"2026-11-16",note:"Heavy crude grade/location, not the entire global crude market"};
const CHINA:QuestionSource={name:"Reuters / Chinese customs October imports",url:"https://www.reuters.com/business/energy/chinas-october-crude-oil-imports-rise-highest-level-since-march-amid-middle-east-2026-11-10/",publishedOn:"2026-11-10"};
const STORAGE:QuestionSource={name:"Reuters / China implied crude storage",url:"https://www.reuters.com/commentary/reuters-open-interest/china-resumes-storing-crude-oil-giving-it-fuel-export-options-2026-11-16/",publishedOn:"2026-11-16",note:"Calculated balance, not measured strategic reserve level"};
const NBS:QuestionSource={name:"China NBS October activity",url:"https://www.stats.gov.cn/english/PressRelease/202611/t20261116_1965843.html",publishedOn:"2026-11-16"};
const IPO:QuestionSource={name:"WSJ / prospective Anthropic IPO repricing",url:"https://www.wsj.com/finance/anthropic-plans-to-raise-ipo-price-after-strong-demand-1a6b0af1",publishedOn:"2026-11-17",note:"Reported proposal, not final price or completed listing"};
const SEC:QuestionSource={name:"Anthropic SEC prospectus",url:"https://www.sec.gov/Archives/edgar/data/2130357/000162828026073040/anthropicpbc-fwpxeeaprospea.htm",publishedOn:"2026-11-11",note:"Prospectus terms, not final public-offering price"};
const NVDA:QuestionSource={name:"NVIDIA earnings-call announcement",url:"https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Sets-Conference-Call-for-Third-Quarter-Financial-Results/",publishedOn:"2026-10-28",note:"Schedule reference checked on 17 Nov, results not yet included"};
const NVDA_TRANSITION:QuestionSource={name:"NVIDIA CEO transition filing",url:"https://d18rn0p25nwr6d.cloudfront.net/CIK-0001045810/2bc9480b-60a6-4d8a-90cb-87190f804a3b.pdf",publishedOn:"2026-11-12"};
const NVDA_SI:QuestionSource={name:"MarketBeat NVIDIA reported short interest",url:"https://www.marketbeat.com/stocks/NASDAQ/NVDA/short-interest/",publishedOn:"2026-10-30",note:"Settlement date, not live observation; 279.58m shares / 1.21% float"};
const QUAISE:QuestionSource={name:"Quaise / Google 50 MW PPA",url:"https://www.quaise.com/news/quaise-energy-signs-50-mw-geothermal-power-purchase-agreement-with-google",publishedOn:"2026-11-17"};
const NBR:QuestionSource={name:"Nabors / Quaise strategic investment",url:"https://investor.nabors.com/2026-08-27-Nabors-Expands-Geothermal-Growth-Platform-with-35-Million-Strategic-Investment-in-Quaise-Energy",publishedOn:"2026-08-27"};
const CPI:QuestionSource={name:"BLS October CPI",url:"https://www.bls.gov/news.release/archives/cpi_11102026.htm",publishedOn:"2026-11-10"};
const CYBER:QuestionSource={name:"Report URI / Optimizely malware investigation",url:"https://blog.report-uri.com/worlds-largest-brands-infected-with-malware-via-optimizely/",publishedOn:"2026-11-16"};
const CYBER2:QuestionSource={name:"Reuters / website supply-chain compromise",url:"https://www.reuters.com/legal/government/popular-websites-subverted-bid-steal-crypto-target-iphone-users-2026-11-17/",publishedOn:"2026-11-17"};
const NSA:QuestionSource={name:"CNN / NSA Net outage",url:"https://www.kq2.com/cnn/cnn-national/2026/11/17/exclusive-highly-classified-us-national-security-communications-network-goes-down-sources-say/",publishedOn:"2026-11-17",note:"No evidence of a cyberattack reported at that time"};
const FAA:QuestionSource={name:"FAA nationwide ground stop Q&A",url:"https://www.faa.gov/newsroom/nationwide-ground-stop-questions-and-answers",publishedOn:"2026-11-15",note:"Telecommunications failure; no indicated cyber cause"};
const sourceThrough=(sources:readonly QuestionSource[])=>sources.map(s=>s.publishedOn).sort().at(-1)!;
type LensReview={lenses:readonly EditorialRegimeId[];record:QuestionRecord;ideas:string};
const review=(id:string,lenses:readonly EditorialRegimeId[],question:string,scope:string,horizon:string,verdict:QuestionRevision["verdict"],condition:string,why:string,countercase:string,nextTest:string,ideas:string,sources:readonly QuestionSource[]):LensReview=>({lenses,ideas,record:{id,question,scope,horizon,comparison:"Against the latest dated evidence; not a live price reading",authority:"SOURCE_REVIEWED_PROVISIONAL",expiresAfterDays:id==="ai-earnings-gate"?1:id==="ai-capital-demand"||id==="cyber-resilience"?2:7,revisions:[{revisionId:id+"-2026-11-17",reviewedOn:"2026-11-17",sourceThrough:sourceThrough(sources),verdict,condition,why,countercase,nextTest,sources}]}});

export const REGIME_RESEARCH_REVISIONS:readonly LensReview[]=[
 review("crude-glut",["energy"],"Is physical crude scarcity easing?","Crude availability, not diesel or LNG","Q4 2026 into 2027","improving",
  "Crude balance loosening; heavy grades show the clearest surplus pressure.",
  "IEA forecasts a Q4 surplus of about 1.7m b/d. October observed stocks rose 52m barrels, with oil afloat up 86m; WCS discount was $26.95 on 16 Nov versus a reported long-run average near $17. This weakens the blanket oil-war-premium thesis.",
  "The implied onshore draw was 34m barrels; oil afloat is not readily delivered supply. Gulf exports excluding Oman were still 26% below prewar in the IEA report. A heavy-grade discount can reflect local refinery or freight constraints. A renewed disruption or OPEC+ cut could reverse crude weakness.",
  "Check physical Brent versus futures, prompt spreads, WCS differential, EIA land stocks and verified Hormuz cargo arrivals; watch OPEC+ on 29 Nov. Do not equate a political claim of normalisation with delivered volumes.",
  "Conditional watch: VLO/MPC/PSX if cheap feedstock and product cracks persist; CNQ/CVE upstream realisations at risk; XOM/CVX more diversified but sensitive to crude. No blanket energy long.",[IEA,WCS]),
 review("refined-products",["energy"],"Is refined-fuel and fertiliser supply stress easing?","Diesel, LPG, gas feedstock and urea—not crude futures","Next 1–3 months","mixed",
  "Crude glut and refined-product shortages can coexist.",
  "IEA reports refined-product and LPG Gulf exports around half prewar levels; European diesel near $180/bbl, 77% above prewar. Refining margins can benefit when crude feedstock cheapens while diesel stays scarce. Nitrogen economics are driven by gas and ammonia/urea flows, not crude alone.",
  "Refinery output and delivered products may recover; high prices compress demand. No verified broad food shortage or current urea supply deficit is established by the oil data alone.",
  "Monitor diesel cracks, IEA product exports, EIA distillate stores, Henry Hub vs European gas, urea import tenders and actual fertiliser inventories/application. Reassess on normalising cracks or deteriorating crop demand.",
  "VLO/MPC/PSX; CF and NTR only if nitrogen margins and export constraints confirm; MOS is phosphate/potash exposure, not a pure urea play. Food-processing and cold-chain watch remains conditional.",[IEA]),
 review("china-demand",["china","energy"],"Is Chinese crude demand recovering enough to absorb the glut?","Chinese refining, imports and inventory—not compute leadership","Next monthly customs and refinery releases","mixed",
  "Weak year-on-year demand, but sequential imports are recovering.",
  "October imports were 9.88m b/d versus 11.40m a year earlier (−13.3%), but +9.4% month on month; refining throughput was 58.3m tonnes (−8.1% y/y). The 1.52m b/d gap is roughly 89% of the IEA's 1.7m b/d Q4 surplus if it were genuinely incremental to the IEA baseline. Reuters estimates implied October storage rose about 490k b/d.",
  "Restocking is not consumption. The IEA baseline may already incorporate part of an import rebound; weaker factory, retail and investment data limit sustained demand. China can choose to refill inventories when crude is cheap without restoring refinery runs.",
  "November customs volumes, NBS refinery throughput, calculated storage, product export quotas and Asian diesel cracks. Test sequential AND year-on-year changes before declaring a demand recovery.",
  "Keep crude/refiners and China-exposed cyclicals on separate watchlists. A durable demand recovery would limit the crude-bear thesis; inventory-only buying may be temporary.",[CHINA,STORAGE,NBS,IEA]),
 review("ai-capital-demand",["ai","breadth"],"Is outside capital demand for AI improving?","Public-market appetite versus supplier financing and actual paid demand","IPO pricing and next reporting cycle","improving",
  "Reported demand for Anthropic's offering is strong; revenue and funding quality still need adjudication.",
  "WSJ reports potential IPO pricing above $80 versus $70–78 and a possible $1.5–1.6tn valuation versus about $1.33tn. The prospectus also describes a separate $26bn strategic private placement with participants in the AI supply chain. Strong book demand is supportive of capital access, not proof of profitable inference.",
  "Price and valuation are not final; strategic capital can recycle through hardware/cloud contracts. A straining IPO can absorb liquidity from listed stocks, and major buyers still face capex and cash-conversion pressure. No confirmed OpenAI listing date is included.",
  "Verify final prospectus/IPO pricing, external versus strategic subscriptions, first trading sessions, realised utilisation, cash conversion and debt terms. Match SMH/QQQ, RSP/SPY and breadth after NVIDIA's earnings.",
  "Watch NVDA/AVGO/MU/GOOGL/AMZN/MSFT; distinguish supplier revenue from payer free cash flow. Anthropic listing appetite alone does not prove a market bottom.",[IPO,SEC]),
 review("ai-earnings-gate",["ai","breadth"],"Has NVIDIA confirmed the hardware recovery?","Earnings guidance, governance continuity and broad participation","17 Nov US after close / 18 Nov MYT onwards","insufficient",
  "Pre-results review: new guidance and market confirmation are not yet available in this assessment.",
  "The scheduled call is 17 Nov at 5 pm ET (18 Nov 6 am MYT). Leadership transition is a governance shock; it does not establish lost chip orders. A strong IPO book does not replace the issuer's outlook.",
  "A strong historical quarter can still disappoint on forward orders, margins or CEO/succession clarity; a relief gap could fade. Reported NVDA short interest (30 Oct settlement: 279.58m shares, 1.21% of float) predates the leadership event and cannot establish current squeeze fuel; broad QQQ positioning is a separate instrument.",
  "Read the actual results and call: next-quarter revenue versus expectations, margins, Blackwell/Rubin demand, China constraints, CEO continuity and commitments. Then look for durable daily/4H band reclaim, SMH/QQQ and RSP/SPY participation; no trade purely on the first after-hours candle.",
  "NVDA and SMH are event-driven watches. QQQ for breadth/positioning; compare equal weight and credit rather than assuming a short squeeze.",[NVDA,NVDA_TRANSITION,NVDA_SI,IPO]),
 review("ai-power",["ai","energy"],"Is AI's firm-power bottleneck easing?","Long-term contracted electricity access versus operating capacity","2028–2030+","improving",
  "An incremental long-term procurement route, not immediate available megawatts.",
  "Quaise announced a 50 MW Google geothermal PPA in Oregon with potential delivery from 2030. Conventional drilling is the first phase; the proposed millimetre-wave superhot-rock technology is not proven commercially. Nabors has announced $35m strategic investment and drilling exposure.",
  "Permitting, financing, drilling performance, grid connection and cost per MWh remain risks. PPA value is not upfront capex or scheduled operating cash; other approaches, including nuclear and gas, remain relevant.",
  "Track project permits, successful commercial drilling, commissioning and binding delivery dates; require proved economics and realised MW rather than announcements.",
  "ORA / FRVO for geothermal comparison, NBR optionality; PWR and MOD infrastructure watch. Do not treat private Quaise as a listed security or contracted MW as generation.",[QUAISE,NBR]),
 review("cyber-resilience",["ai","breadth"],"Is systemic technology and infrastructure risk worsening?","Operational resilience, not attribution to a common attacker","Next incident disclosures and procurement cycles","deteriorating",
  "Confirmed web supply-chain compromise plus separate disruption reports; common cause not established.",
  "Report URI found 188 malicious script injections affecting 178 organisations through Optimizely web code; Reuters corroborated. CNN reported an NSA Net outage; the FAA described its ground stop as a telecommunications failure. Other reported Microsoft, United, JPMorgan and Schwab disruptions deserve independent incident records.",
  "Malicious browser scripts are not evidence of access to internal classified networks or a unified attack. No common indicators of compromise, coordinated actor, broad cold-chain disruption or systemic banking failure have been established.",
  "Track operators' root-cause reports, credible common indicators, duration, regulatory incident notices, actual procurement and whether critical services remain impaired; avoid attribution until technically evidenced.",
  "Cybersecurity watch PANW/CRWD/FTNT/ZS; resilience contractors LHX/LDOS only on verified awards. No automatic sector rerating or assumed cold-chain/food scarcity.",[CYBER,CYBER2,NSA,FAA]),
 review("oil-disinflation",["fed","bonds","gold"],"Could easing crude supply pressure improve the rates backdrop?","Energy-driven disinflation and duration, not a confirmed Fed pivot","Next inflation releases and policy meetings","mixed",
  "An emerging disinflation countercase to the restrictive-rate regime, not a policy reversal.",
  "IEA Q4 crude surplus forecast and weaker heavy-crude prices could ease headline inflation as they pass into fuel. October CPI was +0.4% headline and +0.3% core month on month; physical diesel scarcity can delay pass-through. A demand-driven oil decline can also signal slower activity.",
  "Core services, wages, fiscal supply, term premium and real yields may remain restrictive. Crude falling does not automatically lower retail fuel, policy rates, USD or real yields.",
  "Track actual gasoline/diesel and CPI components, matched 2Y/10Y/30Y closes, breakevens and real yields; check Fed communication and cut/hike pricing separately. No easing call without confirmation.",
  "TLT/IEF conditional on yields rolling over; gold conditional on real yields and USD. Do not use falling crude alone as an entry trigger.",[IEA,WCS,CPI]),
];

export function getRegimeResearchRevisions(now:Date,lens?:EditorialRegimeId){
 return REGIME_RESEARCH_REVISIONS.filter(r=>!lens||r.lenses.includes(lens)).map(r=>({lenses:r.lenses,ideas:r.ideas,read:projectQuestionAssessment(r.record,now)}));
}
