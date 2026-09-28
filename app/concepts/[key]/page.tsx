import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getConcept } from "@/lib/concepts";
import { getRegimeDefinition } from "@/lib/regimes";

export const dynamic = "force-static";

type PageProps = {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function ConceptDetailPage({ params, searchParams }: PageProps) {
  const { key } = await params;
  const query = await searchParams;
  const concept = getConcept(key);
  if (!concept) notFound();

  const from = typeof query.from === "string" && query.from.startsWith("/") && !query.from.startsWith("//")
    ? query.from
    : "/concepts";

  if (key !== concept.key) {
    const suffix = from === "/concepts" ? "" : `?from=${encodeURIComponent(from)}`;
    redirect(`/concepts/${concept.key}${suffix}`);
  }

  const regimes = concept.regimes.flatMap((slug) => {
    const regime = getRegimeDefinition(slug);
    return regime ? [regime] : [];
  });

  return (
    <LiveDeskShell
      activePath="/concepts"
      eyebrow="Concept"
      title={concept.label}
      description={concept.definition}
      meta={`v${concept.version} · ${concept.status} · ${regimes.length} related Regime${regimes.length === 1 ? "" : "s"}`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: concept.version, label: "Definition version" },
            { value: regimes.length, label: "Related Regimes" },
            { value: concept.watch.length, label: "Things to watch" },
            { value: concept.aliases.length, label: "Stable aliases" },
          ]}
        />

        <Panel
          title="What it means"
          description="Concepts are explanatory building blocks. They can clarify a causal mechanism, but they do not independently set Story confidence or Regime state."
          action={<Badge tone={concept.status === "active" ? "ready" : "default"}>{concept.status}</Badge>}
        >
          <div className={styles.recordList}>
            <article className={styles.record}>
              <span className={styles.metaLabel}>DEFINITION</span>
              <p>{concept.definition}</p>
            </article>
            <article className={styles.record}>
              <span className={styles.metaLabel}>WHY IT MATTERS</span>
              <p>{concept.whyItMatters}</p>
            </article>
            <article className={styles.record}>
              <span className={styles.metaLabel}>WATCH</span>
              <p>{concept.watch.join(" · ")}</p>
            </article>
            <article className={styles.record}>
              <span className={styles.metaLabel}>STABLE ID / ALIASES</span>
              <p>{concept.key}{concept.aliases.length ? ` · ${concept.aliases.join(" · ")}` : ""}</p>
            </article>
          </div>
        </Panel>

        <Panel
          title="Where this Concept is used"
          description="Open the related Regime in UNDERSTAND mode to see the Concept inside its current structural context."
        >
          <div className={styles.recordList}>
            {regimes.map((regime) => (
              <article className={styles.record} key={regime.slug}>
                <span className={styles.metaLabel}>REGIME</span>
                <h3>{regime.title}</h3>
                <p>{regime.whyItMatters}</p>
                <Link className={styles.link} href={`/regimes/${regime.slug}?view=understand#concept-${concept.key}`}>
                  Open in Regime context →
                </Link>
              </article>
            ))}
          </div>
        </Panel>

        <Link className={styles.link} href={from}>← Back to context</Link>
      </div>
    </LiveDeskShell>
  );
}
