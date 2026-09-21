import LiveDeskShell from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, formatDeskDate } from "@/components/live-desk/LiveDeskUi";
import { getDossierV2PresentationSelection } from "@/lib/dossier-v2/presentation-reader";

import styles from "./dossier.module.css";

export const dynamic = "force-dynamic";

function noticeTone(tone: "ready" | "warn" | "error"): "ready" | "warn" | "risk" {
  return tone === "ready" ? "ready" : tone === "error" ? "risk" : "warn";
}

function severityTone(severity: string): "default" | "warn" | "risk" {
  const value = severity.toLowerCase();
  if (value === "critical" || value === "material" || value === "high") return "risk";
  if (value === "medium" || value === "warning") return "warn";
  return "default";
}

export default async function DossierPage() {
  const selection = await getDossierV2PresentationSelection();
  const dossier = selection.presentation;

  if (!dossier) {
    return (
      <LiveDeskShell
        activePath="/dossier"
        eyebrow="Canonical Dossier V2"
        title="Dossier"
        description="The current market interpretation will appear here only when a persisted Dossier V2 can be rendered safely."
        meta={<Badge tone="risk">Unavailable</Badge>}
      >
        <DataState
          state="risk"
          title={selection.notice.label}
          detail={selection.notice.detail}
        />
      </LiveDeskShell>
    );
  }

  return (
    <LiveDeskShell
      activePath="/dossier"
      eyebrow="Canonical Dossier V2"
      title="Dossier"
      description="One persisted market interpretation for Live and Hybrid: what matters now, what still needs proving, and the charts that resolve it."
      meta={
        <div className={styles.metaBlock}>
          <Badge tone={noticeTone(selection.notice.tone)}>{selection.notice.label}</Badge>
          <span>As of {formatDeskDate(dossier.asOf)}</span>
        </div>
      }
    >
      <div className={styles.workspace}>
        <section className={[styles.notice, selection.usingFallback ? styles.noticeWarn : ""].filter(Boolean).join(" ")}>
          <div>
            <span>DESK STATE</span>
            <strong>{selection.notice.label}</strong>
          </div>
          <p>{selection.notice.detail}</p>
        </section>

        <section className={styles.hero}>
          <div className={styles.heroKicker}>
            <span>CURRENT MARKET DOSSIER</span>
            <Badge tone={dossier.health.degraded ? "warn" : "ready"}>
              {dossier.health.degraded ? "Degraded" : dossier.header.epistemicLabel}
            </Badge>
          </div>
          <h2>{dossier.header.headline}</h2>
          <p className={styles.heroAnswer}>{dossier.header.answer}</p>
          <div className={styles.heroFooter}>
            <div>
              <small>REGIME IMPLICATION</small>
              <p>{dossier.header.regimeImplication}</p>
            </div>
            <div>
              <small>WHAT WOULD CHANGE THE VIEW</small>
              <p>{dossier.header.whatWouldChangeMind}</p>
            </div>
          </div>
        </section>

        <section className={styles.regimeSection}>
          <div className={styles.sectionHead}>
            <div>
              <span>CONTEXT STRIP</span>
              <h3>Cross-asset regime</h3>
            </div>
            <small>{dossier.regimeStrip.filter((lens) => lens.observed).length} observed lenses</small>
          </div>
          <div className={styles.regimeGrid}>
            {dossier.regimeStrip.map((lens) => (
              <article className={styles.regimeItem} key={lens.key} data-observed={lens.observed}>
                <header>
                  <strong>{lens.label.replaceAll("_", " ")}</strong>
                  <span>{lens.observed ? "Observed" : "Unresolved"}</span>
                </header>
                {lens.reaction ? <p className={styles.reaction}>{lens.reaction}</p> : null}
                <p>{lens.interpretation}</p>
                {lens.unresolvedSignals.length ? (
                  <small>{lens.unresolvedSignals.join(" · ")}</small>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className={styles.primarySection}>
          <div className={styles.sectionHead}>
            <div>
              <span>01 / WHAT MATTERS NOW</span>
              <h3>The stories carrying the regime</h3>
            </div>
            <small>{dossier.whatMattersNow.stories.length} supported stories</small>
          </div>
          <div className={styles.storyList}>
            {dossier.whatMattersNow.stories.map((story, index) => (
              <article className={styles.story} key={story.id}>
                <div className={styles.storyIndex}>{String(index + 1).padStart(2, "0")}</div>
                <div className={styles.storyBody}>
                  <header>
                    <div>
                      <span>{story.epistemicLabel}</span>
                      <h4>{story.title}</h4>
                    </div>
                    <small>{story.evidenceRefs.length} evidence refs</small>
                  </header>
                  <div className={styles.storyColumns}>
                    <div>
                      <small>WHAT CHANGED</small>
                      <p>{story.whatChanged}</p>
                    </div>
                    <div>
                      <small>WHY IT MATTERS</small>
                      <p>{story.whyItMatters}</p>
                    </div>
                  </div>
                  <div className={styles.mechanism}>
                    <small>MECHANISM</small>
                    <p>{story.mechanism}</p>
                  </div>
                  <footer>
                    <span>Current read: {story.conclusion}</span>
                    <span>Change the view: {story.whatWouldChangeMind}</span>
                  </footer>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.primarySection}>
          <div className={styles.sectionHead}>
            <div>
              <span>02 / WATCH NEXT</span>
              <h3>Open investigations</h3>
            </div>
            <small>{dossier.watchNext.length} active questions</small>
          </div>
          {dossier.watchNext.length ? (
            <div className={styles.investigationList}>
              {dossier.watchNext.map((item) => (
                <article className={styles.investigation} key={item.id}>
                  <header>
                    <Badge tone={item.status === "weakened" ? "warn" : "default"}>{item.status}</Badge>
                    <h4>{item.question}</h4>
                  </header>
                  <p className={styles.explanation}>{item.currentExplanation}</p>
                  <div className={styles.investigationGrid}>
                    <div>
                      <small>WHY IT MATTERS</small>
                      <p>{item.whyItMatters}</p>
                    </div>
                    <div>
                      <small>RESEARCH NEXT</small>
                      <p>{item.researchNext}</p>
                    </div>
                    <div>
                      <small>CONFIRM</small>
                      <p>{item.confirmationCondition}</p>
                    </div>
                    <div>
                      <small>INVALIDATE</small>
                      <p>{item.invalidationCondition}</p>
                    </div>
                  </div>
                  {item.competingExplanations.length ? (
                    <div className={styles.competing}>
                      <small>COMPETING EXPLANATIONS</small>
                      <span>{item.competingExplanations.join(" · ")}</span>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <DataState
              state="ready"
              title="No priority investigation is open"
              detail="The current Dossier has no unresolved investigation promoted into Watch Next."
            />
          )}
        </section>

        <section className={styles.primarySection}>
          <div className={styles.sectionHead}>
            <div>
              <span>03 / RESEARCH NOW</span>
              <h3>Highest-information next actions</h3>
            </div>
            <small>{dossier.researchNow.length} actions</small>
          </div>
          <div className={styles.actionList}>
            {dossier.researchNow.map((item) => (
              <article className={styles.action} key={item.rank + "-" + item.action}>
                <b>{String(item.rank).padStart(2, "0")}</b>
                <div>
                  <h4>{item.action}</h4>
                  <p>{item.reason}</p>
                  <small>Information gain: {item.expected_information_gain}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <details className={styles.more} open>
          <summary>
            <span>MORE / CHARTS, RADAR & THEMES</span>
            <strong>Supporting workbench</strong>
          </summary>

          <div className={styles.moreGrid}>
            <section className={styles.lowerSection}>
              <div className={styles.lowerHead}>
                <span>TRADINGVIEW INVESTIGATIONS</span>
                <strong>{dossier.charts.core.length} core charts</strong>
              </div>
              <div className={styles.lowerList}>
                {dossier.charts.core.map((chart) => (
                  <article key={chart.chart_id}>
                    <header>
                      <b>{chart.ticker_or_instrument}</b>
                      <span>{chart.timeframe}</span>
                    </header>
                    <p>{chart.exact_question}</p>
                    <small>Confirm: {chart.confirmation_condition}</small>
                    <small>Contradict: {chart.contradiction_condition}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.lowerSection}>
              <div className={styles.lowerHead}>
                <span>STOCK RADAR</span>
                <strong>{dossier.stockRadar.length} linked instruments</strong>
              </div>
              <div className={styles.lowerList}>
                {dossier.stockRadar.map((item) => (
                  <article key={item.symbol}>
                    <header>
                      <b>{item.symbol}</b>
                      <span>{item.linkage_type.replaceAll("_", " ")}</span>
                    </header>
                    <p>{item.why_relevant}</p>
                    <small>Research: {item.research_question}</small>
                    <small>Invalidate: {item.invalidating_signal}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.lowerSection}>
              <div className={styles.lowerHead}>
                <span>DEVELOPING THEMES</span>
                <strong>{dossier.themes.length}</strong>
              </div>
              <div className={styles.lowerList}>
                {dossier.themes.map((theme) => (
                  <article key={theme.theme_id}>
                    <header>
                      <b>{theme.title}</b>
                      <span>{theme.supporting_evidence_ids.length} refs</span>
                    </header>
                    <p>{theme.summary}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.lowerSection}>
              <div className={styles.lowerHead}>
                <span>THESIS CHANGES</span>
                <strong>{dossier.thesisChanges.length}</strong>
              </div>
              {dossier.thesisChanges.length ? (
                <div className={styles.lowerList}>
                  {dossier.thesisChanges.map((change) => (
                    <article key={change.thesisId}>
                      <header>
                        <b>{change.title}</b>
                        <span>{change.change.replaceAll("_", " ")}</span>
                      </header>
                      <p>{change.reason}</p>
                      <small>
                        {change.previousState ? change.previousState + " → " : ""}
                        {change.state} · v{change.version}
                      </small>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyText}>No thesis state changed in this Dossier.</p>
              )}
            </section>
          </div>
        </details>

        <details className={styles.audit}>
          <summary>
            <span>RESEARCH HEALTH & GAPS</span>
            <strong>{dossier.health.researchGaps.length} gaps · {dossier.evidenceIndex.length} evidence refs</strong>
          </summary>
          <div className={styles.auditBody}>
            {dossier.health.freshnessWarnings.length ? (
              <div className={styles.auditBlock}>
                <h4>Freshness warnings</h4>
                {dossier.health.freshnessWarnings.map((warning) => <p key={warning}>{warning}</p>)}
              </div>
            ) : null}
            <div className={styles.gapList}>
              {dossier.health.researchGaps.map((gap) => (
                <article key={gap.id}>
                  <Badge tone={severityTone(gap.severity)}>{gap.severity}</Badge>
                  <div>
                    <strong>{gap.category}</strong>
                    <p>{gap.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </details>
      </div>
    </LiveDeskShell>
  );
}
