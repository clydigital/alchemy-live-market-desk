import Link from "next/link";
import styles from "./EarningsFundamentals.module.css";

/**
 * Dated public editorial fact pack, based on public issuer filings.
 * This is NOT the canonical Story/Regime ledger or a live earnings feed.
 * A pre-release snapshot must never silently become the latest result.
 */
const researchCutoff = "29 October 2026 · pre-results";

type Company = {
  ticker: string; name: string; period: string;
  question: string; business: string; money: string; metrics: readonly [string,string][];
  attraction: string; objection: string; investorVoices: string;
  catalyst: string; sourceLabel: string; primary: string; secondSource?: string;
};
const COMPANIES: readonly Company[] = [
  {
    ticker:"AMZN",name:"Amazon",period:"Q2 2026 / trailing twelve months to June",
    question:"Can AWS fund an investment programme bigger than free cash flow?",
    business:"Retail earns through direct sales, third-party seller fees and fulfilment; advertising and Prime add revenue. AWS sells cloud compute, storage and AI infrastructure. Segment revenue does not equal segment profit.",
    money:"AWS produced about 60% of group operating income despite a much smaller share of sales. Operating cash generation was considerable, but net property-and-equipment investment exceeded it. Q2 reported net income included a major non-operating Anthropic-related investment gain, not cash earned from AWS customers.",
    metrics:[["Q2 sales","$200.6bn · +20% YoY"],["Q2 operating profit","$27.5bn · AWS $16.6bn"],["TTM operating cash","$161.4bn"],["TTM net equipment investment","$169.0bn"],["TTM free cash flow","−$7.6bn"],["June cash + marketable securities","~$123.0bn"],["June long-term debt","~$128.9bn"]],
    attraction:"AWS demand and operating profits give Amazon an established engine to help finance expansion.",
    objection:"A strong reported profit can coexist with negative free cash flow; new commitments, depreciation, financing and construction bills may move the payback date further out.",
    investorVoices:"Management emphasises committed AWS demand. Critics question the cash return on the AI build-out. Those are competing arguments, not verified future returns.",
    catalyst:"Compare Q3 AWS revenue and operating margin, realised cash capex, borrowing and lease commitments, and the management payback timeline against the July guidance. Q3 outcomes were not available at this snapshot.",
    sourceLabel:"Amazon Q2 issuer release and filings",
    primary:"https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Second-Quarter-Results/default.aspx",
    secondSource:"https://www.sec.gov/Archives/edgar/data/1018724/000101872426000024/amzn-20260630xex991.htm",
  },
  {
    ticker:"INTC",name:"Intel",period:"Q2 2026 / balance at 27 June",
    question:"Will fresh capital fix Intel Foundry's economics?",
    business:"Intel sells processors and related platforms through its product operations while Intel Foundry manufactures chips. Foundry segment revenue includes internal sales, so the segment revenues cannot be added together without eliminations.",
    money:"A roughly $11bn GAAP net loss and positive adjusted earnings tell different stories because of a large non-cash share-related valuation charge. The more direct operating warning is Foundry's roughly $2.1bn quarterly operating loss. The August equity offering is financing, not operating cash earned.",
    metrics:[["Q2 revenue","~$16.1bn · +25% YoY"],["Q2 GAAP net result","~−$11bn · heavily affected by non-cash charge"],["Foundry operating result","~−$2.1bn"],["June cash + short-term investments","~$29.73bn"],["June borrowings","~$50.54bn"],["August equity offering","~$20bn gross · dilution"]],
    attraction:"Improved product demand and a large funding cushion can give its process turnaround time.",
    objection:"Foundry utilisation, external-customer economics, manufacturing yields and future shareholder dilution remain unresolved.",
    investorVoices:"Turnaround bulls focus on the product recovery and 18A pipeline; sceptics want evidence of paid external foundry volumes and falling cash demands. Neither case is settled by adjusted EPS alone.",
    catalyst:"Verify offering proceeds and subsequent cash balances in the next filing, then compare Foundry losses, external contracts and cash capex after Q3 release.",
    sourceLabel:"Intel Q2 release and equity offering",
    primary:"https://www.intc.com/news-events/press-releases/detail/1776/intel-reports-second-quarter-2026-financial-results",
    secondSource:"https://newsroom.intel.com/corporate/intel-announces-upsize-and-pricing-of-20-billion-common-stock-offering",
  },
  {
    ticker:"SNDK",name:"SanDisk",period:"Fiscal Q4 2026 ended 3 July",
    question:"Are record NAND margins a new normal or a peak-cycle windfall?",
    business:"SanDisk sells NAND flash storage for consumers and data centres. Demand and supply discipline can lift selling prices faster than unit shipments.",
    money:"Management attributed roughly two-thirds of the quarter-on-quarter revenue growth to prices rather than volume. That supports current profits but makes future returns sensitive to pricing normalisation. Receivables increased sharply and merit a collection check.",
    metrics:[["Quarterly revenue","$8.97bn · +51% QoQ"],["GAAP gross margin","84.6%"],["Quarterly operating profit","~$7.04bn"],["July cash","~$4.76bn"],["Long-term borrowings","None reported"],["Accounts receivable","~$4.71bn · vs $1.07bn year ago"]],
    attraction:"Strong balance sheet, AI-related storage demand and new long-term customer arrangements.",
    objection:"Price-led margins can reverse. A minimum customer purchase agreement is not a guarantee of free cash flow at current margins.",
    investorVoices:"Some holders extrapolate long-term agreements into guaranteed cash generation. Others worry that expectations are already stretched. Forum projections are opinions, not contract disclosures.",
    catalyst:"Separate price versus shipment volume, check the receivable-to-cash bridge and the enforceability of customer minimums in the next release.",
    sourceLabel:"SanDisk fiscal Q4 2026 financial statements",
    primary:"https://investor.sandisk.com/news-releases/news-release-details/sandisk-reports-fiscal-fourth-quarter-2026-financial-results",
  },
  {
    ticker:"AMD",name:"Advanced Micro Devices",period:"Q2 2026 / balance at 27 June",
    question:"What is the full shareholder cost of winning major AI customers?",
    business:"AMD sells EPYC processors, AI accelerators and other chips for data centres, PCs and gaming. AI deployment growth alone does not establish attractive incremental chip margins.",
    money:"AMD had net cash on the June balance sheet. Its 10-Q also describes conditional warrants allowing OpenAI and Meta to purchase up to 160 million shares each at $0.01, contingent on milestones. None had vested by 27 June: this is potential future dilution, not shares already issued.",
    metrics:[["Q2 sales","$11.54bn · +50% YoY"],["Q2 data-centre sales","$6.72bn · +107% YoY"],["June cash + short-term investments","~$13.11bn"],["June debt","~$3.23bn"],["Q2 simple free cash flow","~$1.56bn"],["Maximum contingent customer warrants","320m shares · vesting conditions"]],
    attraction:"Growing AI and server sales with a net-cash balance sheet.",
    objection:"GPU gross margins, contract economics and conditional share dilution may materially change the returns earned by existing shareholders.",
    investorVoices:"The bull case is a credible second supplier of AI compute; the bear case questions margin and dilution-adjusted returns. The exact warrant terms belong ahead of any simple growth multiple.",
    catalyst:"Read Q3 gross margins, GPU mix, cash conversion and disclosures about warrant vesting against customer deployment milestones.",
    sourceLabel:"AMD Q2 2026 10-Q · financials and warrants",
    primary:"https://ir.amd.com/financial-information/sec-filings/content/0000002488-26-000123/amd-20260627.htm",
  },
  {
    ticker:"AAPL",name:"Apple",period:"Fiscal Q3 / nine months ended 27 June 2026",
    question:"Can iPhone and Services growth defend a premium valuation?",
    business:"Apple generates cash from devices, accessories and Services, with materially different gross-margin profiles. Device supply costs and upgrade cycles affect the near-term earnings mix.",
    money:"Nine-month cash conversion was substantial. June-quarter earnings also benefited from tariff-related refunds, which should be separated from underlying operating growth. Reports of component-order cuts were not confirmed as actual iPhone sell-through.",
    metrics:[["June-quarter sales","~$109.4bn · +16% YoY"],["June-quarter diluted EPS","$2.02 · included tariff refund benefit"],["June cash + marketable securities","~$146.52bn"],["June borrowings","~$84.34bn"],["Nine-month simple free cash flow","~$110.20bn"]],
    attraction:"One of the strongest established cash-generating franchises in the universe.",
    objection:"Demand, product mix and memory costs still need to justify the current equity valuation; temporary refund benefits are not perpetual margins.",
    investorVoices:"Optimists cite premium-device loyalty and Services; sceptics cite component-order reports. Treat supplier commentary as a lead until validated against sales, inventory and guidance.",
    catalyst:"Check iPhone revenue, geographic demand, gross-margin drivers, inventory and Services growth after the next issuer report.",
    sourceLabel:"Apple fiscal Q3 release and 10-Q",
    primary:"https://www.sec.gov/Archives/edgar/data/320193/000032019326000020/aapl-20260627.htm",
  },
  {
    ticker:"PFE",name:"Pfizer",period:"First six months ended 28 June 2026",
    question:"Does recurring cash flow support both dividends and debt reduction?",
    business:"Pfizer earns from patented medicines and vaccines; patent expirations require successful launches, acquisitions and development investment to replace older product sales.",
    money:"First-half operating cash flow minus property purchases was about $2.48bn against $4.90bn of dividends paid. This period comparison raises a coverage question but is not proof that the dividend must be cut: seasonality and balance-sheet liquidity matter.",
    metrics:[["June cash + short-term investments","~$11.70bn"],["June total borrowings","~$63.19bn"],["First-half operating cash flow","$3.45bn"],["First-half property investment","$0.97bn"],["Simple first-half free cash flow","$2.48bn"],["First-half dividends paid","$4.90bn"]],
    attraction:"An established medicine portfolio, potential launches and access to investment-grade funding.",
    objection:"Patent expirations, acquired-intangible impairments and leverage leave competing uses for free cash flow.",
    investorVoices:"Income investors emphasise dividends and recovery potential; sceptics focus on debt, product replacement and dividend coverage on a full-year basis.",
    catalyst:"Track replacement product sales, debt maturities and full-year cash flow versus dividend outlays; do not annualise the first-half shortfall mechanically.",
    sourceLabel:"Pfizer Q2 2026 SEC 10-Q",
    primary:"https://www.sec.gov/Archives/edgar/data/78003/000007800326000095/pfe-20260628.htm",
  },
  {
    ticker:"PLTR",name:"Palantir",period:"Q2 2026 / valuation as of 28 October",
    question:"Can exceptional software growth justify an exceptional valuation?",
    business:"Palantir licenses software and services that help governments and enterprises integrate data and deploy operational AI. Recognised revenue is not identical to customer pipeline or signed contract value.",
    money:"The balance sheet has substantial cash and Treasuries and no comparable conventional debt stress. Valuation is the central issue: about $473bn equity value divided by roughly $8.15bn guided 2026 sales is approximately 58 times forward annual revenue.",
    metrics:[["Q2 sales","~$1.94bn · +93% YoY"],["Q2 operating cash flow","~$1.22bn"],["June cash + short-term Treasuries","~$9.20bn"],["FY26 guided revenue","~$8.15bn"],["28 Oct market cap / FY26 guided sales","~58× · dated estimate"]],
    attraction:"Rapid revenue expansion, high margins and strong liquidity.",
    objection:"An excellent quarter can still disappoint an equity price implying years of unusually strong growth. The valuation multiple is dated, not a live quote.",
    investorVoices:"Bulls cite government adoption and accelerating enterprise contracts. Bears focus on model-provider competition and the amount of growth already priced in.",
    catalyst:"Measure contract conversion, commercial versus government revenue, incremental cash margin and guidance against pre-release expectations.",
    sourceLabel:"Palantir Q2 SEC filing and management guidance",
    primary:"https://www.sec.gov/Archives/edgar/data/1321655/000132165526000041/pltr-20260630.htm",
  },
];

