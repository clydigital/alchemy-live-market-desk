import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import StoryIdentityBalls from "@/components/blue-desk/StoryIdentityBalls";
import { getRecentPublishedStoryReadings } from "@/lib/blue-desk/story-archive-server";
import { exactPublishedStoryId, readingsForStory } from "@/lib/blue-desk/story-archive";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { getHybridExactDailyBriefEdition } from "@/lib/hybrid-publication";
import { loadEditorialMarketBrief } from "@/lib/market-brief-editorial-data";
import { formatBlueDeskSourceObservation } from "@/lib/blue-desk-source-copy";
import { describePublicEvidenceClaim } from "@/lib/blue-desk-evidence-preview";
import { blueDeskStorySections } from "@/lib/blue-desk-story-sections";
import { readerParagraphSources, readerVerifiedReaction } from "@/lib/blue-desk-reader-evidence";
import {
  projectMarketBriefArticles,
  readerFacingMarketText,
  type MarketBriefParagraphV1,
} from "@/lib/market-brief-articles";
import styles from "../../blue-desk.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Story | Blue Desk" };

type Params = { articleId: string };
type Search = { edition?: string | string[] };

function httpsSource(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

const SECTIONS: ReadonlyArray<{
  name: string;
  roles: ReadonlyArray<MarketBriefParagraphV1["role"]>;
}> = [
  { name: "What happened", roles: ["opening"] },
  { name: "How it works", roles: ["mechanism"] },
  { name: "Market impact", roles: ["reaction"] },
  { name: "Countercase", roles: ["contradiction"] },
  { name: "Background", roles: ["context"] },
];

export default async function BlueDeskStoryPage({
  params, searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { articleId } = await params;
  const { edition } = await searchParams;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof edition !== "string" || !uuidPattern.test(edition)) notFound();

  // Next.js may pass a URL-encoded segment after a hostname rewrite. Decode
  // once, validate the exact edition + Story pair, and fail closed otherwise.
  let normalizedArticleId: string;
  try {
    normalizedArticleId = decodeURIComponent(articleId);
  } catch {
    notFound();
  }
  const articlePrefix = `article:${edition}:`;
  if (!normalizedArticleId.startsWith(articlePrefix)) notFound();
  if (!uuidPattern.test(normalizedArticleId.slice(articlePrefix.length))) notFound();

  const frozen = await getHybridExactDailyBriefEdition(edition);
  if (!frozen) notFound();
  const projected = await loadEditorialMarketBrief(projectMarketBriefArticles(frozen));
  const article = projected.articles.find(item =>
    item.articleId === normalizedArticleId && item.editionId === edition
  );
  if (!article) notFound();
  const storyId=exactPublishedStoryId(article);
  // Older published editions are a read-only archive, not a new Story decision.
  const earlier=storyId
    ? readingsForStory(await getRecentPublishedStoryReadings().catch(()=>[]),storyId,edition).slice(0,10)
    : [];

  const host = (await headers()).get("host");
  const back = blueDeskPublicHref("/blue-desk", host);
  const references = article.sourceLinks.filter(source => httpsSource(source.url));
  const confirmations = article.confirmationTests || [];
  const invalidations = article.invalidationTests || [];
  const hasStructuredWatch = confirmations.length > 0 || invalidations.length > 0;
  const verifiedReaction = readerVerifiedReaction(article.paragraphs, article.editorial.evidenceClaims);
  const supportedParagraphs = article.paragraphs.filter(p =>
    readerFacingMarketText(p.text).length > 0
    && (p.canonicalEvidenceIds.length > 0 || p.sourceRefs.length > 0)
    // The same forward tests are already displayed once in their own section.
    && !(hasStructuredWatch && p.role === "outlook")
    // No edition-pinned market observation means no factual price-reaction claim.
    && (p.role !== "reaction" || readerParagraphSources(p, article.editorial.evidenceClaims).length > 0)
  );
  const covered = new Set<string>();
  const blocks = SECTIONS.map(section => ({
    name: section.name,
    text: supportedParagraphs.filter(p => section.roles.includes(p.role)),
  })).filter(block => {
    if (block.text.length === 0) return false;
    block.text.forEach(p => covered.add(p.text));
    return true;
  });
  const unmatched = supportedParagraphs.filter(p => !covered.has(p.text));
  if (unmatched.length) blocks.push({ name: "Additional context", text: unmatched });
  const navigation = blueDeskStorySections({
    originalObservations: article.editorial.evidenceClaims.length,
    causalLinks: article.editorial.causalLinks.length,
    narrativeBlocks: blocks.length,
    missingVerifiedReaction: !verifiedReaction,
    watchAvailable: hasStructuredWatch || Boolean(article.conditionalOutlook),
  });

  return (
    <main className={styles.page}>
      <BlueDeskHeader activePath="/blue-desk" />
      <div className={styles.content}>
        <Link href={back} className={styles.textLink}>← Live Market</Link>
        <header className={styles.deepHero}>
          <p className={styles.kicker}>{article.category} · {article.interpretationStatus}</p>
          <h1>{article.title}</h1>
          <p className={styles.heroDeck}>{article.deck}</p>
          <StoryIdentityBalls title={article.title} deck={article.deck}
            assets={article.subjectAssets} limit={5} />
          <p className={styles.muted}>Market View · Latest available source-backed interpretation for this exact edition.
            Historic reports remain unchanged; a later publication date does not prove a new catalyst.</p>
          <div className={styles.deepMeta}>
            <DualTimestamp value={article.generatedAt} />
            <span>Edition {article.editionId}</span>
          </div>
        </header>
        <nav className={styles.storyJumpNav} aria-label="Navigate this Story">
          {navigation.map(section => (
            <a key={section.id} href={`#${section.id}`} className={styles.storyJumpLink}>
              {section.label}
            </a>
          ))}
        </nav>
        <div className={styles.deepLayout}>
          <article className={styles.deepArticle}>
            <section id="story-overview" className={styles.storyAtGlance} aria-labelledby="story-overview-title">
              <p className={styles.kicker}>EDITION-PINNED BRIEF</p>
              <h2 id="story-overview-title">At a glance</h2>
              <div className={styles.storyMetricGrid}>
                <div>
                  <span>Interpretation</span>
                  <strong>{article.interpretationStatus}</strong>
                </div>
                <div>
                  <span>Original-source observations</span>
                  <strong>{article.editorial.evidenceClaims.length}</strong>
                </div>
                <div>
                  <span>Evidence-linked mechanism steps</span>
                  <strong>{article.editorial.causalLinks.length}</strong>
                </div>
                <div>
                  <span>Observed market reaction</span>
                  <strong>{verifiedReaction ? "Source-linked" : "Not verified"}</strong>
                </div>
              </div>
              <p className={styles.storySummaryNote}>
                This view is fixed to the publication shown above. Source observations
                do not, on their own, prove a causal explanation or a new Story verdict.
              </p>
            </section>
            {!article.editorial.evidenceClaims.length ? (
              <section className={styles.deepSection}>
                <h2>Evidence status</h2>
                <p className={styles.deepSourceContext}>
                  No original-source observation has passed the evidence and publication-time checks for this edition.
                  The interpretation below is provisional, not a verified account of a market move.
                </p>
              </section>
            ) : null}
            {article.editorial.evidenceClaims.length ? (
              <section id="story-observations" className={styles.deepSection}>
                <h2>What the original sources report</h2>
                <p className={styles.deepSourceContext}>These are individual source-linked observations, not proof of the full market interpretation.</p>
                <ul className={styles.structuredEvidenceList}>
                  {article.editorial.evidenceClaims.map(claim => {
                    const evidence = describePublicEvidenceClaim(claim.claimText);
                    return (
                      <li key={claim.evidenceId} id={"evidence-" + claim.evidenceId} className={styles.structuredEvidenceCard}>
                        <div className={styles.structuredEvidenceHeading}>
                          <h3>{evidence.title}</h3>
                          <span>{evidence.kind === "SEC_XBRL" ? "SEC FILING · SOURCE FACTS" : "ORIGINAL REPORT"}</span>
                        </div>
                        <p className={styles.structuredEvidenceSummary}>{evidence.kind === "SEC_XBRL"
                          ? evidence.summary : formatBlueDeskSourceObservation(evidence.summary)}</p>
                        {evidence.facts.length ? (
                          <div className={styles.filingMetricList}>
                            {evidence.facts.map((metric, index) => (
                              <div key={metric.concept + ":" + metric.period + ":" + index} className={styles.filingMetric}>
                                <div>
                                  <strong>{metric.label}</strong>
                                  <small>{metric.period}</small>
                                </div>
                                <div>
                                  <strong>{metric.valueLabel}</strong>
                                  <small>{metric.form} · filed {metric.filed}</small>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {evidence.needsReview ? <p className={styles.filingPeriodWarning}>
                          Filing periods differ or some fields need review. Do not add these figures or infer missing values.
                        </p> : null}
                        <div className={styles.evidenceCardFooter}>
                          <a href={claim.sourceUrl} target="_blank" rel="noreferrer">{claim.sourceName} · original report ↗</a>
                          <details className={styles.rawEvidenceDetails}>
                            <summary>Inspect full original observation and audit identifiers</summary>
                            <dl>
                              <dt>Evidence ID</dt><dd>{claim.evidenceId}</dd>
                              <dt>Evidence class</dt><dd>{claim.evidenceClass}</dd>
                              <dt>Available at</dt><dd>{claim.availableAt || "Unavailable"}</dd>
                            </dl>
                            <pre>{claim.claimText}</pre>
                          </details>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
            {article.editorial.causalLinks.length ? (
              <section id="story-mechanisms" className={styles.deepSection}>
                <h2>How the mechanism connects</h2>
                <p className={styles.deepSourceContext}>These are the Dossier's existing evidence-linked causal steps. An original source may support an observation without proving the proposed causal direction.</p>
                <ol className={styles.deepMechanismList}>
                  {article.editorial.causalLinks.map((edge, index) => (
                    <li key={index} className={styles.deepMechanismStep}>
                      <div className={styles.deepMechanismNodes}>
                        <span>{edge.from}</span>
                        <span className={styles.deepMechanismRelation}>{edge.relationship} →</span>
                        <span>{edge.to}</span>
                      </div>
                      <div className={styles.deepMechanismEvidence}>
                        <span>Evidence state: {edge.evidenceStatus.replace(/_/g, " ")}</span>
                        <a href={edge.sourceUrl} target="_blank" rel="noreferrer">{edge.sourceName} · original source ↗</a>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
            {blocks.length ? <div id="story-analysis" className={styles.storyAnalysis}>
              <header className={styles.storyPresenterAction}>
                <div>
                  <p className={styles.kicker}>MARKET VIEW · WHAT ACTUALLY CHANGED?</p>
                  <h2>From catalyst to price and the countercase</h2>
                  <p>Start with the observed event and its date. Ask what the market should ordinarily
                    have done, then check whether the sourced reaction supports that explanation.
                    Unverified price changes are not conclusions.</p>
                </div>
                <Link className={styles.textLink} href={blueDeskPublicHref("/blue-desk/markets",host)}>
                  Compare source-dated markets →</Link>
              </header>
              {blocks.map(block => (
              <section key={block.name} className={styles.deepSection}>
                <h2>{article.interpretationStatus === "UNRESOLVED" && block.name === "How it works"
                  ? "Working explanation" : article.interpretationStatus === "UNRESOLVED" && block.name === "What happened"
                  ? "Current assessment" : block.name}</h2>
                {block.text.map((paragraph, index) => (
                  <div key={index}>
                    <p>{readerFacingMarketText(paragraph.text)}</p>
                    {readerParagraphSources(paragraph, article.editorial.evidenceClaims).length ? (
                      <div className={styles.deepParagraphSources}>
                        <small className={styles.deepEvidence}>Original-source records linked to this exact upstream claim:</small>
                        {readerParagraphSources(paragraph, article.editorial.evidenceClaims).map(source => (
                          <a key={source.evidenceId} href={source.sourceUrl} target="_blank" rel="noreferrer">
                            {source.sourceName} · original report ↗
                          </a>
                        ))}
                      </div>
                    ) : (
                      <small className={styles.deepEvidence}>
                        Lesson-level evidence only; this particular statement is not independently verified by an original-source record.
                      </small>
                    )}
                  </div>
                ))}
              </section>
              ))}
            </div> : null}
            {!verifiedReaction ? (
              <section id="story-reaction-gap" className={styles.deepSection}>
                <h2>Market reaction</h2>
                <p className={styles.deepSourceContext}>
                  No independently source-linked price, yield or futures reaction is available in this frozen edition.
                  The available observations do not establish how traded markets responded at the time.
                </p>
              </section>
            ) : null}
            {hasStructuredWatch ? (
              <section id="story-watch" className={styles.deepSection}>
                <h2>What to watch</h2>
                {confirmations.length ? (
                  <div className={styles.deepWatchGroup}>
                    <h3>What strengthens this view</h3>
                    <ul className={styles.deepWatchList}>
                      {confirmations.map((condition, index) => <li key={index}>{condition}</li>)}
                    </ul>
                  </div>
                ) : null}
                {invalidations.length ? (
                  <div className={styles.deepWatchGroup}>
                    <h3>What would weaken it</h3>
                    <ul className={styles.deepWatchList}>
                      {invalidations.map((condition, index) => <li key={index}>{condition}</li>)}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : article.conditionalOutlook ? (
              <section id="story-watch" className={styles.deepSection}>
                <h2>What to watch</h2>
                <p>{article.conditionalOutlook}</p>
              </section>
            ) : null}
            {!blocks.length && !article.conditionalOutlook ? (
              <p className={styles.empty}>No source-supported narrative is available for this Story.</p>
            ) : null}
          </article>
          <aside className={styles.deepAside}>
            <section className={styles.storyHistorySidebar} aria-label="Earlier published Story reports">
              <h2>Earlier reports · same Story</h2>
              {earlier.length?<ol>{earlier.map(item=><li key={item.editionId}>
                <Link href={blueDeskPublicHref("/blue-desk/stories/"+
                  encodeURIComponent(item.article.articleId)+"?edition="+encodeURIComponent(item.editionId),host)}>
                  {item.article.title}
                </Link>
                <small>Published {new Date(item.publishedAt).toLocaleString("en-GB",{timeZone:"UTC",
                  day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})} UTC</small>
              </li>)}</ol>:<p>No earlier source-admitted report found in the bounded recent archive.
                This does not mean there were no earlier market events.</p>}
            </section>
            <section>
              <h2>Sources</h2>
              {references.length ? references.map((source, i) => (
                <a key={source.url + i} href={source.url} target="_blank" rel="noreferrer" className={styles.sourceLink}>
                  {source.title} ↗
                </a>
              )) : <p className={styles.muted}>Source links unavailable. See attached evidence references.</p>}
            </section>
            <section id="story-evidence" className={styles.storyEvidencePanel}>
              <h2>Evidence explorer</h2>
              {article.editorial.evidenceClaims.length ? (
                <>
                  <p className={styles.evidenceIndexNote}>Jump to each source's compact facts and optional full audit record. Raw filing text is not repeated here.</p>
                  <ol className={styles.evidenceIndexList}>
                    {article.editorial.evidenceClaims.map(claim => (
                      <li key={claim.evidenceId}>
                        <a href={"#evidence-" + claim.evidenceId}>
                          {describePublicEvidenceClaim(claim.claimText).title} ↗
                        </a>
                        <small>{claim.sourceName} · {claim.evidenceClass}</small>
                      </li>
                    ))}
                  </ol>
                </>
              ) : <p className={styles.muted}>
                No edition-pinned primary-source claims are available for this article.
                Interpretations above are not independently verified by this panel.
              </p>}
              <p className={styles.muted}>These sources support individual observations; they do not independently establish the causal explanation or a System 2 thesis change.</p>
            </section>
            <section>
              <h2>Publication</h2>
              <p>Interpretation: <strong>{article.interpretationStatus}</strong></p>
              <p>Edition: {article.editionId}</p>
              {article.dossierId ? <p>Dossier: {article.dossierId}</p> : null}
            </section>
            <Link href={blueDeskPublicHref("/blue-desk/calendar", host)} className={styles.textLink}>
              Upcoming catalysts →
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
