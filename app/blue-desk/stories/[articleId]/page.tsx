import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import StoryVisual from "@/components/blue-desk/StoryVisual";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import StoryIdentityBalls from "@/components/blue-desk/StoryIdentityBalls";
import { getRecentPublishedStoryReadings } from "@/lib/blue-desk/story-archive-server";
import { exactPublishedStoryId, readingsForStory } from "@/lib/blue-desk/story-archive";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { getHybridExactDailyBriefEdition } from "@/lib/hybrid-publication";
import { loadEditorialMarketBrief } from "@/lib/market-brief-editorial-data";
import { formatBlueDeskSourceObservation } from "@/lib/blue-desk-source-copy";
import { blueDeskStorySections } from "@/lib/blue-desk-story-sections";
import { readerParagraphSources, readerVerifiedReaction } from "@/lib/blue-desk-reader-evidence";
import {
  projectMarketBriefArticles,
  readerFacingMarketText,
  type MarketBriefParagraphV1,
} from "@/lib/market-brief-articles";
import styles from "../../blue-desk.module.css";
import reader from "./editorial-read.module.css";

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

  const host = (await headers()).get("host");
  const back = blueDeskPublicHref("/blue-desk", host);
  const canonicalStoryId=exactPublishedStoryId(article);
  const recentArchive=await getRecentPublishedStoryReadings().catch(()=>[]);
  const previousReadings=canonicalStoryId?readingsForStory([
    ...recentArchive,
    {article,storyId:canonicalStoryId,editionId:article.editionId,publishedAt:frozen.published_at},
  ],canonicalStoryId,article.editionId).slice(0,10):[];
  const earlierStoryHref=(prior:(typeof previousReadings)[number])=>blueDeskPublicHref(
    "/blue-desk/stories/"+encodeURIComponent(prior.article.articleId)+"?edition="+encodeURIComponent(prior.editionId),host);

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
          <StoryIdentityBalls title={article.title} deck={article.deck} assets={article.subjectAssets} hrefBase={blueDeskPublicHref("/blue-desk",host)}/>
          <div className={styles.deepMeta}>
            <DualTimestamp value={article.generatedAt} />
            <span>Immutable historical edition</span>
          </div>
        </header>
        {canonicalStoryId?<div className={styles.storyPresenterAction}>
          <Link className={styles.primaryAction} href={blueDeskPublicHref(
            "/blue-desk/presenter?edition="+encodeURIComponent(article.editionId)
            +"&story="+encodeURIComponent(canonicalStoryId),host)}>
            Research this Story in Presenter · COTD / OB →</Link>
          <p>Owner authentication required. This does not approve an article or change the canonical thesis.</p>
        </div>:null}
        <StoryVisual
          storyId={normalizedArticleId.slice(articlePrefix.length)}
          editionId={article.editionId}
          category={article.category}
        />
        <nav className={styles.storyJumpNav} aria-label="Navigate this Story">
          {navigation.map(section => (
            <a key={section.id} href={`#${section.id}`} className={styles.storyJumpLink}>
              {section.label}
            </a>
          ))}
        </nav>
        <div className={styles.deepLayout}>
          <article className={styles.deepArticle}>
            <section id="story-overview" className={reader.readerOpening} aria-labelledby="story-overview-title">
              <p className={styles.kicker}>THE STORY · FROZEN EDITION</p>
              <h2 id="story-overview-title">What this report establishes</h2>
              {article.editorial.evidenceClaims.length ? (
                <p>
                  The original reports below document individual observations in this edition.
                  They do not, on their own, prove the wider market explanation.
                </p>
              ) : (
                <p>
                  No original-source observation has passed the publication-time evidence checks
                  for this edition. The account below remains a provisional assessment.
                </p>
              )}
              <p className={reader.readerVerdict}>
                <strong>Interpretation: {article.interpretationStatus}</strong>
                {article.interpretationStatus === "UNRESOLVED"
                  ? " — The broader explanation has not been independently established."
                  : " — This is the edition’s recorded interpretation, not an independently verified price reaction."}
              </p>
              {!verifiedReaction ? (
                <p className={reader.readerReaction}>
                  Market reaction remains unverified: this frozen edition has no independently
                  source-linked price, yield or futures response.
                </p>
              ) : null}
              {article.editorial.evidenceClaims.length ? (
                <a href="#story-observations" className={reader.openingLink}>
                  Read the original reports ↓
                </a>
              ) : (
                <a href="#story-evidence" className={reader.openingLink}>
                  Review the evidence limitations ↓
                </a>
              )}
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
                <ul className={styles.deepFactList}>
                  {article.editorial.evidenceClaims.slice(0, 8).map(claim => (
                    <li key={claim.evidenceId}>
                      <span title={claim.claimText}>{formatBlueDeskSourceObservation(claim.claimText)}</span>
                      <a href={claim.sourceUrl} target="_blank" rel="noreferrer">{claim.sourceName} · original report ↗</a>
                    </li>
                  ))}
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
            <section className={styles.storyHistorySidebar} aria-label="Previous published reports on this Story">
              <h2>Earlier reports on this Story</h2>
              <p>Only exact canonical Story-ID matches, each with an immutable edition. New catalysts do not rewrite prior evidence.</p>
              {previousReadings.length?<ol>
                {previousReadings.map(prior=><li key={prior.article.articleId}>
                  <Link href={earlierStoryHref(prior)}>{prior.article.title}</Link>
                  <small>{prior.publishedAt.slice(0,10)} · {prior.article.interpretationStatus}</small>
                </li>)}
              </ol>:<p>No earlier report for this Story in the latest 24 editions. Older archive entries may exist.</p>}
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
              {article.editorial.evidenceClaims.length ? article.editorial.evidenceClaims.map(claim => (
                <div key={claim.evidenceId} className={styles.deepSection}>
                  <p>{claim.claimText}</p>
                  <small className={styles.deepEvidence}>
                    {claim.evidenceClass} · {claim.evidenceId}
                  </small>
                  <a className={styles.sourceLink} href={claim.sourceUrl} target="_blank" rel="noreferrer">
                    {claim.sourceName} · original source ↗
                  </a>
                  {claim.availableAt ? <DualTimestamp value={claim.availableAt} className={styles.cardTime} /> : null}
                </div>
              )) : <p className={styles.muted}>
                No edition-pinned primary-source claims are available for this article.
                Interpretations above are not independently verified by this panel.
              </p>}
              <p className={styles.muted}>These sources support individual observations; they do not independently establish the causal explanation or a System 2 thesis change.</p>
              <details className={reader.transparencyDetails}>
                <summary>Evidence checks and publication record</summary>
                <div className={reader.transparencyBody}>
                  <p>Technical verification details for this exact immutable edition. Counts
                    describe admitted records, not evidence that the full interpretation is correct.</p>
                  <dl className={reader.transparencyMetrics}>
                    <div>
                      <dt>Original-source observations</dt>
                      <dd>{article.editorial.evidenceClaims.length}</dd>
                    </div>
                    <div>
                      <dt>Evidence-linked mechanism steps</dt>
                      <dd>{article.editorial.causalLinks.length}</dd>
                    </div>
                    <div>
                      <dt>Verified market reaction</dt>
                      <dd>{verifiedReaction ? "Source-linked" : "Not verified"}</dd>
                    </div>
                    <div>
                      <dt>Interpretation</dt>
                      <dd>{article.interpretationStatus}</dd>
                    </div>
                    <div>
                      <dt>Exact edition ID</dt>
                      <dd>{article.editionId}</dd>
                    </div>
                    <div>
                      <dt>Frozen publication time</dt>
                      <dd><DualTimestamp value={frozen.published_at} /></dd>
                    </div>
                    {article.dossierId ? (
                      <div>
                        <dt>Canonical Dossier ID</dt>
                        <dd>{article.dossierId}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <p>Evidence IDs, source classifications and source-available timestamps are
                    recorded with the individual observations above. Missing evidence does not
                    become verified through lesson-level references.</p>
                </div>
              </details>
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
