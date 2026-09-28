import Link from "next/link";

import type { DossierPresentationSelection } from "@/lib/dossier-v2/presentation-reader";
import type {
  DossierPresentationInvestigationJourney,
  DossierPresentationInvestigationTransition,
} from "@/lib/dossier-v2/presentation-adapter";

import { Badge, Panel } from "./LiveDeskUi";
import styles from "./divergence-journey-overview.module.css";

const HIDDEN = new Set<DossierPresentationInvestigationTransition>([
  "BASELINE",
  "UNCHANGED",
  "STATUS_CHANGED",
]);

const PRIORITY: Record<DossierPresentationInvestigationTransition, number> = {
  DIVERGENCE_ESCALATED: 0,
  DIVERGENCE_DETECTED: 1,
  EVIDENCE_BECAME_UNRESOLVED: 2,
  ALIGNED_CONFIRMED: 3,
  DIVERGENCE_DEESCALATED: 4,
  REOPENED: 5,
  CLOSED: 6,
  NEW: 7,
  NOT_CARRIED_FORWARD: 8,
  STATUS_CHANGED: 9,
  UNCHANGED: 10,
  BASELINE: 11,
};

function toneFor(item: DossierPresentationInvestigationJourney) {
  if (item.transition === "DIVERGENCE_ESCALATED" || item.transition === "DIVERGENCE_DETECTED") {
    return "risk" as const;
  }
  if (
    item.transition === "EVIDENCE_BECAME_UNRESOLVED"
    || item.transition === "DIVERGENCE_DEESCALATED"
    || item.transition === "REOPENED"
    || item.transition === "NOT_CARRIED_FORWARD"
  ) return "warn" as const;
  if (item.transition === "ALIGNED_CONFIRMED" || item.transition === "CLOSED") {
    return "ready" as const;
  }
  return "default" as const;
}

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function stateLine(item: DossierPresentationInvestigationJourney) {
  if (item.previousDivergence && item.currentDivergence) {
    return `${item.previousDivergence} → ${item.currentDivergence}`;
  }
  if (item.currentDivergence) return `Current: ${item.currentDivergence}`;
  if (item.previousDivergence) return `Prior: ${item.previousDivergence}`;
  return "State change recorded";
}

export default function DivergenceJourneyOverview({
  selection,
}: {
  selection: DossierPresentationSelection;
}) {
  const dossier = selection.presentation;
  if (!dossier) return null;

  const changes = dossier.investigationJourney
    .filter((item) => !HIDDEN.has(item.transition))
    .sort((a, b) => PRIORITY[a.transition] - PRIORITY[b.transition] || a.question.localeCompare(b.question))
    .slice(0, 3);

  if (!changes.length) return null;

  return (
    <Panel
      title="Reasoning changes"
      description="Expected-vs-actual investigations that changed since the prior canonical Dossier. Missing items are not treated as resolved."
      action={<Badge tone="default">{changes.length} change{changes.length === 1 ? "" : "s"}</Badge>}
    >
      <div className={styles.list}>
        {changes.map((item) => (
          <article className={styles.item} data-transition={item.transition.toLowerCase()} key={item.currentId ?? item.previousId ?? item.question}>
            <div className={styles.head}>
              <Badge tone={toneFor(item)}>{readable(item.transition)}</Badge>
              <span>{stateLine(item)}</span>
            </div>
            <h3>{item.question}</h3>
            {item.previousExpectedReaction ? (
              <p><strong>Prior expectation:</strong> {item.previousExpectedReaction}</p>
            ) : item.currentExpectedReaction ? (
              <p><strong>Expected reaction:</strong> {item.currentExpectedReaction}</p>
            ) : null}
            {item.transition === "NOT_CARRIED_FORWARD" ? (
              <small>Not present in the current Dossier; this is an audit state, not a resolution.</small>
            ) : item.expectationChanged && item.currentExpectedReaction ? (
              <small>Current expectation wording changed; the prior wording remains the historical baseline.</small>
            ) : null}
          </article>
        ))}
      </div>
      <footer className={styles.footer}>
        <span>Only changed investigation states are shown here.</span>
        <Link href="/dossier">Open full Dossier journey →</Link>
      </footer>
    </Panel>
  );
}
