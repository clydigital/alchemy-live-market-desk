import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { getLiveDeskHomepageDailyBrief, getHybridExactDailyBriefEdition } from "@/lib/hybrid-publication";
import { projectMarketBriefArticles } from "@/lib/market-brief-articles";
import { loadEditorialMarketBrief } from "@/lib/market-brief-editorial-data";
import { buildV7NewsroomPreview } from "@/lib/blue-desk-v7-newsroom-preview";

import desk from "../blue-desk.module.css";
import ui from "./newsroom-preview.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Newsroom Review | Blue Desk",
  description: "Private editorial review of immutable Blue Desk publication.",
};

type SearchParams = { edition?: string | string[] };

export default async function BlueDeskNewsroomReview({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Exact frozen-edition selector for owner review. Reject a malformed or
  // missing edition rather than silently substituting the latest report.
  const { edition } = await searchParams;
  const selected = edition !== undefined;
  if (selected && (typeof edition !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(edition))) {
    notFound();
  }
  // No separate Newsroom source of truth; reuse the canonical frozen
  // daily-brief reader and qualified editorial evidence path.
  const latest = selected
    ? await getHybridExactDailyBriefEdition(edition as string).catch(() => null)
    : await getLiveDeskHomepageDailyBrief({ fresh: true }).catch(() => null);
  if (selected && !latest) notFound();
  const projected = projectMarketBriefArticles(latest);
  const editorial = await loadEditorialMarketBrief(projected);
  const cards = buildV7NewsroomPreview(editorial);
  const host = (await headers()).get("host");

  return (
    <main className={desk.page} data-blue-desk-v7-newsroom="owner-preview">
      <BlueDeskHeader activePath="/blue-desk" />
      <div className={desk.content}>
        <nav aria-label="Newsroom review navigation" className={ui.breadcrumb}>
          <Link href={blueDeskPublicHref("/blue-desk", host)}>← Live Market</Link>
          <span>Owner editorial review · not publicly released</span>
        </nav>
        <header className={ui.hero}>
          <p className={desk.kicker}>V7 · NEWSROOM / OWNER REVIEW</p>
          <h1>Market reporting, with receipts</h1>
          <p>
            {selected ? "Exact archived edition selected for review. " : "Latest frozen daily brief selected for review. "}
            Draft editorial formats from the existing frozen daily brief.
            Issuer and official observations are separated from adjudicated
            market interpretation. Research-only items are never presented
            as published market news.
          </p>
          <form method="get" action="/blue-desk/newsroom" className={ui.editionPicker} aria-label="Review an exact frozen publication">
            <label htmlFor="edition-id">Review exact historical edition UUID</label>
            <div>
              <input
                id="edition-id"
                type="text"
                name="edition"
                defaultValue={selected ? edition as string : ""}
                pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
                maxLength={36}
                placeholder="Frozen publication UUID"
                required
              />
              <button type="submit">Open exact edition</button>
              <Link href="/blue-desk/newsroom">Latest edition</Link>
            </div>
            <p>No nearest-date or latest fallback is permitted for an explicit edition ID.</p>
          </form>
          <dl className={ui.edition}>
            <div><dt>Edition</dt><dd>{latest?.id || "Unavailable"}</dd></div>
            <div><dt>Published</dt><dd>{latest?.published_at || "Unavailable"}</dd></div>
            <div><dt>Full articles</dt><dd>{cards.filter(c => c.format === "FULL_ARTICLE").length}</dd></div>
            <div><dt>Factual briefs</dt><dd>{cards.filter(c => c.format === "FACTUAL_BRIEF").length}</dd></div>
          </dl>
        </header>

        {!latest ? (
          <section className={ui.empty} role="status">
            <h2>Publication temporarily unavailable</h2>
            <p>The canonical daily brief could not be retrieved. No older or invented report is substituted.</p>
          </section>
        ) : cards.length === 0 ? (
          <section className={ui.empty} role="status">
            <h2>No source-qualified article candidates</h2>
            <p>This frozen edition does not supply publishable article records. Research operations are unchanged.</p>
          </section>
        ) : (
          <section aria-labelledby="newsroom-candidates">
            <h2 id="newsroom-candidates" className={ui.sectionTitle}>Edition-pinned editorial candidates</h2>
            <div className={ui.cards}>
              {cards.map(card => (
                <article className={ui.card} key={card.articleId}>
                  <div className={ui.meta}>
                    <span className={ui.category}>{card.category}</span>
                    <span className={ui.format}>{card.format === "FULL_ARTICLE"
                      ? "Full-length evidence ready"
                      : card.format === "FACTUAL_BRIEF"
                        ? "Factual brief · interpretation separate"
                        : "Research only · not publishable"}</span>
                  </div>
                  <h3>{card.title}</h3>
                  <p className={ui.deck}>{card.deck}</p>
                  <p className={ui.trace}>
                    Frozen edition {card.editionId} · Interpretation {card.interpretationStatus}
                    {card.isAcceptedStory ? " · Canonically adjudicated" : " · No accepted Story verdict"}
                  </p>

                  {card.format === "FULL_ARTICLE" && (
                    <div className={ui.sections}>
                      <section>
                        <h4>Reporting · {card.reporting.length} documented paragraphs</h4>
                        {card.reporting.map((paragraph, i) => (
                          <div className={ui.paragraph} key={"r-" + i}>
                            <p>{paragraph.text}</p>
                            <a href={paragraph.originalUrls[0]} target="_blank" rel="noreferrer">
                              Original document ↗
                            </a>
                          </div>
                        ))}
                      </section>
                      <section>
                        <h4>Market interpretation · {card.interpretation.length} paragraphs</h4>
                        {card.interpretation.map((paragraph, i) => (
                          <div className={ui.paragraph} key={"i-" + i}>
                            <p>{paragraph.text}</p>
                            <a href={paragraph.originalUrls[0]} target="_blank" rel="noreferrer">
                              Source underpinning this interpretation ↗
                            </a>
                          </div>
                        ))}
                      </section>
                    </div>
                  )}

                  {card.format === "FACTUAL_BRIEF" && (
                    <section className={ui.facts}>
                      <h4>Original-source observations</h4>
                      <ul>
                        {card.observations.map((fact, i) => (
                          <li key={i}>
                            <p>{fact.claim}</p>
                            <a href={fact.sourceUrl} target="_blank" rel="noreferrer">
                              {fact.sourceName} · original document ↗
                            </a>
                          </li>
                        ))}
                      </ul>
                      <p>These observations do not establish the full market thesis or a price reaction.</p>
                    </section>
                  )}

                  {card.format === "RESEARCH_ONLY" && (
                    <p className={ui.review}>Not publishable: primary evidence, article structure or adjudication is insufficient.</p>
                  )}

                  {!!card.gaps.length && (
                    <details className={ui.details}>
                      <summary>Editorial requirements still missing</summary>
                      <ul>{card.gaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul>
                    </details>
                  )}

                  {card.format !== "RESEARCH_ONLY" && (
                    <Link
                      className={ui.readMore}
                      href={blueDeskPublicHref(
                        "/blue-desk/stories/" + encodeURIComponent(card.articleId)
                          + "?edition=" + encodeURIComponent(card.editionId), host)}
                    >
                      Open exact historical Story edition →
                    </Link>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
        <footer className={ui.footer}>
          Private editorial preview. No Newsroom public route, research write,
          new API, live market fetch, or article backfill is enabled here.
        </footer>
      </div>
    </main>
  );
}
