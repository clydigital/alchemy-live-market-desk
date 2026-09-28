import Link from "next/link";

import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { listConcepts } from "@/lib/concepts";
import { getRegimeDefinition } from "@/lib/regimes";

export const dynamic = "force-static";

export default function ConceptsPage() {
  const concepts = listConcepts();
  const relatedRegimes = new Set(concepts.flatMap((concept) => concept.regimes));

  return (
    <LiveDeskShell
      activePath="/concepts"
      eyebrow="Concept Library"
      title="Concept Library"
      description="Stable explanations for the recurring mechanisms used across Regimes and Stories. Concepts explain the machinery; they do not create market conclusions."
      meta={`${concepts.length} governed Concepts · v1 registry`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: concepts.length, label: "Governed Concepts" },
            { value: relatedRegimes.size, label: "Linked Regimes" },
            { value: concepts.filter((concept) => concept.status === "active").length, label: "Active" },
            { value: concepts.reduce((count, concept) => count + concept.aliases.length, 0), label: "Stable aliases" },
          ]}
        />

        <Panel
          title="Canonical concepts"
          description="Definitions are code-governed, versioned and shared across Regimes. A Concept may appear in more than one Regime without being duplicated."
          action={<Badge tone="ready">Governed registry</Badge>}
        >
          <div className={styles.gridTwo}>
            {concepts.map((concept) => {
              const regimes = concept.regimes.flatMap((slug) => {
                const regime = getRegimeDefinition(slug);
                return regime ? [regime.shortTitle] : [];
              });

              return (
                <article className={styles.record} key={concept.key}>
                  <div className={styles.recordHeader}>
                    <div>
                      <span className={styles.metaLabel}>CONCEPT · v{concept.version}</span>
                      <h3>{concept.label}</h3>
                    </div>
                    <Badge tone={concept.status === "active" ? "ready" : "default"}>{concept.status}</Badge>
                  </div>
                  <p>{concept.definition}</p>
                  <p><strong>Why it matters:</strong> {concept.whyItMatters}</p>
                  <div className={styles.meta}>Used in: {regimes.join(" · ") || "Unassigned"}</div>
                  <Link className={styles.link} href={`/concepts/${concept.key}`}>Open Concept →</Link>
                </article>
              );
            })}
          </div>
        </Panel>
      </div>
    </LiveDeskShell>
  );
}
