import Link from "next/link";
import {OCT30_SELL_OFF} from "@/lib/bluebelly-oct30-tech-selloff";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";

const sources=[
 {label:"AP: 30 October technology-led market decline (intraday)",url:"https://apnews.com/article/16c266731fdf64178f38070af2b42497"},
 {label:"Amazon: Q3 2026 original earnings release",url:"https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/default.aspx"},
 {label:"Intel: Q3 2026 original earnings release",url:"https://www.intc.com/news-events/press-releases/detail/1786/intel-reports-third-quarter-2026-financial-results"},
 {label:"Intel: Q3 2026 Form 10-Q (foundry external revenue)",url:"https://www.intc.com/filings-reports/all-sec-filings/content/0000050863-26-000191/intc-20260926.htm"},
 {label:"Alphabet: Q3 2026 filed results",url:"https://www.publicnow.com/view/ED018F4AAE12FB3B1BD1E9649EA9BF381E69B00F"},
 {label:"Reddit: Q3 2026 investor release",url:"https://investor.redditinc.com/news-events/news-releases/news-details/2026/Reddit-Reports-Third-Quarter-2026-Results/default.aspx"},
 {label:"Reuters: Reddit search-referral risk, 30 October",url:"https://www.reuters.com/business/reddit-pinterest-shares-tumble-weak-user-revenue-growth-2026-10-30/"},
 {label:"St Louis Fed/ICE: high-yield credit spreads (29 October close)",url:"https://alfred.stlouisfed.org/release?rd=2018-06-28&rid=209"},
 {label:"Federal Reserve: FOMC statement, 28 October",url:"https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm"},
] as const;
const articleStyle:React.CSSProperties={maxWidth:930,margin:"20px auto",color:"var(--bb-text)",lineHeight:1.8};
const sectionStyle:React.CSSProperties={border:"1px solid var(--bb-card-border)",background:"var(--bb-surface)",borderRadius:10,padding:"22px clamp(16px,3vw,34px)",marginTop:18};
const subtle:React.CSSProperties={fontSize:13,color:"var(--bb-muted)"};
export default function Oct30TechSelloffFeature({host}:{host:string|null}){
 const crashHref=blueDeskPublicHref("/blue-desk/crash-opportunity",host);
 return <article data-bluebelly-oct30-selloff="dated-editorial-intraday" style={articleStyle}>
   <header style={sectionStyle}>
    <p style={{...subtle,fontWeight:800,letterSpacing:".10em",color:"var(--bb-accent)"}}>BLUEBELLY / KEY STORY · FRIDAY 30 OCTOBER 2026</p>
    <h1 style={{fontSize:"clamp(30px,4vw,51px)",lineHeight:1.12,margin:"12px 0 17px"}}>{OCT30_SELL_OFF.title}</h1>
    <p style={{fontSize:"clamp(17px,2vw,21px)",lineHeight:1.55}}>The business of AI is still growing. Wall Street is increasingly asking who gets the cash—and how much investors have already paid for the promise.</p>
    <p style={subtle}><strong>Market snapshot:</strong> Friday 30 October 2026, approximately 2:15 p.m. EDT / Saturday 31 October, 2:15 a.m. MYT. Reported intraday levels—not the final closing session or a measured earnings-event attribution.</p>
    <p><Link href={crashHref}>Crash vs Opportunity: read the deeper, two-sided regime watch →</Link></p>
   </header>
   <section style={sectionStyle}>
    <h2>One market, two very different warnings</h2>
    <p>The Nasdaq Composite was down about <strong>3.4%</strong>, the S&amp;P 500 about <strong>2.2%</strong>, and Intel approximately <strong>30.9%</strong> by the reported Friday afternoon snapshot. These figures describe a real sell-off, not proof that a lasting market crash has begun. <a href={sources[0].url} target="_blank" rel="noopener noreferrer">AP's dated market report</a> documents the reaction.</p>
    <p>Big Tech faces a cash-flow objection; Intel faces an earnings-and-guidance objection. Those can reinforce a technology sell-off without being the same problem. The critical question is whether falling prices remain concentrated in expensive shares—or spread through lenders, smaller companies and forced sellers.</p>
   </section>
   <section style={sectionStyle}>
    <h2>Amazon: growth is accelerating, but cash is leaving faster</h2>
    <p>In the third quarter, Amazon reported <strong>$46.0bn AWS revenue, up 39%</strong>, and company-wide <strong>$28.1bn operating income</strong>. Trailing twelve-month operating cash flow increased <strong>29% to $168.3bn</strong>. This is a business generating substantial money from operations.</p>
    <p>Yet trailing free cash flow fell to <strong>negative $42.4bn</strong>, versus positive $14.8bn a year earlier. Trailing net purchases of property and equipment reached about $210.7bn. In other words, sales are rising, but investment spending has grown even faster. The company attributes much of that acceleration to AI infrastructure. Those are <em>trailing annual</em> numbers, not the loss in one quarter.</p>
    <p><strong>The investor's test:</strong> What return will all those new data centres earn? Amazon could build a larger, very profitable AWS business and still disappoint shareholders if too much future success is already priced in. Conversely, high investment spending alone is not evidence of insolvency. <a href={sources[1].url} target="_blank" rel="noopener noreferrer">Original Amazon release</a>.</p>
   </section>
   <section style={sectionStyle}>
    <h2>Intel: an apparently strong quarter meets a weaker future</h2>
    <p>Intel reported <strong>$16.5bn third-quarter revenue, up 21%</strong>, with data-centre and AI segment growth of 78%. But it forecast only <strong>$15–16bn</strong> revenue and $0.25 non-GAAP diluted EPS for the fourth quarter. Investors are looking at what the next quarter may earn, not simply celebrating the previous one. <a href={sources[2].url} target="_blank" rel="noopener noreferrer">Intel's original release</a>.</p>
    <p>The foundry business also deserves careful reading. Of its roughly <strong>$6.7bn segment revenue</strong> in Q3, about <strong>$6.3bn was intersegment</strong>; only <strong>$411m was external</strong>, and part of that external increase came from a non-recurring contract. Counting all foundry segment revenue as proven outside-customer demand would exaggerate the investment case. <a href={sources[3].url} target="_blank" rel="noopener noreferrer">Intel's filed 10-Q</a>.</p>
    <p>That is why a strong industry trend does not automatically rescue every company supplying the industry.</p>
   </section>
   <section style={sectionStyle}>
    <h2>A more awkward complication: AI can hurt the customer</h2>
    <p>Alphabet's third-quarter revenue increased <strong>25% to $127.6bn</strong> and Google Cloud rose <strong>103% to $30.7bn</strong>. Yet the week's reaction showed how hard investors were scrutinising expectations and investment costs. <a href={sources[4].url} target="_blank" rel="noopener noreferrer">Alphabet's original results</a>.</p>
    <p>Reddit presents the mirror image. It reported <strong>$895m revenue, up 53%</strong>, and 130.3m daily active unique visitors. But the company's warning about reduced referrals from Google's AI-powered search features unsettled investors. This is not just about what companies spend to build AI: it is also about whether AI changes how another business acquires and monetises customers. <a href={sources[5].url} target="_blank" rel="noopener noreferrer">Reddit's results</a>; <a href={sources[6].url} target="_blank" rel="noopener noreferrer">Reuters' reported referral-risk context</a>.</p>
   </section>
   <section style={sectionStyle}>
    <h2>The line between a correction and a credit crash</h2>
    <p>Heavy stock losses are not sufficient to establish a system-wide liquidity crisis. On Thursday 29 October, the ICE BofA broad US high-yield option-adjusted spread was <strong>3.26 percentage points</strong>, the latest completed observation available for this edition. This is the extra yield demanded above comparable Treasuries, not the corporate bond's total yield. Friday's matching data were not yet available at the cited snapshot. <a href={sources[7].url} target="_blank" rel="noopener noreferrer">ICE data via the St Louis Fed</a>.</p>
    <p>The danger rises if equity weakness spreads into financing: rising borrowing spreads, deteriorating refinancing access and lenders demanding more collateral. An investor or business then may have to sell not because its long-term conviction has changed, but because its funding has.</p>
    <p>The Fed held the funds rate at <strong>3.75–4.00%</strong> on 28 October, with two officials preferring a hike. Inflation above target can limit how rapidly the central bank responds to market pain. But a Fed hold by itself cannot explain every price move, and reserve-maintenance operations are not an automatic equity rescue. <a href={sources[8].url} target="_blank" rel="noopener noreferrer">FOMC original statement</a>.</p>
   </section>
   <section style={sectionStyle}>
    <h2>Two deals the market could be pricing</h2>
    <p><strong>Correction and recovery:</strong> AI demand keeps growing, hyperscalers demonstrate better cash conversion, credit remains available, and market breadth stops deteriorating. The growth trade may be repriced, not destroyed.</p>
    <p><strong>Wider deleveraging:</strong> cash-flow guidance weakens while borrowing costs and credit spreads rise; equal-weight equities and smaller firms join the decline; leveraged players are forced to reduce exposure. Then a valuation reset can turn into a self-reinforcing financing problem.</p>
    <p><strong>Working verdict:</strong> a meaningful, technology-led repricing is observed; a systemic crash remains unconfirmed. Neither an imminent rebound nor a lasting bear market can be inferred from one afternoon.</p>
   </section>
   <section style={sectionStyle}>
    <h2>What would change the verdict?</h2>
    <p><strong>After Friday's close:</strong> verify the official Nasdaq, S&amp;P 500, Russell 2000, equal-weight and semiconductor closing figures. Do not carry the 2:15 p.m. snapshot forward as a full-session close.</p>
    <p><strong>Credit and funding:</strong> obtain 30 October broad high-yield and CCC spreads, corporate issuance and repo/funding measures. Spreads widening alongside broad equity weakness would strengthen the crash-risk branch.</p>
    <p><strong>What the businesses earn:</strong> compare operating cash flow, cash capex, free cash flow and guidance across the same fiscal windows; look for future capex productivity rather than headline revenue alone. The next US ISM releases and 2-year Treasury/Fed pricing provide additional tests.</p>
    <p style={subtle}>This is a time-stamped market explanation and conditional research outlook. It is not an investment recommendation or a probabilistic crash forecast. The <Link href={crashHref}>standing Crash vs Opportunity watch</Link> retains its separate dated gauge and historical scenarios.</p>
   </section>
   <section style={sectionStyle}>
    <h2>Original sources and reading times</h2>
    <ul>{sources.map(s=><li key={s.url}><a href={s.url} rel="noopener noreferrer" target="_blank">{s.label}</a></li>)}</ul>
    <p style={subtle}>As-of for reported market moves: 30 Oct 2026, 14:15 EDT. Issuer results: Q3 2026, as dated above. Credit: 29 Oct closing series. Later observations require an edition update.</p>
   </section>
  </article>;
}
