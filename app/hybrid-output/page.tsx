import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDossierV2PresentationSelection } from "@/lib/dossier-v2/presentation-reader";

export const dynamic = "force-dynamic";

export default async function HybridOutputPage() {
  const selection = await getDossierV2PresentationSelection();
  const dossier = selection.presentation;

  if (!dossier) {
    return (
      <LiveDeskShell
        activePath="/hybrid-output"
        title="Hybrid Output"
        description="Review the handoff from canonical Live research records to the interpretative Hybrid experience."
        meta="Canonical Dossier unavailable"
      >
        <DataState
          title={selection.notice.label}
          detail={selection.notice.detail}
        />
      </LiveDeskShell>
    );
  }

  const unresolvedPolicyChecks = dossier.policyOutlook.filter(
    (item) => item.gaps.length > 0,
  ).length;
  const openInvestigations = dossier.watchNext.length;
  const requiredCharts = dossier.charts.core.length;

  return (
    <LiveDeskShell
      activePath="/hybrid-output"
      title="Hybrid Output"
      description="Review the canonical Live-to-Hybrid handoff: expectation, observed reaction, divergence, investigation and invalidation."
      meta={`${dossier.policyOutlook.length} policy check(s) · ${openInvestigations} open investigation(s)`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: dossier.whatMattersNow.stories.length, label: "Canonical stories" },
            { value: dossier.policyOutlook.length, label: "Policy expectation checks" },
            { value: openInvestigations, label: "Open investigations" },
            { value: requiredCharts, label: "Required charts" },
          ]}
        />

        <DataState
          title={selection.notice.label}
          detail={selection.notice.detail}
        />

        <div className={styles.gridTwo}>
          <Panel
            title="Expectation → tape"
            description="Deterministic pre-event expectations and the canonical post-trigger observations passed to Hybrid."
          >
            <div className={styles.recordList}>
              {dossier.policyOutlook.length ? dossier.policyOutlook.map((item) => (
                <article className={styles.record} key={item.id}>
                  <div className={styles.recordHeader}>
                    <div>
                      <h3>{item.trigger}</h3>
                      <div className={styles.meta}>
                        {item.ruleId} · {item.nextMeetingRateOutlook.replaceAll("_", " ")}
                      </div>
                    </div>
                    <Badge tone={item.policyImpulse === "HAWKISH" ? "warn" : "ready"}>
                      {item.policyImpulse}
                    </Badge>
                  </div>

                  <p>
                    Expected tape: {item.expectedMarketReactions
                      .map((reaction) => `${reaction.instrument} ${reaction.direction === "UP" ? "↑" : "↓"}`)
                      .join(" · ")}
                  </p>

                  <p>
                    Rate pricing: {item.observedRatePricing ?? "Not yet observed in canonical evidence."}
                  </p>

                  <p>
                    Tape confirmation: {item.observedConfirmation ?? "Not yet observed in canonical evidence."}
                  </p>

                  {item.gaps.length ? (
                    <p>
                      Missing: {item.gaps.join(" · ")}
                    </p>
                  ) : null}
                </article>
              )) : (
                <DataState
                  title="No deterministic policy checks in this Dossier"
                  detail="Hybrid should not manufacture an expectation or divergence when the canonical Dossier has none."
                />
              )}
            </div>
          </Panel>

          <Panel
            title="Divergence journey"
            description="Open contradictions remain questions until evidence resolves the mechanism."
          >
            <div className={styles.recordList}>
              {dossier.watchNext.length ? dossier.watchNext.map((item) => (
                <article className={styles.record} key={item.id}>
                  <div className={styles.recordHeader}>
                    <div>
                      <h3>{item.question}</h3>
                      <div className={styles.meta}>
                        {item.evidenceRefs.length} evidence ref(s) · {item.missingEvidence.length} missing input(s)
                      </div>
                    </div>
                    <Badge tone="warn">{item.status}</Badge>
                  </div>

                  <p>Current explanation: {item.currentExplanation}</p>
                  <p>Research next: {item.researchNext}</p>
                  <p>Confirm: {item.confirmationCondition}</p>
                  <p>Invalidate: {item.invalidationCondition}</p>

                  {item.competingExplanations.length ? (
                    <p>
                      Competing explanations: {item.competingExplanations.join(" · ")}
                    </p>
                  ) : null}
                </article>
              )) : (
                <DataState
                  title="No open divergence investigations"
                  detail="The current canonical Dossier has no unresolved investigation promoted into Watch Next."
                />
              )}
            </div>
          </Panel>
        </div>

        <div className={styles.gridTwo}>
          <Panel
            title="Hybrid handoff integrity"
            description="What must remain unchanged when Hybrid turns the Dossier into a guided journey."
          >
            <div className={styles.recordList}>
              <article className={styles.record}>
                <h3>Preserve the prior expectation</h3>
                <p>Do not rewrite the expected reaction after seeing the tape.</p>
              </article>
              <article className={styles.record}>
                <h3>Keep unknown mechanisms unresolved</h3>
                <p>Candidate explanations remain hypotheses until supporting evidence is present.</p>
              </article>
              <article className={styles.record}>
                <h3>Carry invalidation forward</h3>
                <p>Each investigation keeps its confirmation and invalidation conditions visible to Hybrid.</p>
              </article>
            </div>
          </Panel>

          <Panel
            title="Current handoff status"
            description="Bounded canonical state available to the Hybrid presentation layer."
          >
            <div className={styles.recordList}>
              <article className={styles.record}>
                <h3>Dossier</h3>
                <p>{dossier.header.headline}</p>
              </article>
              <article className={styles.record}>
                <h3>Unresolved policy checks</h3>
                <p>{unresolvedPolicyChecks} check(s) still have missing canonical confirmation data.</p>
              </article>
              <article className={styles.record}>
                <h3>Required chart work</h3>
                <p>{requiredCharts} core chart investigation(s) are attached to the current Dossier.</p>
              </article>
            </div>
          </Panel>
        </div>

        <a
          className={styles.primaryButton}
          href="https://alchemy-hybrid-market-desk.vercel.app/overview"
          target="_blank"
          rel="noreferrer"
        >
          Open current Hybrid Desk ↗
        </a>
      </div>
    </LiveDeskShell>
  );
}
