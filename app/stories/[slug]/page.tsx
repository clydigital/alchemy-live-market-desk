import Link from "next/link";
import { notFound } from "next/navigation";

import CaseMonitorBoard from "@/components/live-desk/CaseMonitorBoard";
import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, formatDeskDate, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import detailStyles from "@/components/live-desk/story-detail.module.css";
import { buildCaseMonitorBoards, caseMonitorForStory } from "@/lib/case-monitors";
import { getStoryBySlug, getStoryDetailSupport } from "@/lib/data";
import { getIntelligenceStoryRoom } from "@/lib/intelligence/story-room";
import { getRegimeLiveReasoning } from "@/lib/regime-live-reasoning";
import { latestThesisVersion } from "@/lib/persistence/contracts";
import { getStoryRecordLayerForStory } from "@/lib/persistence/read";
import { classifyRegimeStory, getRegimeDefinition, routeStoryToRegimes } from "@/lib/regimes";
import { assessStoryCatalyst, catalystDisplayLabel } from "@/lib/story-hygiene";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function StoryDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const story = await getStoryBySlug(slug);
  if (!story) notFound();
  const [data, recordLayer, intelligenceRoom, storyReasoningRows] = await Promise.all([
    getStoryDetailSupport(story.id, story.slug),
    getStoryRecordLayerForStory(story.id),
    getIntelligenceStoryRoom(story.id),
    getRegimeLiveReasoning([story.id]),
  ]);
  const caseMonitorBoards = await buildCaseMonitorBoards({
    stories: [story],
    macroObservations: data.macroObservations,
    marketObservations: data.marketObservations,
    statements: data.statements,
    researchIntake: data.researchIntake,
  });
  const caseMonitor = caseMonitorForStory(caseMonitorBoards, slug);
  const storyReasoning = storyReasoningRows[0] || null;

  const legacyUpdates = data.updates.filter((update) => update.story_id === story.id);
  const versions = recordLayer.thesisVersions.filter((version) => version.story_id === story.id);
  const currentVersion = latestThesisVersion(versions);
  const events = recordLayer.available
    ? recordLayer.events.filter((event) => event.story_id === story.id).map((event) => ({
      id: event.id,
      type: event.event_type,
      headline: event.headline,
      detail: event.detail,
      at: event.event_at,
      impact: event.impact,
    }))
    : legacyUpdates.map((update) => ({
      id: update.id,
      type: update.update_type,
      headline: update.headline,
      detail: update.detail,
      at: update.observed_at || update.created_at,
      impact: null,
    }));

  const evidence = data.evidence.filter((item) => item.story_id === story.id);
  const sources = data.sources.filter((source) => source.story_id === story.id);
  const charts = data.charts.filter((chart) => chart.story_id === story.id);
  const coverage = data.evidenceCoverage.find((item) => item.slug === story.slug);

  const maturity = classifyRegimeStory(story, currentVersion);
  const regimeRoutes = routeStoryToRegimes(story, currentVersion);
  const regimeLinks = regimeRoutes.flatMap((route) => {
    const regime = getRegimeDefinition(route.regime);
    return regime ? [{
      slug: regime.slug,
      title: regime.shortTitle,
      subgroup: route.subgroup,
      subgroupLabel: regime.subgroups.find((item) => item.key === route.subgroup)?.label || route.subgroup,
      role: route.role,
    }] : [];
  });

  const current = {
    title: currentVersion?.title || story.title,
    thesis: currentVersion?.thesis || story.thesis,
    status: currentVersion?.status || story.status,
    confidence: currentVersion?.confidence ?? story.confidence,
    marketQuestion: currentVersion?.market_question || story.market_question,
    dominantNarrative: currentVersion?.dominant_narrative || story.dominant_narrative,
    bestExplanation: currentVersion?.best_explanation || story.best_explanation,
    strongestSupport: currentVersion?.strongest_support || story.strongest_support,
    strongestContradiction: currentVersion?.strongest_contradiction || story.strongest_contradiction,
    confirmationTrigger: currentVersion?.confirmation_trigger || story.confirmation_trigger,
    invalidationTrigger: currentVersion?.invalidation_trigger || story.invalidation_trigger,
    nextCatalyst: currentVersion?.next_catalyst || story.next_catalyst,
    assets: currentVersion?.assets?.length ? currentVersion.assets : story.assets,
  };
  const catalystAssessment = assessStoryCatalyst({
    nextCatalyst: current.nextCatalyst,
    version: currentVersion,
  });


  return (
    <LiveDeskShell
      activePath="/stories"
      eyebrow="Persistent Story"
      title={current.title}
      description={current.thesis}
      meta={(
        <>
          <span className={styles.metaLabel}>Current state</span><br />
          {current.status} · {current.confidence}% confidence
        </>
      )}
    >
      <div className={styles.grid}>
        <nav className={detailStyles.recordIndex} aria-label="Story record sections">
          <span>Record index</span>
          <a href="#context">Why it matters</a>
          <a href="#mechanism">Causal chain</a>
          <a href="#monitors">Live monitors</a>
          <a href="#thesis">Current thesis</a>
          <a href="#versions">Thesis versions</a>
          <a href="#events">Event timeline</a>
          <a href="#evidence">Evidence</a>
          <a href="#intelligence-room">Evidence Room</a>
          <a href="#sources">Sources</a>
        </nav>

        <MetricGrid
          items={[
            { value: events.length, label: "Dated Story events" },
            { value: versions.length || 1, label: recordLayer.available ? "Thesis versions" : "Current thesis state" },
            { value: evidence.length, label: "Evidence records" },
            { value: sources.length, label: "Linked sources" },
          ]}
        />

        <DataState
          state={recordLayer.available ? "ready" : "warn"}
          title={recordLayer.available ? "Immutable Story history available" : "Current Story record active"}
          detail={recordLayer.available
            ? `This Story has ${versions.length} complete thesis version${versions.length === 1 ? "" : "s"} and ${events.length} append-only event${events.length === 1 ? "" : "s"}.`
            : "Exact links are available for the current Story, dated updates, evidence and sources. Complete historical thesis snapshots will appear after the approved persistence migration is applied."}
        />

        <div id="context" className={detailStyles.sectionAnchor}>
          <Panel
            title="Where this Story fits"
            description="The Story is the living interpretation. Regimes provide the durable market context; What’s New records the dated developments that move it."
            action={<Link className={styles.link} href={`/hybrid-output?story=${encodeURIComponent(story.slug)}`}>Explain in Hybrid →</Link>}
          >
            <div className={styles.recordList}>
              <article className={styles.record}>
                <span className={styles.metaLabel}>REGIME PATH</span>
                {regimeLinks.length ? regimeLinks.map((item) => (
                  <p key={`${item.slug}:${item.subgroup}`}>
                    <Link href={`/regimes/${item.slug}?subgroup=${item.subgroup}`}>
                      {item.title} → {item.subgroupLabel}
                    </Link>
                    {" · "}{item.role}
                  </p>
                )) : <p>Unassigned. This Story remains canonical and visible; it is not forced into a weak Regime mapping.</p>}
              </article>
              <article className={styles.record}>
                <span className={styles.metaLabel}>WHY THIS MATTERS</span>
                <p>{current.bestExplanation || current.thesis}</p>
              </article>
              <article className={styles.record}>
                <span className={styles.metaLabel}>CURRENT QUESTION</span>
                <p>{current.marketQuestion || "No explicit current market question is recorded."}</p>
              </article>
              <article className={styles.record}>
                <span className={styles.metaLabel}>STORY MATURITY</span>
                <p><strong>{maturity.maturity}</strong> · {maturity.reason}</p>
              </article>
              {catalystAssessment.recalibrationRequired ? (
                <DataState
                  state="warn"
                  title="Catalyst expired — recalibration required"
                  detail={`${catalystAssessment.label || "The dated catalyst"} has passed. It remains visible as history, but Story maintenance must replace or clear it before it is treated as a current next test.`}
                />
              ) : null}
            </div>
          </Panel>
        </div>

        <div id="mechanism" className={detailStyles.sectionAnchor}>
          <Panel
            title="How this Story works"
            description="Canonical System 2 reasoning only: the accepted hypothesis, mechanism and evidence-bounded causal edges that explain why this Story matters now."
            action={<Link className={styles.link} href={regimeLinks[0] ? `/regimes/${regimeLinks[0].slug}?subgroup=${regimeLinks[0].subgroup}&view=live` : "/regimes"}>Open Regime LIVE →</Link>}
          >
            {storyReasoning ? (
              <div className={detailStyles.reasoningGrid}>
                <article className={styles.record}>
                  <span className={styles.metaLabel}>CURRENT CANONICAL HYPOTHESIS</span>
                  <h3>{storyReasoning.question || storyReasoning.statement}</h3>
                  {storyReasoning.question ? <p>{storyReasoning.statement}</p> : null}
                  <p><strong>Mechanism:</strong> {storyReasoning.mechanism}</p>
                  <div className={styles.meta}>
                    {Math.round(storyReasoning.confidence)}% hypothesis confidence · {storyReasoning.decisionState.replaceAll("_", " ")}
                  </div>
                </article>
                {storyReasoning.causalChain.length ? (
                  <div className={detailStyles.causalChain}>
                    {storyReasoning.causalChain.map((edge, index) => (
                      <article className={detailStyles.causalEdge} key={`${storyReasoning.hypothesisId}:${index}`}>
                        <div className={detailStyles.edgePath}>
                          <span>{edge.from}</span>
                          <b>→ {edge.relationship} →</b>
                          <span>{edge.to}</span>
                        </div>
                        <small>
                          {edge.evidenceState.replaceAll("_", " ")} · {edge.evidenceCount} linked evidence record{edge.evidenceCount === 1 ? "" : "s"}
                        </small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <DataState title="No persisted causal edges" detail="A canonical hypothesis exists, but no structured causal-chain edges are persisted. The Story page will not manufacture a chain from prose." />
                )}
              </div>
            ) : (
              <DataState state="warn" title="Canonical causal chain not yet persisted" detail="This Story can remain current without a structured hypothesis chain. Regime and Story pages will not infer one from titles or headlines." />
            )}
          </Panel>
        </div>

        <CaseMonitorBoard board={caseMonitor} />

        <div id="thesis" className={`${styles.gridTwo} ${detailStyles.sectionAnchor}`}>
          <Panel title="Current thesis state" description="The latest accepted explanation, support and contradiction for this Story.">
            <div className={styles.recordList}>
              <article className={styles.record}>
                <span className={styles.metaLabel}>Market belief</span>
                <p>{current.dominantNarrative || current.marketQuestion || "Not recorded"}</p>
              </article>
              <article className={styles.record}>
                <span className={styles.metaLabel}>Accepted explanation</span>
                <p>{current.bestExplanation || "Not recorded"}</p>
              </article>
              <article className={styles.record}>
                <span className={styles.metaLabel}>Strongest support</span>
                <p>{current.strongestSupport || "Not recorded"}</p>
              </article>
              <article className={styles.record}>
                <span className={styles.metaLabel}>Strongest contradiction</span>
                <p>{current.strongestContradiction || "Not recorded"}</p>
              </article>
            </div>
          </Panel>

          <Panel title="Test and portfolio map" description="Confirmation, invalidation and the next catalyst remain explicit beside affected assets.">
            <div className={styles.recordList}>
              <article className={styles.record}>
                <span className={styles.metaLabel}>Confirmation</span>
                <p>{current.confirmationTrigger || "Not recorded"}</p>
              </article>
              <article className={styles.record}>
                <span className={styles.metaLabel}>Invalidation</span>
                <p>{current.invalidationTrigger || "Not recorded"}</p>
              </article>
              <article className={styles.record}>
                <span className={styles.metaLabel}>Next catalyst</span>
                <p>{catalystDisplayLabel(catalystAssessment) || "Not recorded"}</p>
                {catalystAssessment.recalibrationRequired ? <small>Expired catalyst · Story maintenance must replace or clear this before it is treated as current.</small> : null}
                {catalystAssessment.recalibrationRequired ? <div className={styles.meta}>Expired catalyst — not current guidance.</div> : null}
              </article>
              <article className={styles.record}>
                <span className={styles.metaLabel}>Affected assets</span>
                <p>{current.assets?.join(" · ") || "No assets mapped"}</p>
              </article>
              {coverage ? <DataState state={coverage.room_status === "ready" ? "ready" : "warn"} title={`Evidence room: ${coverage.room_status}`} detail={`${coverage.source_count} sources, ${coverage.evidence_count} evidence records, ${coverage.contradiction_count} contradiction(s), ${coverage.unresolved_count} unresolved test(s).`} /> : null}
            </div>
          </Panel>
        </div>

        <div id="versions" className={detailStyles.sectionAnchor}>
          <Panel
            title="Thesis version history"
            description="Complete thesis snapshots remain separate from dated events so a later interpretation never overwrites the earlier accepted case."
            action={<Badge tone={recordLayer.available ? "ready" : "default"}>{recordLayer.available ? `${versions.length} versions` : "Current state only"}</Badge>}
          >
            {versions.length ? (
              <div className={detailStyles.versionList}>
                {versions.map((version) => (
                  <article className={detailStyles.version} id={`version-${version.id}`} key={version.id}>
                    <div className={detailStyles.versionNumber}>v{version.version_number}</div>
                    <div>
                      <h4>
                        {version.title}
                        {version.id === currentVersion?.id ? <span className={detailStyles.currentVersion}>Current</span> : null}
                      </h4>
                      <p>{version.thesis}</p>
                      <small>{formatDeskDate(version.effective_at)} · {version.change_reason} · {version.confidence}% confidence</small>
                    </div>
                    <a className={detailStyles.recordLink} href={`#version-${version.id}`}>#{version.id.slice(0, 8)}</a>
                  </article>
                ))}
              </div>
            ) : (
              <DataState title="Historical thesis versions are not yet available" detail="The current Story thesis remains visible. No earlier full-thesis state is inferred from dated notes." />
            )}
          </Panel>
        </div>

        <div id="events" className={detailStyles.sectionAnchor}>
          <Panel title="Story event timeline" description="Dated material changes with stable links to the exact event record.">
            <div className={styles.recordList}>
              {events.length ? events.map((event) => (
                <article className={`${styles.record} ${detailStyles.exactRecord}`} id={`event-${event.id}`} key={event.id}>
                  <div className={styles.recordHeader}>
                    <div>
                      <h3>{event.headline}</h3>
                      <div className={styles.meta}>{formatDeskDate(event.at)}</div>
                    </div>
                    <div className={styles.inlineMeta}>
                      <Badge>{event.type}</Badge>
                      {event.impact ? <Badge tone={event.impact === "supports" ? "ready" : event.impact === "contradicts" ? "risk" : "default"}>{event.impact}</Badge> : null}
                    </div>
                  </div>
                  {event.detail ? <p>{event.detail}</p> : null}
                  <div className={detailStyles.recordFooter}>
                    <span>Story event record</span>
                    <a className={detailStyles.recordLink} href={`#event-${event.id}`}>Record link #{event.id.slice(0, 8)}</a>
                  </div>
                </article>
              )) : <DataState title="No dated Story events" detail="No linked event records are available for this Story." />}
            </div>
          </Panel>
        </div>

        <div id="intelligence-room" className={detailStyles.sectionAnchor}>
          <Panel
            title="Canonical Evidence Room"
            description="Alchemy-first synthesis, provenance-linked evidence, lifecycle state and entity relationships. No external article is required to own this Story."
            action={intelligenceRoom.state ? <Badge tone={intelligenceRoom.state.publicationEligible ? "ready" : "default"}>{intelligenceRoom.state.lifecycleStatus}</Badge> : null}
          >
            {intelligenceRoom.available ? (
              <div className={styles.recordList}>
                {intelligenceRoom.state ? (
                  <article className={styles.record}>
                    <div className={styles.recordHeader}>
                      <h3>{intelligenceRoom.room?.title || "Persistent intelligence state"}</h3>
                      <Badge>{Math.round(intelligenceRoom.state.qualificationScore)} qualification</Badge>
                    </div>
                    <p>{intelligenceRoom.room?.synthesis || intelligenceRoom.state.researchSynthesis || "The Evidence Room is open; synthesis awaits sufficient canonical evidence."}</p>
                    {intelligenceRoom.state.marketBelief ? <p><strong>Market belief:</strong> {intelligenceRoom.state.marketBelief}</p> : null}
                    {intelligenceRoom.state.divergence ? <p><strong>Divergence:</strong> {intelligenceRoom.state.divergence}</p> : null}
                    {intelligenceRoom.state.bias ? <div className={styles.meta}>Scenario: {intelligenceRoom.state.bias.replaceAll("_", " ")} · {intelligenceRoom.state.conviction === null ? "unscored" : `${Math.round(intelligenceRoom.state.conviction)} conviction`}</div> : null}
                    <div className={styles.meta}>Novelty: {intelligenceRoom.state.noveltyClass || "not yet classified"} · Room: {intelligenceRoom.room?.status || "state only"}</div>
                  </article>
                ) : null}
                {intelligenceRoom.hypothesis ? (
                  <article className={styles.record}>
                    <div className={styles.recordHeader}>
                      <h3>{intelligenceRoom.hypothesis.question || intelligenceRoom.hypothesis.statement}</h3>
                      <Badge>{intelligenceRoom.hypothesis.decisionState} · {Math.round(intelligenceRoom.hypothesis.confidence)}</Badge>
                    </div>
                    <p>{intelligenceRoom.hypothesis.statement}</p>
                    <p><strong>Causal mechanism:</strong> {intelligenceRoom.hypothesis.causalMechanism}</p>
                    {intelligenceRoom.challenger ? (
                      <p><strong>Alchemy Challenger ({intelligenceRoom.challenger.verdict}):</strong> {intelligenceRoom.challenger.strongestCountercase}{intelligenceRoom.challenger.weakestLink ? ` Weakest link: ${intelligenceRoom.challenger.weakestLink}` : ""}</p>
                    ) : null}
                  </article>
                ) : null}
                {intelligenceRoom.scenarios.map((scenario) => (
                  <article className={styles.record} key={scenario.asset}>
                    <div className={styles.recordHeader}>
                      <h3>{scenario.asset} scenario</h3>
                      <Badge>{scenario.bias.replaceAll("_", " ")} · {scenario.conviction === null ? "unscored" : Math.round(scenario.conviction)}</Badge>
                    </div>
                    <p><strong>Base:</strong> {String(scenario.baseCase.description || "Not specified")}</p>
                    <p><strong>Bull:</strong> {String(scenario.bullCase.description || "Not specified")}</p>
                    <p><strong>Bear:</strong> {String(scenario.bearCase.description || "Not specified")}</p>
                    <div className={styles.meta}>Confirm: {scenario.confirmation} · Invalidate: {scenario.invalidation}</div>
                  </article>
                ))}
                {intelligenceRoom.evidence.map((item) => (
                  <article className={`${styles.record} ${detailStyles.exactRecord}`} id={`canonical-evidence-${item.id}`} key={item.id}>
                    <div className={styles.recordHeader}>
                      <h3>{item.claim}</h3>
                      <div className={styles.inlineMeta}><Badge>{item.role}</Badge><Badge>{item.direction}</Badge></div>
                    </div>
                    {item.summary ? <p>{item.summary}</p> : null}
                    <div className={detailStyles.recordFooter}>
                      <span>{item.confidence}% confidence · {formatDeskDate(item.eventAt)}</span>
                      {item.provenanceUrls[0] ? <a className={detailStyles.recordLink} href={item.provenanceUrls[0]} target="_blank" rel="noreferrer">Provenance</a> : null}
                    </div>
                  </article>
                ))}
                {intelligenceRoom.relationships.length ? (
                  <article className={styles.record}>
                    <span className={styles.metaLabel}>Entity relationship map</span>
                    {intelligenceRoom.relationships.map((relationship) => {
                      const from = intelligenceRoom.entities.find((entity) => entity.id === relationship.fromEntityId)?.name || relationship.fromEntityId.slice(0, 8);
                      const to = intelligenceRoom.entities.find((entity) => entity.id === relationship.toEntityId)?.name || relationship.toEntityId.slice(0, 8);
                      return <p key={relationship.id}>{from} → {relationship.relationship} → {to} ({Math.round(relationship.confidence)}%)</p>;
                    })}
                  </article>
                ) : null}
                {intelligenceRoom.room?.unresolvedQuestions.length ? (
                  <article className={styles.record}>
                    <span className={styles.metaLabel}>Unresolved questions</span>
                    {intelligenceRoom.room.unresolvedQuestions.map((question) => <p key={question}>{question}</p>)}
                  </article>
                ) : null}
              </div>
            ) : (
              <DataState state="warn" title="Canonical Evidence Room not yet persisted" detail={intelligenceRoom.unavailableReason || "Apply the additive intelligence migration and link canonical evidence to this Story."} />
            )}
          </Panel>
        </div>

        <div className={styles.gridTwo}>
          <div id="evidence" className={detailStyles.sectionAnchor}>
            <Panel title="Evidence" description="Current evidence is shown with its recorded type, strength and exact record anchor.">
              <div className={styles.recordList}>
                {evidence.length ? evidence.slice(0, 30).map((item) => (
                  <article className={`${styles.record} ${detailStyles.exactRecord}`} id={`evidence-${item.id}`} key={item.id}>
                    <div className={styles.recordHeader}>
                      <h3>{item.claim}</h3>
                      <Badge tone={item.strength >= 80 ? "ready" : item.strength < 50 ? "warn" : "default"}>{item.strength}</Badge>
                    </div>
                    {item.detail ? <p>{item.detail}</p> : null}
                    <div className={detailStyles.recordFooter}>
                      <span>{item.evidence_type} · {formatDeskDate(item.created_at)}</span>
                      <a className={detailStyles.recordLink} href={`#evidence-${item.id}`}>#{item.id.slice(0, 8)}</a>
                    </div>
                  </article>
                )) : <DataState title="No linked evidence" detail="No evidence records are currently linked to this Story." />}
              </div>
            </Panel>
          </div>

          <div id="sources" className={detailStyles.sectionAnchor}>
            <Panel title="Sources" description="Every source remains traceable to its exact URL and stable desk record anchor.">
              <div className={styles.recordList}>
                {sources.length ? sources.slice(0, 30).map((source) => (
                  <article className={`${styles.record} ${detailStyles.exactRecord}`} id={`source-${source.id}`} key={source.id}>
                    <div className={styles.recordHeader}>
                      <div>
                        <a href={source.url} target="_blank" rel="noreferrer"><h3>{source.title}</h3></a>
                        <div className={styles.meta}>{source.publisher} · {source.source_type}</div>
                      </div>
                      <Badge>{source.reliability_score}</Badge>
                    </div>
                    <p>{source.notes || `Published ${formatDeskDate(source.publication_date)}. Observed ${formatDeskDate(source.observation_date)}.`}</p>
                    <div className={detailStyles.recordFooter}>
                      <span>Source record</span>
                      <a className={detailStyles.recordLink} href={`#source-${source.id}`}>#{source.id.slice(0, 8)}</a>
                    </div>
                  </article>
                )) : <DataState title="No linked sources" detail="No source records are currently linked to this Story." />}
              </div>
            </Panel>
          </div>
        </div>

        {charts.length ? <div className={styles.meta}>{charts.length} Story-linked chart request{charts.length === 1 ? "" : "s"} are available in Charts.</div> : null}
        <Link className={styles.link} href="/stories">← Back to Stories</Link>
      </div>
    </LiveDeskShell>
  );
}
