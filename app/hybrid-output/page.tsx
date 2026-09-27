import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";
import { getDossierV2PresentationSelection } from "@/lib/dossier-v2/presentation-reader";
import { getStoryRecordLayer } from "@/lib/persistence/read";
import { buildRegimeProjection } from "@/lib/regimes";

export const dynamic = "force-dynamic";

type HybridOutputPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HybridOutputPage({ searchParams }: HybridOutputPageProps) {
  const [selection, data, recordLayer, query] = await Promise.all([
    getDossierV2PresentationSelection(),
    getDeskData(),
    getStoryRecordLayer(),
    searchParams,
  ]);
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

  const regimes = buildRegimeProjection({
    stories: data.stories,
    events: recordLayer.events,
    versions: recordLayer.thesisVersions,
    newsThreads: data.newsThreads,
    statements: data.statements,
    dossier,
  });
  const storySlug = typeof query.story === "string" ? query.story : null;
  const regimeSlug = typeof query.regime === "string" ? query.regime : null;
  const eventId = typeof query.event === "string" ? query.event : null;
  const focusedStory = storySlug ? data.stories.find((story) => story.slug === storySlug) || null : null;
  const focusedEvent = eventId ? recordLayer.events.find((event) => event.id === eventId) || null : null;
  const focusedEventStory = focusedEvent ? data.stories.find((story) => story.id === focusedEvent.story_id) || null : null;
  const focusedRegime = regimeSlug ? regimes.find((regime) => regime.slug === regimeSlug) || null : null;
  const dossierStory = (focusedStory || focusedEventStory)
    ? dossier.whatMattersNow.stories.find((story) => story.id === (focusedStory || focusedEventStory)?.id) || null
    : null;

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

        {(focusedRegime || focusedStory || focusedEvent) ? (
          <Panel
            title={focusedRegime ? `Focused Regime · ${focusedRegime.shortTitle}` : focusedEvent ? "Focused Event" : "Focused Story"}
            description="This view is anchored to the exact Live object that opened Hybrid. Hybrid explains the canonical state; it does not create a second thesis."
            action={<Badge tone="ready">Deep linked</Badge>}
          >
            <div className={styles.recordList}>
              {focusedRegime ? (
                <>
                  <article className={styles.record}>
                    <div className={styles.recordHeader}>
                      <div>
                        <h3>{focusedRegime.title}</h3>
                        <div className={styles.meta}>{focusedRegime.state} · {focusedRegime.confidence} · {focusedRegime.stories.length} mapped Stories</div>
                      </div>
                      <Badge>{focusedRegime.stateKind === "system1" ? "SYSTEM 1 + SYSTEM 2" : "STORY-LED"}</Badge>
                    </div>
                    <p><strong>Why it matters:</strong> {focusedRegime.whyItMatters}</p>
                    <p><strong>Mechanism:</strong> {focusedRegime.mechanism}</p>
                    <p><strong>Current question:</strong> {focusedRegime.coreQuestion}</p>
                  </article>
                  {focusedRegime.latestNode ? (
                    <article className={styles.record}>
                      <h3>Latest contribution</h3>
                      <p>{focusedRegime.latestNode.title}</p>
                      <p>{focusedRegime.latestNode.detail}</p>
                    </article>
                  ) : null}
                  <a className={styles.link} href={`/regimes/${focusedRegime.slug}`}>Back to Live Regime →</a>
                </>
              ) : focusedEvent ? (
                <>
                  <article className={styles.record}>
                    <div className={styles.recordHeader}>
                      <div>
                        <h3>{focusedEvent.headline}</h3>
                        <div className={styles.meta}>{focusedEvent.event_type} · {focusedEvent.impact || "unresolved"}</div>
                      </div>
                      <Badge>{focusedEvent.impact || "EVENT"}</Badge>
                    </div>
                    <p>{focusedEvent.detail || "No additional Story-event detail was persisted."}</p>
                    {focusedEventStory ? <p><strong>Story:</strong> {focusedEventStory.title}</p> : null}
                  </article>
                  {dossierStory ? (
                    <article className={styles.record}>
                      <h3>Why this matters now</h3>
                      <p>{dossierStory.whyItMatters}</p>
                      <p><strong>Mechanism:</strong> {dossierStory.mechanism}</p>
                      <p><strong>Current read:</strong> {dossierStory.conclusion}</p>
                    </article>
                  ) : (
                    <DataState title="Not promoted into the current Dossier" detail="The event remains canonical Live history, but the current Dossier did not promote its parent Story into What Matters Now. Hybrid will not invent a new explanation." />
                  )}
                  {focusedEventStory ? <a className={styles.link} href={`/stories/${focusedEventStory.slug}#event-${focusedEvent.id}`}>Back to exact Live event →</a> : null}
                </>
              ) : focusedStory ? (
                <>
                  <article className={styles.record}>
                    <h3>{dossierStory?.title || focusedStory.title}</h3>
                    <p>{dossierStory?.whyItMatters || focusedStory.thesis}</p>
                    {dossierStory ? <p><strong>Mechanism:</strong> {dossierStory.mechanism}</p> : null}
                    {dossierStory ? <p><strong>Current read:</strong> {dossierStory.conclusion}</p> : <p>This Story is not promoted in the current Dossier; no extra interpretation is manufactured here.</p>}
                  </article>
                  <a className={styles.link} href={`/stories/${focusedStory.slug}`}>Back to Live Story →</a>
                </>
              ) : null}
            </div>
          </Panel>
        ) : null}

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
