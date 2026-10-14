"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Panel } from "./LiveDeskUi";
import styles from "./market-brief-reader.module.css";
import type {
  MarketBriefArticleV1,
  MarketBriefArticlesProjectionResult,
  MarketBriefParagraphRole,
} from "../../lib/market-brief-articles";

export type MarketBriefReaderProps = {
  projection?: MarketBriefArticlesProjectionResult | null;
  articles?: MarketBriefArticleV1[];
  initialArticleId?: string | null;
};

function toneForStatus(status: MarketBriefArticleV1["interpretationStatus"]): "ready" | "warn" | "risk" | "default" {
  if (status === "SUPPORTED") return "ready";
  if (status === "MIXED") return "warn";
  return "risk";
}

function roleLabel(role: MarketBriefParagraphRole): string {
  switch (role) {
    case "opening": return "1 · Drivers & Catalyst";
    case "mechanism": return "2 · Causal Mechanism";
    case "reaction": return "3 · Market Reaction";
    case "contradiction": return "4 · Countercase & Risks";
    case "context": return "5 · Background & Positioning";
    case "outlook": return "6 · Conditional Outlook";
    default: return role;
  }
}

export default function MarketBriefReader({
  projection,
  articles: directArticles,
  initialArticleId,
}: MarketBriefReaderProps) {
  const articlesList = directArticles || projection?.articles || [];
  const [currentIndex, setCurrentIndex] = useState(0);

  // Set initial index if initialArticleId provided
  useEffect(() => {
    if (initialArticleId && articlesList.length > 0) {
      const foundIdx = articlesList.findIndex(a => a.articleId === initialArticleId);
      if (foundIdx >= 0) {
        setCurrentIndex(foundIdx);
      }
    }
  }, [initialArticleId, articlesList]);

  const total = articlesList.length;
  const currentArticle = total > 0 ? articlesList[currentIndex] : null;

  const handlePrev = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex(prev => (prev === 0 ? total - 1 : prev - 1));
  }, [total]);

  const handleNext = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex(prev => (prev === total - 1 ? 0 : prev + 1));
  }, [total]);

  // Keyboard navigation support
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext]);

  if (!currentArticle || total === 0) {
    return (
      <Panel
        title="Market Brief"
        description="Source-grounded daily editorial articles projected directly from canonical edition records."
        action={<Badge tone="default">READER</Badge>}
      >
        <div className={styles.emptyCard}>
          <h3>Market Brief Insufficient Data</h3>
          <p>
            {projection?.blockedReason
              || "No durable, source-grounded story or lesson records exist in the current edition to construct Market Brief articles."}
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Canonical Market Brief"
      description="Direct, source-grounded long-form articles projected from the current published edition and Dossier state."
      action={<Badge tone="ready">CANONICAL PROJECTION</Badge>}
    >
      <section
        className={styles.readerCard}
        aria-label="Market Brief Article Reader"
        role="region"
      >
        <header className={styles.header}>
          <div className={styles.topBar}>
            <div className={styles.categoryGroup}>
              <span className={styles.categoryTag}>{currentArticle.category}</span>
              <span className={styles.articleCounter}>
                Article {currentIndex + 1} of {total}
              </span>
            </div>

            <div className={styles.navControls}>
              <button
                type="button"
                className={styles.navButton}
                onClick={handlePrev}
                disabled={total <= 1}
                aria-label="Previous article (or press Left Arrow)"
              >
                ‹ Previous
              </button>
              <button
                type="button"
                className={styles.navButton}
                onClick={handleNext}
                disabled={total <= 1}
                aria-label="Next article (or press Right Arrow)"
              >
                Next ›
              </button>
            </div>
          </div>

          <h2 className={styles.title}>{currentArticle.title}</h2>
          <p className={styles.deck}>{currentArticle.deck}</p>

          <div className={styles.metadata}>
            <Badge tone={toneForStatus(currentArticle.interpretationStatus)}>
              {currentArticle.interpretationStatus}
            </Badge>
            <span>Edition {currentArticle.editionId}</span>
            {currentArticle.dossierId ? (
              <span>Dossier {currentArticle.dossierId}</span>
            ) : null}
          </div>
        </header>

        <div className={styles.articleBody}>
          {currentArticle.paragraphs.map((p, idx) => (
            <article className={styles.paragraph} key={p.role + ":" + idx}>
              <span className={styles.paragraphRole}>{roleLabel(p.role)}</span>
              <p className={styles.paragraphText}>{p.text}</p>

              {p.canonicalEvidenceIds.length > 0 ? (
                <div className={styles.evidenceFooter}>
                  <details className={styles.evidenceDetails}>
                    <summary>
                      Inspect canonical evidence references ({p.canonicalEvidenceIds.length})
                    </summary>
                    <ul className={styles.evidenceList}>
                      {p.canonicalEvidenceIds.map((id) => (
                        <li key={id}>{id}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <footer className={styles.footerSection}>
          <div className={styles.outlookBox}>
            <h4 className={styles.outlookTitle}>Conditional Outlook & Triggers</h4>
            <p className={styles.outlookText}>{currentArticle.conditionalOutlook}</p>
          </div>

          {currentArticle.sourceLinks.length > 0 ? (
            <div className={styles.sourcesBox}>
              <h5 className={styles.sourcesTitle}>Source Provenance</h5>
              <div className={styles.sourceLinks}>
                {currentArticle.sourceLinks.map((src, i) => (
                  <a
                    key={src.url + ":" + i}
                    className={styles.sourceLink}
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {src.title} ↗
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </footer>
      </section>
    </Panel>
  );
}
