import Link from "next/link";

import { Badge, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { styles } from "@/components/live-desk/LiveDeskShell";
import type {
  HybridEvidenceClassification,
  HybridReasoningProjection,
  HybridScenarioKey,
} from "@/lib/hybrid-reasoning-projection";

function tone(value: HybridEvidenceClassification): "default" | "ready" | "warn" | "risk" {
  if (value === "CONFIRMING") return "ready";
  if (value === "ACCELERATING" || value === "INVALIDATING") return "risk";
  if (value === "CONTRADICTING") return "warn";
  return "default";
}

const SCENARIO_LABELS: Record<HybridScenarioKey, string> = {
  A: "A · Divergence survives",
  B: "B · Rates / AI-credit repricing",
  C: "C · Broad credit transmission",
  D: "D · Systemic deleveraging",
  E: "E · US-confidence break",
};

export default function HybridReasoningPanel({ projection }: { projection: HybridReasoningProjection }) {
  const keys: HybridScenarioKey[] = ["A", "B", "C", "D", "E"];

  return (
    <>
      <Panel
        title="Evidence → scenario ladder"
        description="Hybrid applies a transparent, bounded scenario projection to canonical Live/Dossier state. The percentages are modelled reasoning, not evidence or a new Story state."
        action={<Badge tone="ready">READ-ONLY MODEL</Badge>}
      >
        <MetricGrid
          items={keys.map((key) => ({
            value: String(projection.scenarios.current[key]) + "%",
            label: SCENARIO_LABELS[key],
          }))}
        />
        <div className={styles.recordList}>
          {projection.scenarios.reasons.length ? projection.scenarios.reasons.map((reason) => (
            <article className={styles.record} key={reason}>
              <p>{reason}</p>
            </article>
          )) : (
            <article className={styles.record}>
              <p>No bounded scenario shift is justified beyond the starting 30 / 40 / 20 / 8 / 2 research prior.</p>
            </article>
          )}
          {projection.scenarios.guardedTails.map((note) => (
            <article className={styles.record} key={note}>
              <p><strong>Tail guard:</strong> {note}</p>
            </article>
          ))}
        </div>
      </Panel>

      <Panel
        title="Canonical Story evidence classification"
        description="Latest immutable Story state is classified against each current Dossier Story. ACCELERATING is reserved for explicit canonical amplification, not dramatic wording."
      >
        <div className={styles.recordList}>
          {projection.storyClassifications.length ? projection.storyClassifications.map((item) => (
            <article className={styles.record} key={item.storyId}>
              <div className={styles.recordHeader}>
                <div>
                  <h3>{item.title}</h3>
                  <div className={styles.meta}>
                    {item.canonicalEvidenceCount} canonical reference(s)
                    {item.latestVersionNumber !== null ? " · thesis v" + item.latestVersionNumber : ""}
                  </div>
                </div>
                <Badge tone={tone(item.classification)}>{item.classification}</Badge>
              </div>
              <p>{item.reason}</p>
              <Link className={styles.link} href={"/stories/" + item.storySlug}>Open exact Live Story →</Link>
            </article>
          )) : (
            <article className={styles.record}>
              <p>No current Dossier Story has enough exact Live identity to classify. Hybrid stays unresolved.</p>
            </article>
          )}
        </div>
      </Panel>

      <Panel
        title="Story mutation boundary"
        description="Hybrid does not create a third thesis-version path."
        action={<Badge>A3 QUEUE ONLY</Badge>}
      >
        <div className={styles.recordList}>
          <article className={styles.record}>
            <p>{projection.mutationBoundary.statement}</p>
            <p><strong>Path:</strong> {projection.mutationBoundary.path.join(" → ")}</p>
          </article>
        </div>
      </Panel>
    </>
  );
}
