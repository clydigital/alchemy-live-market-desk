import Link from "next/link";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";

const ARTICLE_AS_OF="2 November 2026, before the US midterm vote and November releases";
const article:React.CSSProperties={maxWidth:920,margin:"16px auto 80px",lineHeight:1.77,color:"var(--bb-text)"};
const segment:React.CSSProperties={border:"1px solid var(--bb-card-border)",background:"var(--bb-surface)",borderRadius:12,padding:"clamp(18px,3vw,34px)",marginTop:19};
const muted:React.CSSProperties={color:"var(--bb-muted)",fontSize:13,lineHeight:1.65};
const cite=(href:string,label:string)=><a href={href} target="_blank" rel="noopener noreferrer">{label}</a>;
const SOURCES=[
 {name:"Capital Group — historical 12-month midterm price returns",href:"https://www.capitalgroup.com/institutions/lu/en/insights/articles/how-us-midterm-elections-affect-the-markets.html"},
 {name:"Schaeffer's Research — six-month sample and election-date method",href:"https://www.schaeffersresearch.com/content/analysis/2022/10/26/what-election-day-means-for-the-s-p-500"},
 {name:"MSCI — 2026 midterm scenarios for rates, AI and oil",href:"https://www.msci.com/research-and-insights/quick-take/scenario-analysis-rates-ai-and-oil-may-matter-more-than-us-midterms"},
 {name:"StockedUp — original video and timestamped market commentary, 1 November",href:"https://www.youtube.com/watch?v=QT82i3qsHjs"},
 {name:"FX Evolution — original video and timestamped market commentary, 31 October",href:"https://www.youtube.com/watch?v=vYAAtuF8_Cs"},
 {name:"Amazon — original Q3 2026 results",href:"https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/default.aspx"},
 {name:"Alphabet — original Q3 2026 SEC filing",href:"https://www.sec.gov/Archives/edgar/data/1652044/000165204426000080/googexhibit991q32026.htm"},
 {name:"S&P Global — 2026 state and local data-centre ballot measures",href:"https://www.spglobal.com/energy/en/news-research/latest-news/electric-power/100126-data-center-backlash-shapes-midterm-ballots-campaigns-across-us"},
 {name:"BLS — November 2026 economic release calendar",href:"https://www.bls.gov/schedule/2026/11_sched_list.htm"},
] as const;