export default function EarningsFundamentals({amazonFeatureHref,deepBaseHref}:{amazonFeatureHref:string;deepBaseHref:string}) {
  return <section id="earnings-fundamentals" className={styles.root} data-bluebelly-fundamentals="dated-editorial-public">
    <div className={styles.heading}>
      <p className={styles.kicker}>EARNINGS &amp; FUNDAMENTALS / INVESTOR TEST</p>
      <h2>Does the business justify the price?</h2>
      <p>Start with how the company earns money. Then follow profit into cash, subtract the investment bill, and ask which risks the market has already priced in.</p>
      <p className={styles.disclosure}><strong>Research cutoff: {researchCutoff}.</strong> Company reporting periods differ. These are dated public-source editorial comparisons, not automatically refreshed results, investment recommendations or new canonical Bluebelly Story verdicts. Pre-release outcomes, consensus surprises and post-event price reactions are not asserted.</p>
    </div>
    <div className={styles.cards}>
      {COMPANIES.map(company=><details key={company.ticker} className={styles.company} open={company.ticker==="AMZN"}>
        <summary><span className={styles.ticker}>{company.ticker}</span><span className={styles.summaryText}><strong>{company.name}</strong><span>{company.question}</span></span><span className={styles.chevron} aria-hidden="true">+</span></summary>
        <div className={styles.body}>
          <p className={styles.period}>LATEST REVIEWED BASE · {company.period}</p>
          <h3>How it makes money</h3><p>{company.business}</p>
          <h3>What the financial statements reveal</h3><p>{company.money}</p>
          <div className={styles.metricGrid}>{company.metrics.map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
          <div className={styles.arguments}>
            <div><h3>The attraction</h3><p>{company.attraction}</p></div>
            <div><h3>The catch</h3><p>{company.objection}</p></div>
          </div>
          <h3>What people are debating</h3><p>{company.investorVoices}</p>
          <p className={styles.next}><strong>What changes the verdict?</strong> {company.catalyst}</p>
          <div className={styles.links}>
            <Link href={deepBaseHref+"?view=earnings&ticker="+encodeURIComponent(company.ticker)}>Read the complete {company.name} investor investigation →</Link>
            <a href={company.primary} target="_blank" rel="noopener noreferrer">{company.sourceLabel} ↗</a>
            {company.secondSource?<a href={company.secondSource} target="_blank" rel="noopener noreferrer">Supporting official document ↗</a>:null}
            {company.ticker==="AMZN"?<Link href={amazonFeatureHref}>Read the full Amazon cash-investment story →</Link>:null}
          </div>
        </div>
      </details>)}
    </div>
    <aside className={styles.rates} aria-label="Bond funding cross-check">
      <p className={styles.kicker}>CROSS-ASSET RESEARCH / NOT A CREDIT VERDICT</p>
      <h3>Rising yields are not the same as company-specific bond stress.</h3>
      <p>On 28 October the Treasury's indicative 2-year, 10-year and 30-year yields were 4.67%, 5.05% and 5.37% respectively. The rising risk-free benchmark can pressure long-duration equity valuations generally. To show creditors are penalising a particular issuer, compare its own bond spread or CDS with a matched Treasury and a previous observation.</p>
      <p>Reported spreads on 23 October differed widely among Oracle, SpaceX and Meta. Those observations must not be passed off as Amazon\'s borrowing rate. Always distinguish equity market reaction, Treasury term structure, company credit spreads and operating cash flow. The full company investigations distinguish cash actually earned from financial guidance and prepayments.</p>
      <a href="https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value_month=202610" target="_blank" rel="noopener noreferrer">US Treasury original dated yield curve ↗</a>
    </aside>
  </section>;
}
