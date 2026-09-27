"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { ProjectedRegime } from "@/lib/regimes";
import styles from "./regime-workspace.module.css";

function displayDate(value: string | null) {
  if (!value) return "No current timestamp";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export default function RegimeDetailWorkspace({
  regime,
  initialSubgroup,
}: {
  regime: ProjectedRegime;
  initialSubgroup?: string | null;
}) {
  const defaultKey = regime.subgroups.some((item) => item.key === initialSubgroup)
    ? initialSubgroup!
    : regime.subgroups[0]?.key || "";
  const [activeKey, setActiveKey] = useState(defaultKey);
  const subgroup = useMemo(
    () => regime.subgroups.find((item) => item.key === activeKey) || regime.subgroups[0],
    [activeKey, regime.subgroups],
  );

  return (
    <div className={styles.board}>
      <section className={styles.hero}>
        <header className={styles.heroHead}>
          <div>
            <span className={styles.kicker}>MARKET REGIME · {regime.stateKind === "system1" ? "SYSTEM 1 TELEMETRY + STORY INTERPRETATION" : "STORY-LED INTERPRETATION"}</span>
            <h1>{regime.title}</h1>
          </div>
          <span className={styles.state} data-kind={regime.stateKind}>{regime.state}</span>
        </header>
        <p className={styles.question}>{regime.coreQuestion}</p>
        <p className={styles.why}><strong>Why this matters:</strong> {regime.whyItMatters}</p>
        <p className={styles.mechanism}>{regime.mechanism}</p>
        <div className={styles.heroMeta}>
          <span>{regime.confidence}</span>
          <span>{regime.stories.length} mapped Stories</span>
          <span>As of {displayDate(regime.asOf)}</span>
        </div>
        <div className={styles.assetRow}>
          {regime.affectedMarkets.map((asset) => <span key={asset}>{asset}</span>)}
        </div>
        <div className={styles.linkRow}>
          <Link href={regime.hybridHref}>Explain this Regime in Hybrid →</Link>
          <Link href="/whats-new">Open What’s New →</Link>
          <Link href="/stories">Open all Stories →</Link>
        </div>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHead}>
          <div>
            <span className={styles.kicker}>UNDERSTAND</span>
            <h2>How this Regime is organised</h2>
          </div>
          <small>Stable drivers, changing Stories</small>
        </header>
        <div className={styles.tabs}>
          {regime.subgroups.map((item) => (
            <button
              type="button"
              className={styles.tab}
              data-accent={item.accent}
              data-active={item.key === subgroup?.key}
              onClick={() => setActiveKey(item.key)}
              key={item.key}
            >
              {item.label} · {item.state}
            </button>
          ))}
        </div>
        {subgroup ? (
          <>
            <p className={styles.why}><strong>{subgroup.label}:</strong> {subgroup.whyItMatters}</p>
            <p className={styles.mechanism}>{subgroup.mechanism}</p>
          </>
        ) : null}
      </section>

      {subgroup ? (
        <section className={styles.section}>
          <header className={styles.sectionHead}>
            <div>
              <span className={styles.kicker}>LIVE · {subgroup.stateKind === "system1" ? "OBSERVED TELEMETRY + INTERPRETATION" : "INTERPRETED STATE"}</span>
              <h2>{subgroup.label}</h2>
            </div>
            <span className={styles.state} data-kind={subgroup.stateKind}>{subgroup.state}</span>
          </header>

          <div className={styles.liveGrid}>
            <div className={styles.column}>
              <div>
                <span className={styles.kicker}>SYSTEM 1 / OBSERVED</span>
                {subgroup.telemetry.length ? (
                  <div className={styles.telemetryGrid}>
                    {subgroup.telemetry.map((item) => (
                      <article className={styles.telemetry} key={item.key}>
                        <span>{item.label}</span>
                        <strong>{item.state}</strong>
                        <p>{item.detail}</p>
                        <small>{item.source} · {displayDate(item.asOf)}</small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={styles.empty}>No deterministic System 1 sensor is wired for this subgroup yet. The state below is Story-led; it is not being presented as a measured score.</div>
                )}
              </div>

              <div>
                <span className={styles.kicker}>CURRENT STORIES / SYSTEM 2</span>
                <div className={styles.storyList}>
                  {subgroup.stories.length ? subgroup.stories.map((story) => (
                    <article className={styles.storyCard} key={story.id}>
                      <div className={styles.storyMeta}>
                        <span>{story.lifecycle}</span>
                        <span>{story.confidence}% thesis confidence</span>
                        {story.versionNumber ? <span>v{story.versionNumber}</span> : null}
                      </div>
                      <h4>{story.title}</h4>
                      <p>{story.thesis}</p>
                      <div className={styles.linkRow}>
                        <Link href={`/stories/${story.slug}`}>Open Story →</Link>
                        <Link href={story.hybridHref}>Explain in Hybrid →</Link>
                      </div>
                    </article>
                  )) : <div className={styles.empty}>No accepted active Story is mapped to this subgroup. Do not infer a thesis from the absence of a Story.</div>}
                </div>
              </div>
            </div>

            <div className={styles.column}>
              <div>
                <span className={styles.kicker}>WHAT IS CONTRIBUTING NOW</span>
                <div className={styles.nodeList}>
                  {subgroup.nodes.length ? subgroup.nodes.map((node) => (
                    <article className={styles.node} data-state={node.state} key={node.id}>
                      <div className={styles.nodeMeta}>
                        <span className={styles.nodeState}>{node.state.replaceAll("_", " ")}</span>
                        <span>{node.sourceKind.replaceAll("_", " ")}</span>
                        <span>{displayDate(node.timestamp)}</span>
                      </div>
                      <h4>{node.title}</h4>
                      <p>{node.detail}</p>
                      <div className={styles.linkRow}>
                        {node.href ? <a href={node.href} target={node.sourceKind === "story_event" ? undefined : "_blank"} rel={node.sourceKind === "story_event" ? undefined : "noreferrer"}>Open source →</a> : null}
                        {node.hybridHref ? <Link href={node.hybridHref}>Explain in Hybrid →</Link> : null}
                      </div>
                    </article>
                  )) : <div className={styles.empty}>No recent contribution node is available for this subgroup.</div>}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
