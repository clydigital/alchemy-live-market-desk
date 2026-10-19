import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { getHybridExactDailyBriefEdition } from "@/lib/hybrid-publication";
import { loadEditorialMarketBrief } from "@/lib/market-brief-editorial-data";
import {
  projectMarketBriefArticles,
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

  const host = (await headers()).get("host");
  const back = blueDeskPublicHref("/blue-desk", host);
  const references = article.sourceLinks.filter(source => httpsSource(source.url));
  const supportedParagraphs = article.paragraphs.filter(p =>
    p.canonicalEvidenceIds.length > 0 || p.sourceRefs.length > 0
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

  return (
    <main className={styles.page}>
      <BlueDeskHeader activePath="/blue-desk" />
      <div className={styles.content}>
        <Link href={back} className={styles.textLink}>← Live Market</Link>
        <header className={styles.deepHero}>
          <p className={styles.kicker}>{article.category} · {article.interpretationStatus}</p>
          <h1>{article.title}</h1>
          <p className={styles.heroDeck}>{article.deck}</p>
          <div className={styles.deepMeta}>
            <DualTimestamp value={article.generatedAt} />
            <span>Edition {article.editionId}</span>
          </div>
        </header>
        <div className={styles.deepLayout}>
          <article className={styles.deepArticle}>
            {blocks.map(block => (
              <section key={block.name} className={styles.deepSection}>
                <h2>{block.name}</h2>
                {block.text.map((paragraph, index) => (
                  <div key={index}>
                    <p>{paragraph.text}</p>
                    <small className={styles.deepEvidence}>
                      {paragraph.canonicalEvidenceIds.length > 0
                        ? paragraph.canonicalEvidenceIds.length + " canonical evidence reference(s)"
                        : "Source references attached"}
                    </small>
                  </div>
                ))}
              </section>
            ))}
            {article.conditionalOutlook ? (
              <section className={styles.deepSection}>
                <h2>What to watch</h2>
                <p>{article.conditionalOutlook}</p>
              </section>
            ) : null}
            {!blocks.length && !article.conditionalOutlook ? (
              <p className={styles.empty}>No source-supported narrative is available for this Story.</p>
            ) : null}
          </article>
          <aside className={styles.deepAside}>
            <section>
              <h2>Sources</h2>
              {references.length ? references.map((source, i) => (
                <a key={source.url + i} href={source.url} target="_blank" rel="noreferrer" className={styles.sourceLink}>
                  {source.title} ↗
                </a>
              )) : <p className={styles.muted}>Source links unavailable. See attached evidence references.</p>}
            </section>
            <section>
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
