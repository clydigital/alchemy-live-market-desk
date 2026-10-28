import styles from "./RbnzDecisionFeature.module.css";

/**
 * Source-dated editorial feature, deliberately separate from the canonical
 * verified-News and Story/Dossier feeds. Never presented as a live price feed.
 * Figures: RBNZ 28 Oct 2026 statement, Reuters same-day reporting, ABS CPI.
 */
export default function RbnzDecisionFeature() {
  return (
    <article id="rbnz-october-2026" className={styles.feature} data-source-grounded-editorial="2026-10-28" aria-labelledby="rbnz-title">
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <p className={styles.eyebrow}>28 OCTOBER 2026 <span aria-hidden="true">/</span> NZD/USD <span aria-hidden="true">/</span> CENTRAL BANKS</p>
          <p className={styles.edition}>THE LEAD STORY <span>·</span> Dated editorial analysis</p>
          <h2 id="rbnz-title">New Zealand held rates. The kiwi paid the price.</h2>
          <p className={styles.deck}>Traders went into the decision expecting a hike. The RBNZ voted to wait instead, sending NZD/USD sharply lower. But the narrow vote and the inflation forecast make this more complicated than a simple dovish pause.</p>
          <div className={styles.heroActions}>
            <a className={styles.primaryLink} href="#rbnz-analysis">Read the full story <span aria-hidden="true">↓</span></a>
            <a className={styles.secondaryLink} href="https://www.rbnz.govt.nz/news-and-events/news/2026/10/ocr-held-at-2-75-percent" target="_blank" rel="noopener noreferrer">RBNZ original decision ↗</a>
          </div>
          <p className={styles.heroTime}>Decision: 28 Oct, 2:00 pm NZDT · 9:00 am MYT · 27 Oct, 9:00 pm EDT</p>
        </div>
        <aside className={styles.heroAside} aria-label="The surprise, in four numbers">
          <p className={styles.asideTitle}>THE SURPRISE AT A GLANCE</p>
          <div className={styles.ratePair}>
            <div><span>EXPECTED OCR</span><strong>3.00%</strong><small>25bp increase</small></div>
            <span className={styles.vs}>vs</span>
            <div><span>ACTUAL OCR</span><strong>2.75%</strong><small>No change</small></div>
          </div>
          <div className={styles.asideRows}>
            <div><span>COMMITTEE</span><strong>4–3 to hold</strong></div>
            <div><span>NZD/USD SESSION LOW</span><strong>0.55831</strong></div>
            <div><span>REPORTED MAX DROP</span><strong>−1.7%</strong></div>
          </div>
          <small className={styles.dataCaution}>Reuters-reported 28 Oct Asian-session low and maximum decline, not a live quote or a measured five-minute event window.</small>
        </aside>
      </header>

      <nav className={styles.storyNav} aria-label="Inside the RBNZ story">
        <a href="#rbnz-analysis">What happened</a>
        <a href="#rbnz-why">Why they paused</a>
        <a href="#rbnz-market">Market transmission</a>
        <a href="#rbnz-next">What changes the outlook</a>
        <a href="#rbnz-sources">Original sources</a>
      </nav>

      <div className={styles.bodyGrid} id="rbnz-analysis">
        <div className={styles.storyColumn}>
          <div className={styles.sectionLabel}>01 / THE DECISION AND THE REACTION</div>
          <h3>Markets had prepared for 3%. The committee chose 2.75%.</h3>
          <p>Before the announcement, 22 of 27 economists surveyed by Reuters expected the Reserve Bank of New Zealand to raise the Official Cash Rate by 25 basis points. After two recent increases, another hike seemed a reasonable way to tackle inflation above the central bank's target.</p>
          <p>Then the decision landed. Four of the seven policymakers voted to leave rates unchanged. Three wanted a further 25-basis-point increase. It was a pause by the narrowest possible majority, not a committee united behind easier policy.</p>
          <div className={styles.sequence} aria-label="Verified event sequence">
            <div className={styles.beat}><span className={styles.beatIndex}>01</span><div><strong>Before the release</strong><p>A Reuters survey put 22 of 27 economists on the side of a hike to 3.00%.</p></div></div>
            <div className={styles.beat}><span className={styles.beatIndex}>02</span><div><strong>9:00 am MYT · policy released</strong><p>The RBNZ held at 2.75%, with a 4–3 split. The official statement still described further tightening as likely, subject to incoming data.</p></div></div>
            <div className={styles.beat}><span className={styles.beatIndex}>03</span><div><strong>Subsequent Asian trading</strong><p>Reuters reported NZD/USD down as much as 1.7%, reaching 0.55831, before a partial recovery as Governor Anna Breman discussed the possibility of more hikes.</p></div></div>
          </div>

          <section id="rbnz-why" className={styles.articleSection}>
            <div className={styles.sectionLabel}>02 / INSIDE THE BANK</div>
            <h3>Why would a central bank wait with inflation above target?</h3>
            <p>New Zealand's annual CPI inflation slowed from 4.1% in June to 3.7% in September, but that is still above the RBNZ's 1–3% target band. Worse, the bank expects it to reach 4.4% in the December quarter, largely because of energy prices. On the surface, that sounds like a straightforward case for higher rates.</p>
            <p>But the RBNZ is distinguishing imported cost shocks from inflation generated inside the domestic economy. Fuel, freight and the weaker currency make goods more expensive. Raising interest rates cannot produce more oil or repair a disrupted shipping route. It can, however, slow household and business spending to stop higher costs spreading more widely into wages and prices.</p>
            <p>So the question was whether New Zealand needed another hike immediately, or whether previous tightening and weak domestic demand were already doing enough. Wage growth remains subdued and medium-term inflation expectations have stayed relatively stable. The committee noted that 56% of the weighted CPI basket had price increases above 3%—a reason not to become complacent.</p>
            <div className={styles.splitArgument}>
              <div>
                <span className={styles.argumentTag}>FOUR VOTED TO WAIT</span>
                <h4>Give earlier hikes time</h4>
                <p>The hold camp saw weaker-than-feared fuel pass-through, sluggish consumer demand and global risks that could abruptly damage growth. Another six weeks of data might change the answer.</p>
              </div>
              <div>
                <span className={styles.argumentTag}>THREE VOTED TO HIKE</span>
                <h4>Act before inflation sticks</h4>
                <p>The hike camp worried that broad core price pressures and higher shipping costs could become embedded in future wages and prices. Waiting could mean even higher rates later.</p>
              </div>
            </div>
            <p className={styles.microNote}>Source: the RBNZ's published October Monetary Policy Review and meeting record. This division concerns timing and risks, not a vote to abandon the inflation target.</p>
          </section>

          <section id="rbnz-market" className={styles.articleSection}>
            <div className={styles.sectionLabel}>03 / HOW IT REACHES THE MARKET</div>
            <h3>Why a rate hold can punish the currency</h3>
            <p>Foreign-exchange markets respond to the difference between what investors expected and what actually happened. A higher New Zealand policy rate could have made NZD assets relatively more attractive. Investors expecting that extra return were caught off guard when it did not arrive.</p>
            <div className={styles.mechanism} aria-label="Market repricing mechanism">
              <div><small>EXPECTATION</small><strong>Hike to 3.00%</strong><span>Higher relative NZ rate priced in</span></div>
              <div><small>NEW INFORMATION</small><strong>Hold at 2.75%</strong><span>Immediate rate support disappoints</span></div>
              <div><small>REPORTED REACTION</small><strong>NZD/USD falls</strong><span>As much as 1.7% in Reuters' session report</span></div>
            </div>
            <p>That explains the initial selling pressure, but not every tick in the pair. The US dollar's own rate outlook, broader risk sentiment and changing bond yields also affect NZD/USD. A reported session low is not a tick-matched causal study.</p>
            <h4>The Australian comparison makes it more interesting</h4>
            <p>Australia released hotter September inflation on the same day: headline CPI reached 4.3% year-on-year, up from 4.0% in August. That can preserve expectations of further Reserve Bank of Australia tightening, widening the perceived policy gap with New Zealand. Reuters reported a sharp rise in AUD against NZD. The magnitude of that move should not be treated as a standalone measurement of the RBNZ effect.</p>
            <div className={styles.learning}>
              <strong>Learning moment · Why do currency traders care about two central banks?</strong>
              <p>NZD/USD depends partly on New Zealand rates relative to US rates; AUD/NZD compares the Australian and New Zealand paths. One bank pausing while another remains under inflation pressure can change the relative attractiveness of the currencies. To confirm that story, check short-term yield differentials alongside FX—not just the headlines.</p>
            </div>
          </section>

          <section id="rbnz-next" className={styles.articleSection}>
            <div className={styles.sectionLabel}>04 / THE FORK IN THE ROAD</div>
            <h3>A surprise pause is not the same as a new easing cycle</h3>
            <p>Every policymaker agreed that further tightening would probably be needed if the inflation outlook warranted it. The RBNZ's next decision is scheduled for <strong>9 December 2026</strong>. That meeting comes with a fuller Monetary Policy Statement, giving the bank another chance to test whether imported cost increases are becoming persistent domestic inflation.</p>
            <div className={styles.scenarios}>
              <div><span>THE NZD RECOVERY CASE</span><h4>December hikes become credible</h4><p>Sticky core prices or wages, resilient domestic demand, and higher short-dated NZ yields could restore some of the support lost in the surprise. Look for NZD/USD to recover beyond the first reaction, with NZ rate expectations confirming.</p></div>
              <div><span>THE WEAKER NZD CASE</span><h4>Pause lasts longer than expected</h4><p>Weak consumer spending, softer wage pressure or a deterioration in global growth could keep the RBNZ sidelined. A persistently wider US–NZ or AU–NZ rate differential would reinforce the downside case.</p></div>
            </div>
            <h4>Three checks before calling the next move</h4>
            <ol className={styles.checklist}>
              <li><strong>New Zealand two-year yields and OIS:</strong> did December hike pricing recover after the initial shock?</li>
              <li><strong>NZD/USD and AUD/NZD:</strong> does the initial FX move persist, or fade as the relative-rate story changes?</li>
              <li><strong>Core inflation, wages and demand:</strong> do domestic pressures justify another hike, or does weakness give the bank time?</li>
            </ol>
            <p>The RBNZ also flagged growing financial-stability risks from opaque financing around some global AI investment. That is a noteworthy cross-market warning, <strong>not</strong> evidence of observed AI-credit losses or a reason to change Bluebelly's canonical AI thesis automatically.</p>
          </section>
        </div>

        <aside className={styles.rail} aria-label="Decision context and reading notes">
          <div className={styles.railCard}>
            <p className={styles.railEyebrow}>THE ECONOMIC TRADE-OFF</p>
            <h4>Inflation is falling now, but may rise again</h4>
            <div className={styles.compareItem}><span>June annual CPI</span><strong>4.1%</strong></div>
            <div className={styles.compareItem}><span>September annual CPI</span><strong>3.7%</strong></div>
            <div className={styles.compareItem}><span>RBNZ December forecast</span><strong>4.4%</strong></div>
            <p>Fuel prices and exchange-rate weakness drive much of the near-term forecast; domestic wage and demand evidence determines whether that pressure persists.</p>
          </div>
          <div className={styles.railCard}>
            <p className={styles.railEyebrow}>WHY THE PAUSE WON</p>
            <ul>
              <li>Two earlier rate increases are still working through the economy</li>
              <li>Household consumption remains weak</li>
              <li>Wage growth and expectations have been contained</li>
              <li>Global energy and financing risks could damage growth</li>
            </ul>
          </div>
          <div className={styles.railCard}>
            <p className={styles.railEyebrow}>INSTRUMENTS TO MONITOR</p>
            <ul>
              <li><strong>NZD/USD</strong> — NZ versus US rate paths</li>
              <li><strong>AUD/NZD</strong> — RBA versus RBNZ divergence</li>
              <li><strong>NZ 2Y / swaps</strong> — market-implied policy path</li>
            </ul>
            <p>These are analytical watchpoints, not asserted live signals.</p>
          </div>
        </aside>
      </div>

      <footer className={styles.sources} id="rbnz-sources">
        <div><p className={styles.sectionLabel}>05 / VERIFY THE STORY</p><h3>Primary sources and reaction record</h3><p>Facts are anchored to the central bank and official statistics. The currency low is a Reuters-reported session observation, not an RBNZ statistic.</p></div>
        <ol>
          <li><a href="https://www.rbnz.govt.nz/news-and-events/news/2026/10/ocr-held-at-2-75-percent" target="_blank" rel="noopener noreferrer">RBNZ · OCR decision and full committee discussion ↗</a><span>28 Oct 2026 · rate, vote, inflation outlook, competing arguments</span></li>
          <li><a href="https://www.reuters.com/business/dollar-holds-gains-ahead-fed-policy-signal-rbnz-decision-2026-10-28/" target="_blank" rel="noopener noreferrer">Reuters · NZD/USD reaction and pre-release economist survey ↗</a><span>28 Oct 2026 · reported Asian-session move, not live pricing</span></li>
          <li><a href="https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/sep-2026" target="_blank" rel="noopener noreferrer">ABS · September Australian CPI ↗</a><span>28 Oct 2026 · 4.3% headline year-on-year</span></li>
          <li><a href="https://www.rbnz.govt.nz/monetary-policy/about-monetary-policy/the-official-cash-rate" target="_blank" rel="noopener noreferrer">RBNZ · next policy decision ↗</a><span>9 Dec 2026 at 2:00 pm NZDT</span></li>
        </ol>
      </footer>
    </article>
  );
}
