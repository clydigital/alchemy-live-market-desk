import Link from "next/link";
import type { InvestorTestView } from "@/lib/blue-desk-investor-test";
import { INVESTOR_TEST_STAGES } from "@/lib/blue-desk-investor-test";
import DualTimestamp from "./DualTimestamp";
import styles from "./InvestorTest.module.css";

type Props={view:InvestorTestView};

/**
 * Editorial UI only: the four questions are analytical prompts, never claims
 * of actual cash flows, issuer financing terms, investor actions or prices.
 */
export default function InvestorTest({view}:Props){
  const {story}=view;
  return (
    <section className={styles.feature} id="investor-test"
      aria-labelledby="investor-test-title" data-investor-test="source-bounded">
      <div className={styles.masthead}>
        <div>
          <p className={styles.eyebrow}>THE INVESTOR TEST <span>·</span> A DEEPER LOOK</p>
          <h2 id="investor-test-title">A promising story. But who gets the return?</h2>
          <p className={styles.deck}>The opportunity is only half the decision.
            Follow the money, confront the downside, and ask what evidence would change the view.</p>
        </div>
        <div className={styles.storyIdentity}>
          <span>IN FOCUS · RECORDED THESIS</span>
          <strong>{story.title}</strong>
          <small>Researched <DualTimestamp value={story.updatedAt}/></small>
        </div>
      </div>

      <div className={styles.questions}>
        <article className={styles.pitch}>
          <p className={styles.step}>01 / {INVESTOR_TEST_STAGES[0].label}</p>
          <h3>{INVESTOR_TEST_STAGES[0].question}</h3>
          <p className={styles.sourceText}>{story.thesis}</p>
          <div className={styles.recorded}>
            <span>WHAT THE RECORDED THESIS CITES</span>
            <p>{story.support}</p>
            <small>This is stored research support, not an independently verified live market print.</small>
          </div>
        </article>
        <article className={styles.money}>
          <p className={styles.step}>02 / {INVESTOR_TEST_STAGES[1].label}</p>
          <h3>{INVESTOR_TEST_STAGES[1].question}</h3>
          <p className={styles.question}>{view.fundingQuestion}</p>
          <div className={styles.answerBoundary}>
            <strong>What is the market paying for?</strong>
            {story.pricedAssessment ? (
              <p>{story.pricedAssessment}</p>
            ) : (
              <p>No source-grounded pricing assessment is recorded for this thesis.
                A valuation or return cannot be inferred from its headline.</p>
            )}
            <small>Recorded assessment only · not a new price observation</small>
          </div>
        </article>
        <article className={styles.catch}>
          <p className={styles.step}>03 / {INVESTOR_TEST_STAGES[2].label}</p>
          <h3>{INVESTOR_TEST_STAGES[2].question}</h3>
          <p>{story.contradiction || story.invalidation}</p>
          {story.invalidation ? <details className={styles.extra}>
            <summary>What would invalidate the thesis?</summary>
            <p>{story.invalidation}</p>
          </details>:null}
        </article>
        <article className={styles.verdict}>
          <p className={styles.step}>04 / {INVESTOR_TEST_STAGES[3].label}</p>
          <h3>{INVESTOR_TEST_STAGES[3].question}</h3>
          <p>{story.nextTest || story.confirmation}</p>
          <p className={styles.question}>{view.marketQuestion}</p>
        </article>
      </div>
      <div className={styles.foot}>
        <p>{view.evidenceNote} The questions here are analysis prompts, not verified
          financing terms or a buy/sell recommendation.</p>
        <Link href={"#thesis-"+story.slug}>Read the full Story and its tests <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}
