import Link from "next/link";
import type {VerifiedEarningsScorecard} from "@/lib/blue-desk-earnings-results";
import EarningsEvidenceGraphic from "./EarningsEvidenceGraphic";
import s from "./ChartWatchArticle.module.css";

/** Explicit first public Chart Watch edition, authored from primary issuer
 * data. Reuses the existing earnings visual rather than another chart engine.
 * Only an already-admitted exact public scorecard may render this reader.
 */
export default function ChartWatchArticle({scorecard,backHref}:{scorecard:VerifiedEarningsScorecard;backHref:string}){
 if(scorecard.id!=="amd-2026q3"||scorecard.preliminary||
    !scorecard.sourceUrl.startsWith("https://newsroom.amd.com/"))return null;
 return <article className={s.article} data-chart-watch-article="amd-2026q3" data-original-source-qualified="true">
   <nav className={s.back}><Link href={backHref}>← Key Stories</Link><span> / Chart Watch / AMD</span></nav>
   <header className={s.hero}>
     <p className={s.eyebrow}>BLUEBELLY · CHART WATCH · 3 NOVEMBER 2026 ET · AMD</p>
     <h1>AMD's AI Sales Soar 97%. Why Did Cash Flow Fall 64%?</h1>
     <p className={s.deck}>Data Centre sales almost doubled, yet quarterly cash generation went backwards. Is the cost of scaling AI infrastructure starting to catch up with demand?</p>
     <p className={s.dateline}>Issuer results released 3 Nov 2026 after the US regular session · Fiscal quarter ended 26 Sep 2026 · US dollars · Updated for publication 4 Nov 2026 MYT</p>
   </header>
   <div className={s.quick} data-quick-market-brief="source-led-chart-watch">
     <div><strong>What happened</strong><p>AMD revenue grew 45% to $13.377bn; Data Centre sales climbed 97% to $8.546bn.</p></div>
     <div><strong>What complicates it</strong><p>Company-reported free cash flow fell 64% to $554m from $1.530bn a year earlier.</p></div>
     <div><strong>What to watch</strong><p>Q4 sales, inventory, margins and cash conversion—not an assumed earnings beat or share-price cause.</p></div>
   </div>
   <div className={s.prose}>
    <p>AMD has delivered the AI growth figure investors wanted: Data Centre revenue almost doubled in its latest quarter, while group sales reached a record $13.4 billion. But a second number complicates the celebration. AMD generated just $554 million in free cash flow, down from $1.53 billion a year earlier. AI sales are accelerating; the cash flowing out of that expansion is accelerating too.</p>
    <EarningsEvidenceGraphic scorecard={scorecard} variant="segments"/>
    <div className={s.tableWrap} data-chart-watch-table="amd-segment-revenue">
     <table><caption>As-reported AMD segment sales, US$ billions</caption>
      <thead><tr><th scope="col">Segment</th><th scope="col">Q3 2025</th><th scope="col">Q3 2026</th><th scope="col">YoY</th></tr></thead>
      <tbody><tr><th scope="row">Data Centre</th><td>4.341</td><td>8.546</td><td>+97%</td></tr>
       <tr><th scope="row">Client &amp; Gaming</th><td>4.048</td><td>3.722</td><td>−8%</td></tr>
       <tr><th scope="row">Embedded</th><td>0.857</td><td>1.109</td><td>+29%</td></tr>
       <tr><th scope="row">Consolidated</th><td>9.246</td><td>13.377</td><td>+45%</td></tr>
      </tbody>
     </table>
    </div>
    <p>The chart captures how concentrated the company's growth has become. Data Centre added $4.205 billion in sales compared with the same quarter last year. AMD as a whole added $4.131 billion. That means Data Centre accounted for about 102% of the group's net growth: weakness in Client &amp; Gaming more than offset the recovery in Embedded. At nearly 64% of total sales, Data Centre is no longer a side business. It is the main engine.</p>
    <p>That engine has a plausible source of demand. Management cited its EPYC server CPUs and Instinct AI accelerators, as cloud providers and other customers increase spending on computing power. Higher sales matter, but investors ultimately own the residual cash that those sales produce. Revenue growth on its own cannot establish that a business is becoming more economical to run.</p>
    <h2>Why did free cash flow fall?</h2>
    <EarningsEvidenceGraphic scorecard={scorecard} variant="fcf"/>
    <p>AMD reported operating cash flow from continuing operations of $1.202 billion in the third quarter and cash capital expenditure of $648 million. The difference is the $554 million of reported free cash flow. A year earlier, continuing-operations cash flow was $1.788 billion and capital spending was $258 million, leaving $1.530 billion. Using the prior year's total operating cash flow instead would overstate the comparable free-cash-flow base because that total included discontinued operations.</p>
    <p>The decline is not, by itself, evidence that AI orders are unprofitable. Working capital, product deliveries and customer payments rarely line up neatly each quarter. AMD's inventory increased from $8.468 billion in June to $11.463 billion in September, however. That is a material rise in resources tied up ahead of shipments, and it puts the next period's cash conversion under closer scrutiny.</p>
    <h2>A strong outlook, with a margin question</h2>
    <p>AMD guided fourth-quarter revenue to roughly $17 billion, plus or minus 3%, pointing to another sequential increase. Yet it projected non-GAAP gross margin of around 55%, compared with 56% in the reported quarter. More AI shipments therefore do not automatically translate into a higher percentage margin. The answer depends on product mix, production costs and how quickly customers absorb the new supply.</p>
    <p>There is financial breathing room: the company reported $15.776 billion in cash, equivalents and short-term investments, versus $7.079 billion of debt. The $8.697 billion difference is liquid assets <em>including</em> short-term investments, less funded debt—not strict cash-only net cash. It also reflects a different financing position from the prior quarter.</p>
    <p>The bull case is that inventory and investment are arriving before a new wave of AI deliveries, allowing cash flow to recover as volumes scale. The bearish alternative is that AMD is relying on one increasingly important customer market while spending and working-capital demands grow faster than expected.</p>
    <p>That makes the next report unusually revealing. If Data Centre growth persists while inventory stabilises and free cash flow recovers, the expansion looks more sustainable. If sales keep climbing but cash conversion and gross margin remain under pressure, the market will have a harder question to answer than how many accelerators AMD can ship.</p>
   </div>
   <footer className={s.evidence} data-chart-watch-evidence="source-original" >
    <h2>Sources, basis and limits</h2>
    <p><a href={scorecard.sourceUrl} target="_blank" rel="noopener noreferrer">AMD third-quarter 2026 financial results (issuer original)</a>.
    {" "}{scorecard.additionalSourceUrl?<a href={scorecard.additionalSourceUrl} target="_blank" rel="noopener noreferrer">SEC-filed earnings presentation (8-K accession 0000002488-26-000188)</a>:null}.
    The charts are original Bluebelly visualisations of reported financial facts, not redistributed vendor graphics.</p>
    <p>All chart values cover the fiscal third quarters ended 27 September 2025 and 26 September 2026. The release is dated 3 November 2026 ET; no subsequent regular-session closing reaction or independently frozen analyst consensus is claimed. Free cash flow uses the issuer's continuing-operations reconciliation.</p>
    <Link href={backHref}>Return to Key Stories</Link>
   </footer>
 </article>;
}
