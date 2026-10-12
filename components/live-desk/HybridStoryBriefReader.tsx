import { Badge, DataState, formatDeskDate, Panel } from "./LiveDeskUi";
import { styles } from "./LiveDeskShell";
import type { HybridStoryEvidenceDelta } from "../../lib/hybrid-canonical-evidence-delta";

type EvidenceItem = HybridStoryEvidenceDelta["items"][number];

function vintage(item: EvidenceItem) {
  if (item.change === "CARRIED_FORWARD") return "Existing Dossier evidence";
  if (item.change === "NEWLY_CITED_IN_DOSSIER") return "Newly cited in this Dossier · not necessarily new today";
  if (item.change === "NO_COMPARABLE_PRIOR_STORY") return "Story has no exact prior match";
  if (item.change === "WATCH_CONDITION") return "Watch condition · not an observed market move";
  return "Evidence age not compared";
}

function EvidenceItems({ items }: { items: EvidenceItem[] }) {
  return (
    <div className={styles.recordList}>
      {items.map((item) => (
        <article className={styles.record} key={item.kind + ":" + item.storyId + ":" + item.evidenceRefs.join("|")}>
          <div className={styles.recordHeader}>
            <div>
              <span className={styles.kicker}>{vintage(item)}</span>
              <h3>{item.storyTitle}</h3>
            </div>
            <Badge>{item.kind === "SUPPORT" ? "SUPPORTING" : item.kind === "CHALLENGE" ? "CONTRADICTING" : "NEXT TEST"}</Badge>
          </div>
          <p>{item.text}</p>
          {item.evidenceRefs.length > 0 ? (
            <details>
              <summary>Inspect exact Dossier evidence references ({item.evidenceRefs.length})</summary>
              <ul>
                {item.evidenceRefs.map(ref => <li key={ref}><code>{ref}</code></li>)}
              </ul>
            </details>
          ) : (
            <p className={styles.meta}>No new evidence is claimed for this condition.</p>
          )}
        </article>
      ))}
    </div>
  );
}

/**
 * Presentation of the existing Dossier's supported/contradicting Story record.
 * Independent source-verified Motion and unverified creator LEADS remain in
 * their own distinct lanes. This component never performs an AI inference.
 */
export default function HybridStoryBriefReader({ projection, asOf }: {
  projection: HybridStoryEvidenceDelta;
  asOf: string;
}) {
  const support = projection.items.filter(item => item.kind === "SUPPORT");
  const challenges = projection.items.filter(item => item.kind === "CHALLENGE");
  const next = projection.items.filter(item => item.kind === "NEXT_TEST");
  const a2 = projection.motions;

  return (
    <Panel
      title="What's shaping this market view?"
      description="The strongest Story evidence, what goes against it and the next checks. These are the frozen Dossier's judgements, not a list of new headlines."
      action={<Badge>EXACT DOSSIER</Badge>}
    >
      <p className={styles.meta}>
        Dossier {projection.selectedDossierId} · As of {formatDeskDate(asOf)}
        {" · "}{projection.baselineStatus === "EXACT_PREDECESSOR"
          ? "Compared with exact earlier Dossier"
          : "No exact predecessor comparison"}
      </p>
      <section aria-label="What still supports the view">
        <h3>What still supports the view</h3>
        {support.length ? <EvidenceItems items={support} /> : (
          <DataState title="No supporting Story evidence classified" detail="A Story link or creator lead alone cannot establish support." />
        )}
      </section>
      <section aria-label="What challenges the view">
        <h3>What challenges the view</h3>
        {challenges.length ? <EvidenceItems items={challenges} /> : (
          <p>No contradicting Story evidence is classified in this Dossier. That does not establish that there is no countercase.</p>
        )}
      </section>
      <section aria-label="What would change the view">
        <h3>What would change the view</h3>
        {next.length ? <EvidenceItems items={next} /> : (
          <p>No exact next condition is available in the selected Dossier.</p>
        )}
      </section>
      {a2.length ? (
        <section aria-label="Accepted Motion read-through">
          <h3>Accepted Motion read-through</h3>
          <p className={styles.meta}>Only exact evidence-backed Dossier A2 decisions. This is not a fresh source report.</p>
          <div className={styles.recordList}>
            {a2.map(item => (
              <article className={styles.record} key={item.motionId}>
                <span className={styles.kicker}>{item.decision} · {item.change.replaceAll("_", " ")}</span>
                <p>{item.conclusion}</p>
                <details>
                  <summary>Source and judgement references</summary>
                  <p className={styles.meta}>Motion {item.motionId} · Story {item.storyId}</p>
                  {item.evidenceRefs.map(ref => <p className={styles.meta} key={ref}><code>{ref}</code></p>)}
                </details>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </Panel>
  );
}
