import Link from "next/link";
import { notFound } from "next/navigation";

import CaseMonitorBoard from "@/components/live-desk/CaseMonitorBoard";
import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, formatDeskDate, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import detailStyles from "@/components/live-desk/story-detail.module.css";
import { buildCaseMonitorBoards, caseMonitorForStory } from "@/lib/case-monitors";
import { getDeskData } from "@/lib/data";
import { latestThesisVersion } from "@/lib/persistence/contracts";
import { getStoryRecordLayer } from "@/lib/persistence/read";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function StoryDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const [data, recordLayer] = await Promise.all([getDeskData(), getStoryRecordLayer()]);
  const story = data.stories.find((candidate) => candidate.slug === slug);
  if (!story) notFound();
  const caseMonitor = caseMonitorForStory(await buildCaseMonitorBoards(data), slug);

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
          <a href="#monitors">Live monitors</a>
          <a href="#thesis">Current thesis</a>
          <a href="#versions">Thesis versions</a>
          <a href="#events">Event timeline</a>
          <a href="#evidence">Evidence</a>
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
                <p>{current.nextCatalyst || "Not recorded"}</p>
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
