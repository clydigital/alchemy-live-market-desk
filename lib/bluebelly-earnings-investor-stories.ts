/**
 * Public-source, manually researched financial investment cases.
 * Cut-off 29 Oct 2026, before the US after-close releases.
 * This is editorial context, NOT live actuals, a consensus feed,
 * a source-admission override or a canonical Story/Regime mutation.
 */
export type EarningsCase = {
 ticker:string; name:string; heading:string; period:string; centralQuestion:string;
 pitch:string[]; theMoney:string[]; theCatch:string[]; balance:string[];
 metrics:{label:string;value:string;basis:string}[];
 bridges:{label:string;formula:string;interpretation:string}[];
 quote:{speaker:string;claim:string;source:string;meaning:string};
 debate:{bull:string;bear:string;limit:string};
 cases:{bear:string;base:string;bull:string};
 calls:string[]; missing:string[];
 primary:{name:string;url:string}[];
};

export const EARNINGS_RESEARCH_CUTOFF="29 October 2026 · pre-results";
export const EARNINGS_CASES:readonly EarningsCase[]=[
{
 ticker:"AMZN",name:"Amazon",heading:"The profit engine and the $169 billion infrastructure bill",
 period:"Q2 2026 ended 30 June; trailing twelve months to June for cash flow",
 centralQuestion:"Is Amazon building an expensive monopoly-like cloud engine—or promising investors a return it has not yet delivered?",
 pitch:[
  "Amazon looks like several businesses sharing a balance sheet. Its own online stores sell physical goods, while independent merchants pay fees for access, advertising and fulfilment. Prime provides recurring subscriptions; advertising earns fees without the same warehouse burden. AWS rents computing, storage and AI infrastructure to developers and enterprises.",
  "That mix changes the pitch. In Q2, North American operations generated $116.2bn of sales and roughly $9.1bn of operating income. International operations generated about $42.2bn of sales and $1.7bn of operating income. AWS delivered about $42.2bn of sales but $16.6bn in operating income. The last business provided around 60% of the group's $27.5bn operating profit despite only around one-fifth of sales.",
  "In Shark Tank terms, this is an entrepreneur with a substantial profitable division—not merely an ambitious start-up asking for investors' money. The first question is whether the next servers produce returns similar to the already-installed fleet."
 ],
 theMoney:[
  "Amazon's Q2 operating income of $27.5bn was up from $19.2bn a year earlier. That is a business-performance measure. Reported Q2 net income of $62.6bn included $53.4bn of non-operating pre-tax income, mainly reflecting the change in value of its Anthropic investment. The revaluation is not a payment from an AWS customer and should never be used as the recurring earnings base.",
  "The group generated $161.4bn of cash from operations over the trailing year, but its net property-and-equipment purchases reached approximately $169.0bn. On Amazon's own free-cash-flow measure, that leaves about negative $7.6bn. Q2 operating earnings and trailing-year free cash flow cover different periods; the negative sign does not mean AWS itself lost cash.",
  "The infrastructure bill is part of the strategy: AI compute is capital-intensive and capacity takes time to install and fill. Management's confidence in contracted demand supports a growth thesis, but customers reserving servers does not establish the realised return on each dollar of construction, depreciation, power, networking and interest."
 ],
 theCatch:[
  "Amazon's June balance sheet held $78.2bn in cash plus $44.8bn in marketable securities—about $123.0bn of liquidity. Long-term debt was $128.9bn, compared with $65.6bn at December 2025. Long-term lease liabilities were another $94.3bn. Debt and lease obligations are distinct claims; do not add all future lease payments as if they were borrowings due today.",
  "A strong AWS revenue increase alone would not settle the valuation question. If depreciation, lease obligations and the next generation of accelerators grow faster than incremental operating profit, the investment payback moves further out. Retail profits and advertising can help finance the venture, but they are also exposed to customer demand, delivery costs and pricing competition."
 ],
 balance:[
  "Liquidity: $78.213bn cash and $44.775bn marketable securities at 30 June, compared with the company's $123.0bn total at 31 December. Those are liquid assets, not necessarily cash freely distributable after future commitments.",
  "Financing: long-term debt $128.894bn, up $63.246bn from 31 December; long-term lease liabilities $94.338bn. The forward credit check must include maturity schedules, operating and finance leases, bond spreads and financing cash flows.",
  "Accounting quality: Q2 non-operating pre-tax gains are a separate line from segment operating earnings. Analysts should bridge GAAP to recurring earnings before quoting a headline EPS surprise."
 ],
 metrics:[
  {label:"Q2 group sales",value:"$200.6bn",basis:"+20% year on year · reported"},
  {label:"Q2 AWS sales",value:"$42.2bn",basis:"+37% year on year · reported"},
  {label:"Q2 AWS operating income",value:"$16.6bn",basis:"~39% AWS operating margin · derived"},
  {label:"Q2 group operating income",value:"$27.5bn",basis:"+43% year on year · reported"},
  {label:"TTM operating cash flow",value:"$161.4bn",basis:"trailing 12 months, not Q2"},
  {label:"TTM net equipment purchases",value:"$169.0bn",basis:"Amazon's reported cash-investment bridge"},
  {label:"TTM free cash flow",value:"−$7.6bn",basis:"$161.4bn minus $169.0bn"},
  {label:"30 Jun long-term debt",value:"$128.9bn",basis:"vs $65.6bn at 31 Dec 2025"}
 ],
 bridges:[
  {label:"Profit concentration",formula:"AWS operating income $16.6bn ÷ group $27.5bn ≈ 60%",interpretation:"A minority of group revenue carries most operating profit. That engine supports—but does not guarantee—the investment case."},
  {label:"Cash after investment",formula:"Trailing operating cash $161.4bn − net equipment purchases $169.0bn ≈ −$7.6bn",interpretation:"Growing earnings and cash outflow can occur together when construction is front-loaded."},
  {label:"Funding sensitivity",formula:"Long-term debt $128.9bn vs $65.6bn six months earlier",interpretation:"The outstanding financing balance has changed materially; examine issuance terms, interest cost and debt maturity rather than assuming the Treasury yield is Amazon's borrowing rate."}
 ],
 quote:{speaker:"Amazon management, Q2 issuer release",claim:"AWS sales grew 37% year on year, the fastest rate in 18 quarters.",source:"https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Second-Quarter-Results/default.aspx",meaning:"This is evidence of reported demand and revenue. It does not quantify returns on the newest AI capacity."},
 debate:{bull:"AWS growth and a substantial established operating-profit base may absorb today's capital intensity. A build-out ahead of demand can improve future utilisation.",bear:"A larger capital programme can depress free cash flow and expose debt/lease commitments to high borrowing rates before servers pay back.",limit:"No matched company bond spread, asset utilisation/return-on-invested-capital series or verified pre-Q3 consensus is available in this dated note. Do not infer that bondholders punished Amazon from a Treasury move alone."},
 cases:{
  bear:"AWS growth or margin slows while cash capex and contractual obligations rise; leverage and payback fears intensify.",
  base:"AWS demand remains strong, but free cash flow stays temporarily negative; investors demand quantified capacity economics and a dated recovery path.",
  bull:"AWS margins and collections rise as new infrastructure fills, while capex growth moderates or is covered by stronger operations. The reported cash bridge begins improving."
 },
 calls:[
  "What percentage of new AWS capacity is already billing, versus merely ordered, installed or contracted?",
  "Separate Q3 equipment cash paid, finance leases and future purchase commitments; what changed from earlier spending plans?",
  "What additional operating profit and cash return are expected from each major infrastructure cohort, and when?",
  "How much of any earnings surprise reflects ongoing segment operations rather than investment marks or one-off items?"
 ],
 missing:["Comparable pre-release analyst revenue and EPS consensus with dates/basis","Matched AMZN bond spreads and real-yield observations around earnings","Q3 actual revenue, CFO, capital spending and new guidance"],
 primary:[
  {name:"Amazon Q2 results",url:"https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Second-Quarter-Results/default.aspx"},
  {name:"Amazon 30 June 2026 SEC 10-Q",url:"https://www.sec.gov/Archives/edgar/data/1018724/000101872426000026/amzn-20260630.htm"}
 ]
},
{
 ticker:"INTC",name:"Intel",heading:"The comeback that still needs a foundry customer",
 period:"Q2 2026 ended 27 June; financing event disclosed in August",
 centralQuestion:"Can a stronger CPU business carry a chip-factory operation that still has to prove third-party economics?",
 pitch:[
  "Intel has two competing stories. Its product business sells processors that go into computers and servers. Its Foundry business operates costly factories, serving Intel's own chips and seeking outside customers. A processor recovery helps near-term earnings, but it does not by itself establish a profitable contract-manufacturing business.",
  "In Q2, Intel Products generated around $15.1bn revenue and $4.8bn operating profit. The Foundry unit recorded approximately $5.8bn of segment sales—but $5.5bn of that was intersegment activity. Revenue from outside foundry customers was only $293m. The investor should not count captive wafer production as evidence that third parties are choosing Intel over rivals."
 ],
 theMoney:[
  "Intel posted $16.1bn consolidated revenue, up 25%, and a much improved group operating margin. Yet GAAP net loss attributable to Intel was about $11.0bn against positive adjusted net earnings of $2.2bn. The principal disagreement relates to large non-cash share-related fair-value adjustments. That charge affects reported shareholder earnings; it is not identical to cash lost constructing fabs.",
  "The Foundry operating loss was $2.09bn, down from $3.17bn a year earlier. Management explained that much of the year-on-year improvement came from lower period charges, including the absence of a $797m impairment and accelerated-depreciation charge in the comparative period. That means the headline improvement is not all incremental manufacturing efficiency.",
  "Foundry spending remains unusually demanding: 18A wafer costs and yields, equipment commitments and capacity utilisation have to be tested against what an external buyer will actually pay."
 ],
 theCatch:[
  "At June, cash and short-term investments were around $29.7bn while borrowings were about $50.5bn. Intel subsequently announced an approximately $20bn gross common-stock financing. This increases potential runway but dilutes existing shareholders, and cannot be treated as Q2 operating cash generation.",
  "The hard question is whether Intel can grow external wafer orders and reduce manufacturing losses without repeated external capital injections. More factory utilisation from internal products alone may improve economics, but external validation requires outside customer revenue and durable margin."
 ],
 balance:[
  "The June cash-and-debt snapshot predates Intel's announced August common-stock financing: do not simply add gross proceeds without the subsequent filing and deal closing evidence.",
  "Intel's GAAP result incorporates a material non-cash charge. Use adjusted net income only with the GAAP reconciliation; do not erase the economic effects of dilution.",
  "The foundry-to-products segmentation includes $5.5bn of intersegment eliminations. External foundry sales are a small subset of gross segment revenue."
 ],
 metrics:[
  {label:"Q2 revenue",value:"$16.1bn",basis:"+25% year on year · reported"},
  {label:"Product operating profit",value:"~$4.8bn",basis:"Intel Products · reported segment"},
  {label:"Foundry operating loss",value:"−$2.09bn",basis:"vs −$3.17bn a year before"},
  {label:"External Foundry sales",value:"$293m",basis:"vs ~$5.8bn gross Foundry sales"},
  {label:"GAAP / adjusted result",value:"−$11.0bn / +$2.2bn",basis:"net earnings · separate accounting bases"},
  {label:"June liquid assets",value:"~$29.7bn",basis:"cash and short investments"},
  {label:"June borrowings",value:"~$50.5bn",basis:"before August financing"}
 ],
 bridges:[
  {label:"Foundry customer reality",formula:"Gross Foundry sales ~$5.8bn − internal sales ~$5.5bn ≈ $0.3bn external",interpretation:"The external customer book is much smaller than headline Foundry sales."},
  {label:"Foundry loss trend",formula:"Q2 2025 −$3.17bn → Q2 2026 −$2.09bn",interpretation:"A real improvement, partly explained by prior-year charges rather than pure wafer economics."}
 ],
 quote:{speaker:"Intel CFO, Q2 issuer release",claim:"Demand was stronger and investment in equipment, clean rooms and substrates is being increased.",source:"https://www.intc.com/news-events/press-releases/detail/1776/intel-reports-second-quarter-2026-financial-results",meaning:"The sales outlook improved, but management is also signalling a higher capital requirement."},
 debate:{bull:"Improved CPU demand, lower foundry losses and stronger manufacturing yields offer a credible recovery path; external financing may buy time.",bear:"Foundry gross revenue overstates third-party traction, expensive 18A wafers still pressure margin, and financing transfers some future value to new shareholders.",limit:"An outside customer design win is not recognised sales, and an announced equity issue is not cash on the June balance sheet."},
 cases:{
  bear:"External Foundry orders stay limited and foundry loss reduction stalls as spending rises; another capital raise becomes a risk.",
  base:"Product profits improve while Foundry losses narrow slowly; valuation depends on uncertain external customer ramp.",
  bull:"Verified external production contracts lead to material shipments and profit improvement without proportional capex increases."
 },
 calls:[
  "What were outside Intel Foundry sales excluding intersegment and Altera-related reclassification?",
  "How much of margin improvement comes from wafer yield/cost rather than prior-year impairment comparatives?",
  "Can management give externally committed customer wafer volumes and cost-per-good-die measures?",
  "After financing, what are net proceeds, fully diluted shares, and remaining fab financing needs?"
 ],
 missing:["Post-offering diluted share count and proceeds as reported in subsequent filings","Foundry external order book / realised gross margin","Current INTC credit spread and independently dated Q3 analyst estimates"],
 primary:[
  {name:"Intel Q2 issuer results",url:"https://www.intc.com/news-events/press-releases/detail/1776/intel-reports-second-quarter-2026-financial-results"},
  {name:"Intel Q2 SEC filing",url:"https://www.sec.gov/Archives/edgar/data/50863/000005086326000157/intc-20260627.htm"}
 ]
},
{
 ticker:"SNDK",name:"SanDisk",heading:"Record NAND margins: cash earned or cash paid in advance?",
 period:"Fiscal Q4 2026 ended 3 July; FY2028–2030 financial model is management's forecast",
 centralQuestion:"If memory prices stop soaring, how much of today's earnings power remains?",
 pitch:[
  "SanDisk supplies flash memory used in data centres, edge equipment and consumer products. As AI workloads grow, buyers need more storage and faster access to data. Supply constraints have also given manufacturers unusual pricing power.",
  "The revenue mix exposes the nature of the rally. Fiscal Q4 sales reached $8.965bn, up 51% quarter on quarter, while data-centre sales more than doubled sequentially to $2.977bn. Consumer sales actually fell 32% sequentially to $556m. Management says two-thirds of the total revenue increase came from price, not more bits sold."
 ],
 theMoney:[
  "SanDisk reported an 84.6% GAAP gross margin and $7.037bn operating profit. That is extraordinary manufacturing profitability, but an investor cannot carry this margin into every forecast as if the memory cycle has disappeared.",
  "The cash-flow statement offers a second reveal: Q4 operating cash reached $7.126bn and cash property spending was just $43m, yielding $7.083bn of headline free cash flow. SanDisk also presents **adjusted** free cash flow of $5.035bn after its adjustments for customer New Business Model prepayments/deposits and Flash Ventures activity. Those adjustments are important when deciding how much cash is sustainable in future quarters.",
  "Receivables ended at roughly $4.71bn compared with $1.07bn a year before. The business may be healthy, but the amount not yet collected grew strongly. Analyse days-sales-outstanding, customer concentration and the timing of large contract invoices."
 ],
 theCatch:[
  "At its August investor day, management said eight customers had signed New Business Model arrangements covering roughly 50% of projected fiscal 2027 bit shipments and around two-thirds of fiscal 2028. These contracts include volume commitments and minimum financial guarantees; they are not immunity from price negotiations, customer credit or changing NAND supply.",
  "Management's FY2028–2030 aspiration for roughly 80% non-GAAP gross margins and around 50% adjusted FCF margins is an explicit **projection**. It should be stress-tested against lower ASPs, inventory additions, receivable collections and capacity investment. It is not a guaranteed payout to shareholders.",
  "Q4 net income also includes an $804m gain on equity securities. Separate it from the operational margin story."
 ],
 balance:[
  "Q4 cash was $4.762bn with no long-term debt reported at the balance-sheet date. Equity investments and venture interests should not be added to immediately available cash.",
  "Receivables $4.71bn and customer prepayments/deposits are central to the earnings-quality debate. The reported adjusted FCF bridge explicitly backs these items out.",
  "A newly announced buyback authorisation is not actual cash returned. Distinguish the size of a board authorisation from repurchases executed."
 ],
 metrics:[
  {label:"Q4 sales",value:"$8.965bn",basis:"+51% sequential · +372% YoY"},
  {label:"Q4 gross margin",value:"84.6%",basis:"GAAP · vs 78.4% Q3"},
  {label:"Q4 data-centre sales",value:"$2.977bn",basis:"+103% quarter on quarter"},
  {label:"Q4 operating profit",value:"$7.037bn",basis:"GAAP · vs $4.111bn Q3"},
  {label:"Q4 operating cash",value:"$7.126bn",basis:"reported cash flow"},
  {label:"Q4 headline FCF",value:"$7.083bn",basis:"CFO less $43m property spending"},
  {label:"Q4 adjusted FCF",value:"$5.035bn",basis:"company-defined, NBM and JV adjustments"},
  {label:"Q4-end receivables",value:"~$4.71bn",basis:"~$1.07bn a year earlier"}
 ],
 bridges:[
  {label:"Why revenue jumped",formula:"~⅔ pricing contribution + ~⅓ volume contribution to sequential revenue growth",interpretation:"The first earnings sensitivity is the NAND average selling price, not just datacentre bit demand."},
  {label:"The real cash test",formula:"$7.126bn CFO − $0.043bn capex = $7.083bn FCF; company-adjusted = $5.035bn",interpretation:"The company strips out temporary customer funding/deposit effects and venture activity in its adjusted measure."},
  {label:"Contract economics",formula:"NBM contracts cover ~50% of projected FY27 bits and ~⅔ of FY28 bits",interpretation:"Greater visibility of committed volume does not remove the need to underwrite pricing terms, collection and credit risk."}
 ],
 quote:{speaker:"SanDisk management, August Investor Day",claim:"Longer-term contracts cover roughly half of projected fiscal 2027 NAND bit volumes and two-thirds of 2028.",source:"https://investor.sandisk.com/news-releases/news-release-details/sandisk-details-growth-strategy-and-long-term-financial-model",meaning:"Volume visibility supports planning; the disclosed forecast margin still depends on pricing and customer solvency."},
 debate:{bull:"Signed minimum-volume and financial-guarantee structures could make this NAND cycle more durable than previous spot-driven booms.",bear:"Investors may be treating peak margins and customer prepayments as repeatable cash returns. The share price can fall after an excellent report if the next-quarter outlook disappoints.",limit:"Bullish holder extrapolations about 'guaranteed free cash flow' are not contractual profit guarantees. No comparable pre-release consensus or matched event-window price study is included."},
 cases:{
  bear:"NAND prices peak, collections slow and adjusted FCF compresses despite reported revenue growth.",
  base:"Long-term agreements provide a floor for volumes, while margin normalises from unusually elevated Q4 conditions.",
  bull:"Stable contract pricing, broader datacentre deployments and strong collections support multi-quarter high cash conversion."
 },
 calls:[
  "What portion of sales uplift came from realised selling prices versus shipped bits, by end-market?",
  "Reconcile CFO, headline FCF and adjusted FCF after NBM cash deposits and JV funding.",
  "Which contract minimums are take-or-pay, and what are the enforcement and counterparty concentration risks?",
  "Is the 2028–30 cash-margin model a cycle average or dependent on historically exceptional NAND pricing?"
 ],
 missing:["Comparable pre-event consensus and last-two-hour share/option context","Receivables ageing and DSO by end market","Customer contract price-adjustment clauses and payment vintage"],
 primary:[
  {name:"SanDisk Q4 financials and FCF reconciliation",url:"https://investor.sandisk.com/news-releases/news-release-details/sandisk-reports-fiscal-fourth-quarter-2026-financial-results"},
  {name:"SanDisk 13 August Investor Day",url:"https://investor.sandisk.com/news-releases/news-release-details/sandisk-details-growth-strategy-and-long-term-financial-model"}
 ]
},
{
 ticker:"AMD",name:"AMD",heading:"What does it cost to win the AI customers?",
 period:"Q2 2026 ended 27 June; no customer warrants vested at reporting date",
 centralQuestion:"A second AI accelerator champion—or growth partly financed with its own equity?",
 pitch:[
  "AMD sells server processors and AI accelerators to hyperscalers, along with PC and gaming chips. Data-centre revenue doubled year on year in Q2, helping revenue reach $11.536bn. Its data-centre customers can also be its most sophisticated negotiators.",
  "The company is not financing growth from a weak position: cash and short-term investments totalled $13.111bn against debt of around $3.23bn. AMD reported $1.558bn in quarter free cash flow, but this was down from $2.566bn in Q1 despite expanding revenue."
 ],
 theMoney:[
  "GAAP gross margin rose to 54% from 40% a year earlier, while adjusted gross margin reached 56%. The 2025 comparison includes an $800m inventory/export-control charge, so not all of the 14-point improvement reflects recurring unit economics.",
  "The surprise in the filing is a set of warrants granted to OpenAI and Meta: each has rights to purchase up to 160 million AMD shares at $0.01, subject to GPU purchase milestones, share-price thresholds and other terms. **None vested or became exercisable as of 27 June.** These are conditional future economics, not 320 million newly issued shares.",
  "Selling more GPUs and creating shareholder value are not synonymous. Shareholders should compare lifetime gross profit on contracts, equipment/software support cost and any eventual dilution per dollar of revenue."
 ],
 theCatch:[
  "The biggest technology risk is competing effectively against Nvidia's infrastructure ecosystem while keeping GPU pricing and support margins healthy.",
  "A stock-based customer incentive can align both parties, but the economic transfer may be material if shares vest. Investors should look for share-count dilution, warrant fair value and detailed gross margins alongside headline GPU shipment agreements."
 ],
 balance:[
  "Q2 cash and short-term investments $13.111bn, debt ~$3.23bn: net cash on this simple basis.",
  "Q2 cash property investment ~$808m and issuer free cash flow ~$1.558bn. Interpret cash conversion beside working-capital shifts and customer deployments.",
  "Warrants are contractual contingent rights; the value must be evaluated over multiple stages rather than mechanically counting all 320m shares in Q2 shares outstanding."
 ],
 metrics:[
  {label:"Q2 revenue",value:"$11.536bn",basis:"+50% YoY · reported"},
  {label:"Q2 data-centre revenue",value:"~$6.72bn",basis:"~58% of company revenue"},
  {label:"GAAP gross margin",value:"54%",basis:"vs 40% Q2 2025 · distorted base"},
  {label:"Adjusted gross margin",value:"56%",basis:"vs 43% Q2 2025"},
  {label:"Q2 cash capex",value:"$808m",basis:"property/equipment spending"},
  {label:"Q2 issuer FCF",value:"$1.558bn",basis:"vs $2.566bn in Q1"},
  {label:"Liquid investments",value:"$13.111bn",basis:"cash plus short-term investments"},
  {label:"Conditional warrants",value:"Up to 320m shares",basis:"none vested at June 27"}
 ],
 bridges:[
  {label:"Growth versus cash",formula:"$11.536bn revenue (+50% YoY) but $1.558bn free cash flow (< $2.566bn prior quarter)",interpretation:"A fast-growing business can temporarily tie up more money in inventory, receivables or investment."},
  {label:"Warrant condition",formula:"160m conditional shares × 2 customers = 320m maximum",interpretation:"The maximum contractual rights are not issued shares; account for vesting, target share prices and financial return on the GPU volumes that trigger them."}
 ],
 quote:{speaker:"AMD CFO, Q2 earnings release",claim:"Data Centre was 58% of company revenue; management expects acceleration in the second half.",source:"https://ir.amd.com/news-events/press-releases/detail/1295/amd-reports-second-quarter-2026-financial-results",meaning:"Revenue strength is reported; a forward sales acceleration remains guidance, subject to deployment and margins."},
 debate:{bull:"AMD's EPYC business and multi-customer AI accelerator agreements can diversify demand beyond a single chip ecosystem.",bear:"Competitive price pressure and economic dilution through customer warrants may limit returns per existing share.",limit:"No independently checked contract-level pricing, GPU-only segment profit or Q3 consensus vintage. Do not label an earnings beat based on management's forecast."},
 cases:{
  bear:"GPU shipment growth arrives at lower margin, inventory builds and warrants vest without proportionate per-share profits.",
  base:"Strong datacentre growth continues, with volatile quarter-to-quarter cash conversion and conditional dilution risk.",
  bull:"Repeat GPU deployments improve margins and cash flow faster than the dilution-adjusted share base."
 },
 calls:[
  "How much revenue and contribution margin comes from GPUs versus EPYC CPUs?",
  "What are the next customer purchase milestones for the OpenAI and Meta warrants, and how will fair value be reported?",
  "Why did free cash flow moderate quarter on quarter despite revenue acceleration?",
  "How much working capital and inventory is committed to each major GPU platform launch?"
 ],
 missing:["Separate AI GPU operating margins and contracted realised unit pricing","Near-term warrants vesting probability and fair-value scenario","Matched AMD Q3 street estimates and issuer call commentary after print"],
 primary:[
  {name:"AMD Q2 results",url:"https://ir.amd.com/news-events/press-releases/detail/1295/amd-reports-second-quarter-2026-financial-results"},
  {name:"AMD Q2 SEC 10-Q · warrants note",url:"https://ir.amd.com/financial-information/sec-filings/content/0000002488-26-000123/amd-20260627.htm"}
 ]
},
{
 ticker:"AAPL",name:"Apple",heading:"A cash machine facing a higher-cost hardware cycle",
 period:"Fiscal Q3 2026 / first nine months ended 27 June",
 centralQuestion:"How much of Apple's margin is durable if memory and supply costs rise?",
 pitch:[
  "Apple sells iPhones, Macs, iPads and accessories, then monetises the installed base through Services. The economics are not equal: in fiscal Q3, Products gross margin was 40.1%, while Services gross margin was 75.6%. A growing Services mix makes the company more than a one-product manufacturer.",
  "Nine-month operating cash reached $116.996bn, while purchases of property and equipment were only $6.799bn. That simple $110.197bn cash-after-capex calculation is a major contrast to the large AI infrastructure builders."
 ],
 theMoney:[
  "Apple reported approximately $109.4bn June-quarter revenue and $2.02 diluted EPS. The company's quarterly filing says product margin improvement reflected product mix and tariff refunds, offset partly by higher costs including memory. This is not a free margin expansion without caveats.",
  "A report that suppliers cut iPhone-component orders is a plausible demand lead but not independently verified final sales. Apple could be changing inventory timing or adjusting supplier mix; the next company reporting period must settle it."
 ],
 theCatch:[
  "Apple's June cash and securities were about $146.5bn versus roughly $84.3bn in borrowings. Its balance sheet is not dependent on finding near-term AI project finance, but shareholder returns and valuation still depend on future device and Services growth.",
  "SanDisk's extraordinary NAND pricing becomes an upstream cost issue for handset manufacturers. It can improve supplier margins at the same time it pressures a customer; check how much Apple offsets that via mix, pricing and contract hedges."
 ],
 balance:[
  "Balance assets: cash $39.544bn, current securities $22.855bn and long-term securities $84.118bn—together $146.517bn; compare against ~$84.344bn borrowings.",
  "Nine-month FCF derived as CFO $116.996bn less property spending $6.799bn = $110.197bn; it is not annual or Q3 free cash flow.",
  "Services and Products have different margins; assess realised margin and one-time tariff refunds before extrapolating EPS growth."
 ],
 metrics:[
  {label:"Fiscal Q3 sales",value:"~$109.4bn",basis:"+16% YoY"},
  {label:"Fiscal Q3 EPS",value:"$2.02",basis:"GAAP diluted; tariff benefit"},
  {label:"Products gross margin",value:"40.1%",basis:"vs 34.5% a year earlier"},
  {label:"Services gross margin",value:"75.6%",basis:"same as year-earlier quarter"},
  {label:"9-month operating cash",value:"$116.996bn",basis:"nine months, not one quarter"},
  {label:"9-month cash capex",value:"$6.799bn",basis:"purchases of property/equipment"},
  {label:"9-month simple FCF",value:"$110.197bn",basis:"derived CFO less cash capex"},
  {label:"June cash + securities",value:"$146.517bn",basis:"current and non-current securities"}
 ],
 bridges:[
  {label:"Margin mix",formula:"Services 75.6% gross margin vs Products 40.1%",interpretation:"A shift toward Services can improve the group mix even without an equal rise in iPhone unit sales."},
  {label:"Cash conversion",formula:"$116.996bn CFO − $6.799bn cash capex = ~$110.197bn",interpretation:"Exceptional nine-month cash generation, but cannot answer whether the next handset cycle is already priced in."}
 ],
 quote:{speaker:"Apple fiscal Q3 10-Q",claim:"Product margin improvement reflected product mix and tariff refunds, partly offset by higher costs including memory.",source:"https://www.sec.gov/Archives/edgar/data/320193/000032019326000020/aapl-20260627.htm",meaning:"Reported margin strength is real, but tariff refunds are not automatically recurring and memory costs are a cross-industry risk."},
 debate:{bull:"Services economics, customer retention and repeated upgrades could sustain cash conversion despite a costly supply chain.",bear:"The stock can be expensive relative to a maturing phone cycle, and supplier reports may signal weaker-than-expected units.",limit:"Supplier-order claims remain attributed and unverified against actual sales, and an independently checked forward valuation is not included here."},
 cases:{
  bear:"iPhone volume slows while component costs rise faster than price/mix; product margins soften despite Services strength.",
  base:"Services cushions hardware volatility; cash flow stays strong but the valuation depends on measured upgrade-cycle growth.",
  bull:"iPhone demand and Services both surprise positively while product margins withstand the higher NAND bill."
 },
 calls:[
  "Separate the impact of tariff refunds from recurring Products gross margin.",
  "What share of higher NAND cost is contracted, hedged or passed through to buyers?",
  "Do inventory and regional channel orders reconcile with actual consumer sell-through?",
  "How much incremental Services margin comes from pricing versus paid users and usage?"
 ],
 missing:["Confirmed next Apple earnings date from issuer IR","Dated pre-release sell-side iPhone unit estimates","Verified AAPL price reaction attribution to memory supply commentary"],
 primary:[
  {name:"Apple fiscal Q3 SEC 10-Q",url:"https://www.sec.gov/Archives/edgar/data/320193/000032019326000020/aapl-20260627.htm"}
 ]
},
{
 ticker:"PFE",name:"Pfizer",heading:"The dividend question behind an investment-grade borrower",
 period:"H1 2026 ended 28 June; cash flows six months, not a full year",
 centralQuestion:"Can Pfizer replace ageing medicine sales, pay investors and reduce debt using the same cash?",
 pitch:[
  "Pfizer makes money by developing and commercialising medicines and vaccines. The cash spent discovering drugs today can pay back over years, but exclusivity eventually expires and competitors reduce prices. Pfizer's challenge is replenishing its portfolio while servicing acquisition-era debt.",
  "The income statement is not a reliable standalone shortcut. In Q2 the company reported a small GAAP per-share loss while its adjusted EPS was positive, materially affected by charges linked to purchased intangible assets. Underwriting the dividend requires operating cash, not adjusted EPS."
 ],
 theMoney:[
  "Across the first six months of 2026, Pfizer generated $3.450bn of operating cash and spent $0.969bn on property and equipment, leaving $2.481bn of simple free cash flow. Dividends paid were $4.896bn. On this six-month basis, FCF covered about 51% of the shareholder distributions.",
  "That shortfall can be met temporarily from liquid assets, financing or later cash receipts. It is not an automatic dividend-cut signal. It is, however, a clear question for a sceptical investor deciding how the business will fund replacements for patent-expiring medicines."
 ],
 theCatch:[
  "June cash plus short-term investments was $11.699bn, and gross borrowings were $63.194bn. Approximately $51.5bn of gross borrowing remains after subtracting those liquid assets; this simple net figure excludes longer-term investments and financing nuances.",
  "Substantial acquired intangibles and goodwill mean future impairment surprises are possible. New drugs need to contribute both revenue and cash before a dividend commitment can be treated as secure across years."
 ],
 balance:[
  "Liquidity: cash ~$0.976bn plus short-term investments ~$10.723bn. Gross borrowings ~$63.194bn include short and long-term instruments.",
  "Cash obligations: first-half dividends $4.896bn exceeded first-half free cash flow $2.481bn. Look at year-on-year seasonal cash pattern and outstanding debt maturity ladder, not just the first-half ratio.",
  "Reported GAAP and adjusted results differ due to purchased-intangible and other reconciliation items. Filing disclosures, not management-defined EPS alone, govern cash sustainability."
 ],
 metrics:[
  {label:"H1 operating cash",value:"$3.450bn",basis:"six months ended 28 June"},
  {label:"H1 property spending",value:"$0.969bn",basis:"cash PPE purchases"},
  {label:"H1 simple free cash flow",value:"$2.481bn",basis:"calculated CFO less capex"},
  {label:"H1 dividends paid",value:"$4.896bn",basis:"reported financing cash outflow"},
  {label:"H1 dividend cash coverage",value:"~51%",basis:"derived FCF ÷ dividends"},
  {label:"June cash + ST investments",value:"$11.699bn",basis:"as reported balance"},
  {label:"June gross debt",value:"$63.194bn",basis:"short + long-term borrowings"}
 ],
 bridges:[
  {label:"Dividend coverage",formula:"($3.450bn CFO − $0.969bn capex) ÷ $4.896bn paid ≈ 51%",interpretation:"An uncovered six-month dividend is a warning to investigate seasonality and pipeline funding, not a prediction of an immediate cut."},
  {label:"Gross-to-net funding",formula:"$63.194bn borrowings − $11.699bn cash + short investments ≈ $51.5bn",interpretation:"Gross debt is material even though Pfizer remains an investment-grade borrower; debt and the dividend compete for cash."}
 ],
 quote:{speaker:"Pfizer Q2 2026 earnings materials",claim:"Adjusted earnings diverged from GAAP partly due to charges relating to purchased intangible assets.",source:"https://www.sec.gov/Archives/edgar/data/78003/000007800326000095/pfe-20260628.htm",meaning:"Non-cash accounting charges deserve explanation but do not replace the test of future drug sales and cash dividend coverage."},
 debate:{bull:"Pipeline launches and restructuring savings can strengthen margins and eventually free cash for debt reduction.",bear:"Patent expiries, acquisition integration and dividends put simultaneous demands on operating cash.",limit:"First-half cash coverage is not a full-year dividend safety forecast. There is no validated dividend cut announcement or market-implied probability in this note."},
 cases:{
  bear:"Replacement launches disappoint while debt costs and dividends remain, leaving limited cash for investment.",
  base:"Pipeline and savings slowly offset loss of exclusivity, but payout coverage needs a stronger second-half contribution.",
  bull:"Successful new products and stronger cash collection cover distributions and reduce borrowings without asset sales."
 },
 calls:[
  "What revenue and margin is being lost to patent expiry, by major product and calendar year?",
  "Reconcile Q2 GAAP to adjusted EPS and identify noncash impairments versus recurring sales weakness.",
  "What is the full-year operating cash and dividend coverage outlook including seasonality?",
  "How will acquisition returns compete with debt repayment and new clinical investment?"
 ],
 missing:["Full-year adjusted and GAAP cash flow outlook","Contract/patent cliff maturity table by drug and exclusivity date","Contemporaneous PFE bond spread and dividend-yield comparison"],
 primary:[
  {name:"Pfizer June 2026 SEC 10-Q",url:"https://www.sec.gov/Archives/edgar/data/78003/000007800326000095/pfe-20260628.htm"},
  {name:"Pfizer investor portal and prepared Q2 remarks",url:"https://investors.pfizer.com/overview/"}
 ]
},
{
 ticker:"PLTR",name:"Palantir",heading:"A great operating business with an unforgiving price tag",
 period:"Q2 2026 ended 30 June; valuation snapshot dated 28 October",
 centralQuestion:"What growth rate is already embedded in the stock before the next earnings print?",
 pitch:[
  "Palantir sells software platforms that integrate data and operational decisions for government and commercial customers. A contract can cover a long delivery period, but the accounting revenue arrives only when performance conditions are satisfied.",
  "The quarter was extraordinary: $1.935bn sales (+93% year on year), $912m GAAP operating profit (47% margin) and $1.216bn of cash from operations. Management raised full-year revenue guidance to a midpoint around $8.154bn."
 ],
 theMoney:[
  "Management also reported $3.373bn of total contract value signed in Q2 and $6.238bn of remaining U.S. commercial deal value. Those are **not the same as quarterly revenue or cash collected**. Contract definitions include options and timing that need to be understood.",
  "At the dated 28 October equity valuation of approximately $473bn, the stock traded around 58 times management's projected **full-year** 2026 revenue. That is a market-cap-to-sales comparison, not a forward P/E, EV-to-revenue or a valuation that remains current after the next market move.",
  "The balance sheet had roughly $9.2bn in cash and short-term Treasury securities and no equivalent conventional borrower distress. The shark is not worried about imminent insolvency; the shark asks how extraordinary a business must become to justify paying such a multiple."
 ],
 theCatch:[
  "Government contracts may depend on budgets, procurement cycles and option exercises. Commercial contracts can be large without their full value turning into immediate sales. Very high adjusted cash-flow margins should also be compared with GAAP profitability, share-based compensation and collection timing.",
  "An excellent next quarter can fail to satisfy shareholders if expectations already demand exceptional growth for years. Business quality and investment entry price are distinct decisions."
 ],
 balance:[
  "Liquidity approximately $9.2bn in cash and short-term Treasuries, supporting a strong net-cash story.",
  "Q2 cash from operations $1.216bn; company-adjusted FCF $1.220bn. Identify the adjusted definition before comparing the two measures or annualising the quarter.",
  "Pay attention to potential stock-based dilution and the difference between contract value, remaining value, billings and recognised revenue."
 ],
 metrics:[
  {label:"Q2 revenue",value:"$1.935bn",basis:"+93% year on year"},
  {label:"Q2 GAAP op profit",value:"$0.912bn",basis:"~47% reported margin"},
  {label:"Q2 operating cash",value:"$1.216bn",basis:"63% of sales"},
  {label:"Q2 adjusted FCF",value:"$1.220bn",basis:"company-defined measure"},
  {label:"Q2 total contract value",value:"$3.373bn",basis:"not quarterly revenue"},
  {label:"US commercial remaining deal value",value:"$6.238bn",basis:"not cash in bank"},
  {label:"FY26 guided sales midpoint",value:"~$8.154bn",basis:"management projection"},
  {label:"Dated market cap / guidance",value:"~58×",basis:"28 Oct estimate · not live"}
 ],
 bridges:[
  {label:"Operating economics",formula:"$0.912bn operating profit ÷ $1.935bn revenue ≈ 47%",interpretation:"Unlike a speculative software start-up, this business is already reporting high GAAP operating margins."},
  {label:"Expectations test",formula:"~$473bn 28 Oct market cap ÷ ~$8.154bn FY26 guide ≈ 58× sales",interpretation:"A valuation multiple embeds future outcomes; a strong quarter does not automatically imply a cheap stock."}
 ],
 quote:{speaker:"Palantir Q2 issuer release",claim:"Management raised FY2026 revenue guidance to $8.150–8.158bn and adjusted free cash flow guidance to $4.5–4.7bn.",source:"https://investors.palantir.com/news-details/2026/Palantir-Reports",meaning:"The growth and cash guide is management's projection, not realised next-quarter profit or a return guarantee."},
 debate:{bull:"The moat may deepen if government and large commercial customers repeatedly expand operational deployments and pay high margins.",bear:"Extreme sales multiples require sustained growth; procurement options, customer timing and eventual competition can upset that expectation.",limit:"No sourced analyst valuation consensus or accurate option-implied move has been established. The ~58× multiple is dated and must never be shown as today's live price."},
 cases:{
  bear:"Revenue growth slows, contract options do not convert and the equity multiple compresses even with GAAP profit.",
  base:"Strong growth persists, but guidance must keep rising to support the existing high expectation bar.",
  bull:"Large customer contracts convert promptly into recognised revenue and cash with margins staying unusually high."
 },
 calls:[
  "What portion of new TCV is committed non-cancellable spend rather than unexercised options?",
  "How quickly is remaining deal value converting into recurring recognised sales and collected cash?",
  "Does government growth depend on one-off procurement events or repeatable multi-year operating systems?",
  "What forecast growth and dilution assumptions could justify the current valuation multiple?"
 ],
 missing:["Consistent valuation and market-cap source as of the same instant","Independent pre-Q3 consensus and comparable revenue/EPS bar","Contract options versus committed amount and collection vintage"],
 primary:[
  {name:"Palantir Q2 issuer release",url:"https://investors.palantir.com/news-details/2026/Palantir-Reports"},
  {name:"Palantir Q2 investor presentation",url:"https://investors.palantir.com/files/Palantir%20-%20Q2%202026%20Business%20Update.pdf"}
 ]
}
];

export function getEarningsCase(ticker:string|null|undefined):EarningsCase|null{
 if(!ticker||!/^[A-Z]{1,5}$/.test(ticker.toUpperCase())) return null;
 return EARNINGS_CASES.find(item=>item.ticker===ticker.toUpperCase())||null;
}
