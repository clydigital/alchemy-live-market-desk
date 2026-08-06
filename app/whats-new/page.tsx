import Link from "next/link";

import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, formatDeskDate, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";

export const dynamic = "force-dynamic";

type Delta = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  at: string | null;
  href?: string;
  verification?: string;
};

export default async function WhatsNewPage() {
  const data = await getDeskData();
  const storyById = new Map(data.stories.map((story) => [story.id, story]));

  const deltas: Delta[] = [
    ...data.updates.map((update) => {
      const story = storyById.get(update.story_id);
      return {
        id: `update-${update.id}`,
        kind: update.update_type,
        title: update.headline,
        detail: update.detail || "No additional detail was stored for this update.",
        at: update.observed_at || update.created_at,
        href: story ? `/stories/${story.slug}` : undefined,
        verification: "Story update",
      };
    }),
    ...data.statements.map((statement) => ({
      id: `statement-${statement.id}`,
      kind: "statement",
      title: `${statement.speaker}: ${statement.topic}`,
      detail: statement.market_interpretation || statement.quote_excerpt,
      at: statement.statement_date,
      href: statement.source_url,
      verification: statement.verification_status,
    })),
    ...data.newsThreads.map((thread) => ({
      id: `news-${thread.id}`,
      kind: thread.category || thread.source_type,
      title: thread.headline,
      detail: thread.current_view || thread.summary,
      at: thread.published_at,
      href: thread.source_url,
      verification: thread.source_type,
    })),
  ].sort((a, b) => Date.parse(b.at || "") - Date.parse(a.at || "")).slice(0, 24);

  return (
    <LiveDeskShell
      activePath="/whats-new"
      title="What’s New"
      description="A shared intake surface for material deltas, public statements and news threads. PR 1 exposes current records without pretending that duplicate grouping or disposition history already exists."
      meta={`${deltas.length} recent records shown`}
    >
      <Panel
        title="Current delta stream"
        description="Detected time, publication time and Story promotion are still separate concerns. PR 3 will formalise the candidate contract and dispositions."
        action={<Link className={styles.link} href="/legacy?tab=Research%20Layer">Open legacy research layer</Link>}
      >
        <div className={styles.recordList}>
          {deltas.length ? deltas.map((delta) => (
            <article className={styles.record} key={delta.id}>
              <div className={styles.recordHeader}>
                <div>
                  {delta.href ? (
                    <a href={delta.href} target={delta.href.startsWith("http") ? "_blank" : undefined} rel={delta.href.startsWith("http") ? "noreferrer" : undefined}>
                      <h3>{delta.title}</h3>
                    </a>
                  ) : <h3>{delta.title}</h3>}
                  <div className={styles.meta}>{formatDeskDate(delta.at)}</div>
                </div>
                <div className={styles.inlineMeta}>
                  <Badge>{delta.kind}</Badge>
                  {delta.verification ? <Badge tone={/verified|official|primary/i.test(delta.verification) ? "ready" : "default"}>{delta.verification}</Badge> : null}
                </div>
              </div>
              <p>{delta.detail}</p>
            </article>
          )) : (
            <DataState state="risk" title="No candidate records returned" detail="The combined update, statement and news queries returned no records. The page does not infer that the market was quiet." />
          )}
        </div>
      </Panel>
    </LiveDeskShell>
  );
}
