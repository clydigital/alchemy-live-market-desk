import {projectQuestionAssessment,type QuestionAssessment,type QuestionRecord} from "./bluebelly-question-assessment.ts";

/** Published source-review *projections*, not automated model decisions.
 * Append immutable revisions; do not silently rewrite yesterday's interpretation.
 * These do not mutate Dossiers, canonical Regime/Story records, or private Power Stack.
 */
const REUTERS_PEACE="https://www.reuters.com/world/us/trump-says-vance-should-focus-domestic-corruption-we-dont-need-deal-with-iran-2026-11-12/";
const REUTERS_TANKER="https://www.reuters.com/world/middle-east/two-oil-tankers-disabled-by-explosions-strait-hormuz-irgc-says-2026-11-12/";
const UKMTO="https://www.ukmto.org/recent-incidents";
const NVDA="https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-CEO-Transition/default.aspx";
const CW="https://investors.coreweave.com/news/news-details/2026/CoreWeave-Reports-Strong-Third-Quarter-2026-Results/default.aspx";
const BLS="https://www.bls.gov/news.release/archives/cpi_11102026.htm";
const REUTERS_AI="https://www.investing.com/news/stock-market-news/analysisinvestors-worry-the-ai-trade-needs-nvidias-huang-and-its-largesse-4763924";