export default function MidtermRallyFeature({host}:{host:string|null}){
 const weekAhead=blueDeskPublicHref("/blue-desk/newsroom/week-ahead",host);
 const crashWatch=blueDeskPublicHref("/blue-desk/crash-opportunity",host);
 return <article style={article} data-bluebelly-midterm-key-story="frozen-source-labelled-2026-11-02">
  <header style={segment}>
   <p style={{...muted,letterSpacing:".1em",fontWeight:800,color:"var(--bb-accent)"}}>BLUEBELLY / KEY STORY · US MIDTERMS · RESEARCH EDITION</p>
   <h1 style={{fontSize:"clamp(30px,4.4vw,49px)",lineHeight:1.12,letterSpacing:"-.035em",margin:"12px 0 18px"}}>Stocks Always Rose After Midterms. What Could Break the Streak?</h1>
   <p style={{fontSize:"clamp(17px,2vw,21px)",lineHeight:1.55}}>
    Nineteen midterm elections, nineteen positive twelve-month returns. It is a striking historical record. But with AI shares under pressure, credit investors questioning the cost of new data centres and oil threatening another inflation shock, the market has more to settle than who wins Congress.
   </p>
   <p style={muted}><strong>Research frozen:</strong> {ARTICLE_AS_OF}. Historical return figures describe specified samples, not a forecast or a live market reading. Creator chart levels below belong to their 30–31 October observations.</p>
   <p><Link href={weekAhead+"#midterm-asset-views"}>Read the detailed creator-by-asset evidence and full weekly calendar →</Link></p>
  </header>

  <section style={segment}>
   <h2>First, the number everyone wants to believe</h2>
   <p>The bold claim is that the S&amp;P 500 rose after every US midterm election since 1950. That is broadly supported by {cite(SOURCES[0].href,"Capital Group's historical study")}: every one of the 19 completed midterm cycles through 2022 delivered a positive <em>price return</em> in the following twelve months, with an average gain of <strong>15.4%</strong>.</p>
   <p>There is a second number circulating: <strong>13.8%</strong>. It needs a clock attached. A {cite(SOURCES[1].href,"Schaeffer's study published in 2022")} found an average <strong>13.89% over six months</strong> after midterms, in the 18 elections available at that time. That is not the same claim as a 13.8% gain in the next year, and neither figure means shares rise every single day following an election.</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,margin:"22px 0"}}>
    <div style={{background:"var(--bb-bg)",border:"1px solid var(--bb-card-border)",borderRadius:10,padding:15}}>
     <strong style={{fontSize:27,color:"var(--bb-accent)"}}>19/19</strong>
     <div style={muted}>Positive twelve-month post-midterm price returns in Capital Group's 1950–2022 sample</div>
    </div>
    <div style={{background:"var(--bb-bg)",border:"1px solid var(--bb-card-border)",borderRadius:10,padding:15}}>
     <strong style={{fontSize:27,color:"var(--bb-accent)"}}>+15.4%</strong>
     <div style={muted}>Average twelve-month gain in that sample</div>
    </div>
    <div style={{background:"var(--bb-bg)",border:"1px solid var(--bb-card-border)",borderRadius:10,padding:15}}>
     <strong style={{fontSize:27,color:"var(--bb-accent)"}}>+13.89%</strong>
     <div style={muted}>Different study: average six-month gain, 18 elections through 2018</div>
    </div>
   </div>
   <p>Sample endpoints, election-date conventions and dividends matter. Other independent calculations do not always replicate the perfect twelve-month score, so the sound conclusion is narrower: <strong>post-midterm equity performance has historically been exceptionally strong, not mathematically guaranteed.</strong> And a seasonal pattern built across nineteen events cannot tell us whether the next two weeks will bring a sell-off, a short squeeze or a quiet rotation.</p>
  </section>

  <section style={segment}>
   <h2>Now comes the contradiction: the traders sound cautious</h2>
   <p>{cite("https://www.youtube.com/watch?v=QT82i3qsHjs&t=452s","StockedUp, at 7:32")} highlights the favourable election history, but its immediate chart read is defensive. The creator described the SPY ETF losing its recent uptrend, with <strong>$750</strong> as potential support and a recovery above <strong>$760</strong> as a more convincing bullish sign. The near-term watch included volatility-linked UVXY and inverse leveraged SPXS should support fail.</p>
   <p>That is not necessarily hypocrisy. A trader can expect an index to be higher a year later and still believe buying it ahead of a volatile election is a poor entry. The holding period is the missing variable. Volatility and leveraged inverse products also carry path-dependent risks; they are not straightforward ways of holding a twelve-month seasonal thesis.</p>
   <p>{cite("https://www.youtube.com/watch?v=vYAAtuF8_Cs&t=316s","FX Evolution, at 5:16"),} approaches the danger from a different angle: semiconductors near or below their daily 200-day moving average. A single dip is not the main concern. A failed reclaim, followed by lower highs and weaker credit, can signal that a correction is developing into a more durable repricing. FX Evolution compares such episodes with large past declines, while acknowledging other occasions when a quick reclaim ended the risk.</p>
   <p>The hard check is not whether a chart resembles 2000 or 2018 after the fact. It is whether <strong>SMH/SOXX, QQQ, SPY and the equal-weight S&amp;P</strong> make the same improvement—or whether an index rebound is resting on only a handful of giants. FX Evolution's cited QQQ <strong>$680</strong> and SPY <strong>$750</strong> option-support zones are dated creator/vendor observations, not verified live floors.</p>
  </section>

  <section style={segment}>
   <h2>The AI earnings problem the election cannot solve</h2>
   <p>The bigger market question is whether AI investment produces enough cash to justify its scale. Amazon's original {cite(SOURCES[5].href,"third-quarter results")} reported AWS quarterly revenue of <strong>$46.0 billion, up 39%</strong>. But consolidated trailing twelve-month free cash flow was <strong>negative $42.4 billion</strong> as investment spending accelerated. Strong customer demand and weak near-term cash conversion can exist at the same time.</p>
   <p>Alphabet offers another uncomfortable contrast. Its {cite(SOURCES[6].href,"filed Q3 results")} reported Google Cloud revenue up <strong>103% to $30.7 billion</strong>. An investor can accept that AI demand is real and still question how much the next wave of chips, power and buildings must cost before profits catch up.</p>
   <p>This is why FX Evolution watches corporate borrowing costs and credit-default-swap prices alongside semiconductor charts. Rising CCC bond <em>yields</em> need to be distinguished from rising <em>credit spreads</em>: the former can move with underlying Treasury rates, while the latter more directly reflects compensation for credit risk. Broad high-yield spreads, refinancing access, operating cash flow and capex guidance are more useful together than a striking standalone yield.</p>
   <p>There is also a potential upside surprise. If companies begin demonstrating better cash conversion while chips reclaim their longer-term averages, investors could treat the recent correction as an opportunity. If financing grows more expensive while business guidance weakens, an election rally may struggle to last.</p>
  </section>

  <section style={segment}>
   <h2>Where the money may go instead</h2>
   <p>StockedUp's stronger sector conviction is in <strong>XLE and large energy producers</strong>, supported by the possible effects of conflict and tanker disruption around the Strait of Hormuz. It also singles out <strong>VGK</strong>, a European equities ETF, as a downside idea on weaker regional market structure. Those are attributed investment views, not confirmed outcomes.</p>
   <p>FX Evolution's more important counterpoint is that the sell-off has not treated every company equally. It notes relative resilience in healthcare, energy and parts of the equal-weight and consumer markets. If that strength continues and spreads to smaller shares, the story could be an <em>AI-led rotation</em>, not the start of an economy-wide crash. But if credit stress forces indiscriminate selling, the initial sector winners may not be safe either.</p>
   <p>Other markets offer separate clues. FX Evolution sees gold struggling under selling and rate pressure, copper potentially sensitive to AI infrastructure spending, and Bitcoin comparatively resilient despite a reported Binance security incident. None automatically inherits the S&amp;P's historical midterm win rate. The dollar, real yields, copper supply, physical oil shipments and actual crypto liquidity each have their own drivers.</p>
   <p>At the company level, StockedUp highlighted a short-lived bearish <strong>PLTR</strong> chart setup ahead of earnings and an unusual <strong>Boeing</strong> call-options transaction. FX Evolution discussed <strong>TSLA</strong> near $400 and differing support in Apple, Google and Amazon. These are time-stamped creator observations; options activity does not by itself prove informed positioning, and a pre-earnings chart signal can be overwhelmed by fresh guidance.</p>
  </section>

  <section style={segment}>
   <h2>Congress matters. So do the state elections almost nobody is watching.</h2>
   <p>A divided Congress may make major new laws harder to pass, while a unified government could have more room to change spending, taxes and regulation. Neither outcome mechanically lowers bond yields. Investors need to compare the result with expectations, then inspect proposed legislation, funding and the Treasury market's response.</p>
   <p>For AI infrastructure there is a more local complication. {cite(SOURCES[7].href,"S&P Global's October election reporting")} identified 34 data-centre-related ballot measures across eight states, including 20 in Ohio. Power bills, water use, grid costs and local construction approval are political issues even where national candidates focus on something else.</p>
   <p>That creates different winners and losers. Slower approvals could help existing cloud capacity retain pricing power, but delay orders for electrical equipment, power developers, contractors and grid suppliers. A bullish S&amp;P reaction to the election could coexist with a weaker outlook for a particular AI construction project.</p>
  </section>

  <section style={segment}>
   <h2>Two plausible paths after 3 November</h2>
   <p><strong>Relief and recovery:</strong> the result creates little policy surprise; energy risk eases; Treasury yields and credit spreads stabilise; semiconductors reclaim their daily 200-day levels, and gains broaden beyond mega-cap technology. Strong seasonality would then have support from actual conditions, rather than being the only argument.</p>
   <p><strong>The historical pattern fails:</strong> disruption raises oil and inflation expectations, borrowing spreads widen, chipmakers repeatedly fail to recover their longer-term trends, and reported AI spending continues to outpace achievable cash returns. Even a correctly measured nineteen-for-nineteen streak does not stop a market from repricing new information.</p>
   <p>To distinguish these paths, watch <strong>SPY and QQQ against their dated support/reclaim areas, semiconductors against daily 200DMA, the equal-weight S&amp;P versus cap-weight, broad high-yield spreads, US two- and ten-year yields, DXY, Brent and refined-product cracks</strong>. The combination matters more than any one indicator.</p>
   <p>Then come the next tests: the <strong>3 November midterm vote and JOLTS</strong>, the <strong>6 November US employment report at 08:30 ET</strong>, and the <strong>10 November CPI release at 08:30 ET</strong> ({cite(SOURCES[8].href,"BLS release calendar")}). The results are not known in this frozen edition. Every future surprise needs to be matched to what investors expected beforehand.</p>
   <p><strong>Working assessment:</strong> the seasonal bullish case is unusually well documented, but a durable rebound and a broader crash both remain unconfirmed. In 2026, the most useful investment question may be less whether stocks <em>normally</em> rally after midterms than whether earnings quality, financing and market participation are improving enough to sustain one.</p>
   <p><Link href={crashWatch}>Explore the standing Crash vs Opportunity evidence watch →</Link></p>
  </section>

  <section style={segment}>
   <h2>Research sources and attribution</h2>
   <p style={muted}>The two video transcripts were reviewed with timestamped captions. Statements about prices, company events and positioning in those videos are attributed to the creators unless linked to a primary source. This is a source-dated editorial research story, not a canonical market-regime verdict, a live price feed or investment advice.</p>
   <ul>{SOURCES.map(s=><li key={s.href}>{cite(s.href,s.name)}</li>)}</ul>
   <p style={muted}>Edition frozen: 2 Nov 2026, prior to the US midterm election; historical statistics retain source-specific windows. For a larger asset-by-asset claim ledger and uncertainty register see the <Link href={weekAhead+"#midterm-asset-views"}>Bluebelly Newsroom cross-asset investigation</Link>.</p>
  </section>
 </article>;
}