export const QUESTION_REVIEWED_RECORDS:readonly QuestionRecord[]=[
 {id:"hormuz-peace",question:"Are we getting closer to peace?",scope:"Near-term US–Iran diplomatic prospects, not tanker volume",comparison:"Compared with the previous source-reviewed day",horizon:"Next several days",
 authority:"SOURCE_REVIEWED_PROVISIONAL",expiresAfterDays:2,revisions:[
  {revisionId:"hormuz-peace-2026-11-11",reviewedOn:"2026-11-11",sourceThrough:"2026-11-11",verdict:"mixed",
   condition:"No implemented agreement verified; the Strait remains contested.",
   why:"Iran's reported denial of active talks conflicts with continuing outside mediation efforts.",
   countercase:"Qatari mediation remained a potential channel but no agreed terms were implemented.",
   nextTest:"Mutually confirmed talks and actual concessions, not an isolated public statement.",
   sources:[{name:"Al Jazeera / Iranian position, 11 Nov",url:"https://www.aljazeera.com/news/2026/11/11/iran-denies-talks-with-us-says-hormuz-will-stay-shut-until-demands-are-met",publishedOn:"2026-11-11"}]},
  {revisionId:"hormuz-peace-2026-11-12",reviewedOn:"2026-11-12",sourceThrough:"2026-11-12",verdict:"deteriorating",
   condition:"No mutually implemented peace agreement or normal safe passage established.",
   why:"The US president said a deal was not needed while new reported attacks undermined de-escalation hopes; this weakens the near-term diplomacy outlook compared with the preceding source review.",
   countercase:"Mediation channels may persist; neither comments nor military claims establish that talks are permanently over.",
   nextTest:"A mutually acknowledged negotiation timetable, implemented terms and a reduction in verified maritime attacks.",
   sources:[
    {name:"Reuters / US diplomatic position, 12 Nov",url:REUTERS_PEACE,publishedOn:"2026-11-12"},
    {name:"Reuters / tanker attack accounts, 12 Nov",url:REUTERS_TANKER,publishedOn:"2026-11-12",note:"Iranian claims not independently verified by Reuters"}
   ]}
 ]},
 {id:"hormuz-shipping",question:"Are ships becoming safer?",scope:"Maritime security and attacks, not volumes or shipping insurance",comparison:"Compared with the previous source-reviewed day",horizon:"Recent 1–3 days",
 authority:"SOURCE_REVIEWED_PROVISIONAL",expiresAfterDays:2,revisions:[
  {revisionId:"hormuz-shipping-2026-11-11",reviewedOn:"2026-11-11",sourceThrough:"2026-11-11",verdict:"mixed",
   condition:"Traffic recovery and active attacks coexist.",
   why:"Reported increased shipping activity is offset by continuing attacks; completed cargo deliveries and safety are different tests.",
   countercase:"More recorded transits may indicate partial logistics adaptation even with security threats.",
   nextTest:"Original UKMTO notices and confirmed safe completed passages across multiple days.",
   sources:[{name:"Reuters / traffic and attacks, 11 Nov",url:"https://www.reuters.com/world/middle-east/hormuz-traffic-is-up-so-are-attacks-2026-11-11/",publishedOn:"2026-11-11"}]},
  {revisionId:"hormuz-shipping-2026-11-12",reviewedOn:"2026-11-12",sourceThrough:"2026-11-12",verdict:"deteriorating",
   condition:"Severe maritime security threat; vessel movements do not establish safe passage.",
   why:"New attack reports and a separate UKMTO-noted projectile strike erode confidence in safer passage.",
   countercase:"Iranian claims concerning four tankers were not independently verified; recovering traffic and actual arrivals still require independent examination.",
   nextTest:"Compare authenticated UKMTO incidents, completed cargo passages, insurance terms and vessel arrivals over matched periods.",
   sources:[{name:"Reuters / vessel attacks, 12 Nov",url:REUTERS_TANKER,publishedOn:"2026-11-12",note:"Claims require original notice checks"},{name:"UKMTO original incident registry",url:UKMTO,publishedOn:"2026-11-12",note:"Registry is updated; open the specific notices and preserve event timestamps"}]}
 ]},
 {id:"ai-overall",question:"Are AI investment conditions improving?",scope:"Sector risk balance; not a claim of weaker physical GPU demand",comparison:"Compared with the previous source-reviewed day",horizon:"Days to upcoming earnings",
 authority:"SOURCE_REVIEWED_PROVISIONAL",expiresAfterDays:2,revisions:[
  {revisionId:"ai-overall-2026-11-11",reviewedOn:"2026-11-11",sourceThrough:"2026-11-11",verdict:"mixed",
   condition:"Strong AI capacity demand coexists with expensive capital.",
   why:"CoreWeave raised guidance but reported heavy interest costs and losses.",
   countercase:"Contracted growth supports utilisation prospects; financing costs and shareholder returns are not the same metric.",
   nextTest:"Source-matched capex, delivered capacity, debt funding and customer cash conversion.",
   sources:[{name:"CoreWeave Q3 official release, 10 Nov",url:CW,publishedOn:"2026-11-10"},{name:"Reuters / 11 Nov AI-sector rebound",url:"https://www.reuters.com/business/sp-500-nasdaq-futures-rise-after-coreweave-soothes-ai-spending-fears-2026-11-11/",publishedOn:"2026-11-11"}]},
  {revisionId:"ai-overall-2026-11-12",reviewedOn:"2026-11-12",sourceThrough:"2026-11-12",verdict:"deteriorating",
   condition:"A new chip-leadership transition adds execution risk to already strained AI financing.",
   why:"NVIDIA confirmed Jensen Huang's resignation and an interim CEO appointment. Leadership change can affect financing/support arrangements, but does not by itself measure chip orders.",
   countercase:"NVIDIA says its operational commitments and roadmap continue; CoreWeave's reported growth remains real.",
   nextTest:"NVIDIA's 17 Nov earnings and customer-order guidance, alongside financing and cash-flow changes across major AI spenders.",
   sources:[{name:"NVIDIA official CEO transition, 12 Nov",url:NVDA,publishedOn:"2026-11-12"},{name:"CoreWeave Q3 official release, 10 Nov",url:CW,publishedOn:"2026-11-10"}]}
 ]},
 {id:"ai-hardware",question:"Are chip orders and HBM demand getting stronger?",scope:"Physical semiconductor demand, excluding governance and share-price direction",comparison:"Compared with the previous verified demand disclosures",horizon:"Next earnings disclosures",
 authority:"SOURCE_REVIEWED_PROVISIONAL",expiresAfterDays:2,revisions:[
  {revisionId:"ai-hardware-2026-11-12",reviewedOn:"2026-11-12",sourceThrough:"2026-11-12",verdict:"insufficient",
   condition:"A governance shock is verified; a corresponding change in chip orders is not.",
   why:"The NVIDIA leadership transition establishes execution uncertainty but supplies no independently quantified change in GPU/HBM orders.",
   countercase:"The company explicitly expects customer commitments and the product roadmap to continue.",
   nextTest:"NVIDIA's 17 Nov earnings/guidance, actual HBM shipments and customer capex order changes.",
   sources:[{name:"NVIDIA official CEO transition, 12 Nov",url:NVDA,publishedOn:"2026-11-12"}]}
 ]},
 {id:"ai-cash-returns",question:"Are AI capex returns improving?",scope:"Hyperscaler and AI cloud cash conversion, not equity prices",comparison:"Compared with last verified financial disclosures",horizon:"Next earnings season",
 authority:"SOURCE_REVIEWED_PROVISIONAL",expiresAfterDays:2,revisions:[
  {revisionId:"ai-cash-2026-11-12",reviewedOn:"2026-11-12",sourceThrough:"2026-11-12",verdict:"mixed",
   condition:"Higher contracted revenue growth does not resolve funding costs or cash returns.",
   why:"CoreWeave reported strong growth alongside a large quarterly loss and heavy net interest costs.",
   countercase:"An issuer's loss does not prove every hyperscaler's AI projects are unprofitable; segment disclosures vary.",
   nextTest:"Match Microsoft, Meta, Alphabet and Amazon AI capex to realised revenue, free cash flow, and capacity utilisation.",
   sources:[{name:"CoreWeave official Q3 results, 10 Nov",url:CW,publishedOn:"2026-11-10"},{name:"NVIDIA strategy/leadership update, 12 Nov",url:NVDA,publishedOn:"2026-11-12"}]}
 ]},
 {id:"ai-financing",question:"Is AI data-centre financing getting safer?",scope:"Leveraged neocloud funding and sponsor dependence",comparison:"Compared with the previous source-reviewed day",horizon:"Weeks to refinancing and issuer results",
 authority:"SOURCE_REVIEWED_PROVISIONAL",expiresAfterDays:2,revisions:[
  {revisionId:"ai-financing-2026-11-11",reviewedOn:"2026-11-11",sourceThrough:"2026-11-11",verdict:"mixed",
   condition:"Contracted demand supports growth while expensive borrowing increases fragility.",
   why:"CoreWeave guidance improved, but disclosed financing costs remain material.",
   countercase:"A strong backlog supports potential revenue; it is not yet free cash available to equity.",
   nextTest:"Net financing terms, refinancing calendars and issuer cash conversion.",
   sources:[{name:"CoreWeave Q3 official results",url:CW,publishedOn:"2026-11-10"},{name:"Reuters / CoreWeave rally, 11 Nov",url:"https://www.reuters.com/business/sp-500-nasdaq-futures-rise-after-coreweave-soothes-ai-spending-fears-2026-11-11/",publishedOn:"2026-11-11"}]},
  {revisionId:"ai-financing-2026-11-12",reviewedOn:"2026-11-12",sourceThrough:"2026-11-12",verdict:"deteriorating",
   condition:"Financing dependence is a greater near-term risk; no measured system-wide credit freeze.",
   why:"NVIDIA's transition raises questions about continued financial support for AI customers; hot CPI is an additional cost-of-capital headwind.",
   countercase:"Strong customer backlog and actual contracts may continue; no single report establishes funding withdrawals.",
   nextTest:"Signed financing revisions, sponsor commitments, debt spreads and subsequent issuer filings.",
   sources:[{name:"NVIDIA official CEO transition, 12 Nov",url:NVDA,publishedOn:"2026-11-12"},{name:"Reuters / AI sponsorship risk, 12 Nov",url:REUTERS_AI,publishedOn:"2026-11-12"},{name:"BLS October CPI, 10 Nov",url:BLS,publishedOn:"2026-11-10"}]}
 ]}
] as const;
export function getReviewedQuestion(id:string,now=new Date()):QuestionAssessment|null{
 const record=QUESTION_REVIEWED_RECORDS.find(item=>item.id===id);
 return record?projectQuestionAssessment(record,now):null;
}
export function getReviewedQuestions(ids:readonly string[],now=new Date()):QuestionAssessment[]{
 return ids.map(id=>getReviewedQuestion(id,now)).filter((v):v is QuestionAssessment=>v!==null);
}
