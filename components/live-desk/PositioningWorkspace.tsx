"use client";

import { useMemo, useState } from "react";

import type { CotMarketGroup, CotSnapshot } from "@/lib/cot";

import styles from "./positioning-workspace.module.css";

type Mode = "alchemy" | "legacy";
type GroupFilter = "All" | CotMarketGroup;
type StoryLink = { title: string; href: string };

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function signed(value: number, suffix = "") {
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

function scoreClass(score: number) {
  if (score >= 81) return styles.hot;
  if (score >= 61) return styles.warm;
  if (score <= 20) return styles.cool;
  if (score <= 39) return styles.coolSoft;
  return styles.neutral;
}

function scoreLabel(score: number, type: "commercial" | "spec") {
  if (type === "commercial") {
    if (score >= 81) return "Near net-short extreme";
    if (score >= 61) return "More net short";
    if (score <= 20) return "Near net-long extreme";
    if (score <= 39) return "More net long";
    return "Mid-range";
  }
  if (score >= 81) return "Crowded long";
  if (score <= 20) return "Crowded short";
  if (score >= 61) return "Elevated long";
  if (score <= 39) return "Light / short";
  return "Mid-range";
}

function pct(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}% OI`;
}

function insightFor(snapshot: CotSnapshot) {
  if (snapshot.largeSpecScore >= 81) {
    return `${snapshot.label} large-spec exposure is near the top of its 52-week range. Price confirmation is still required before treating crowding as a reversal signal.`;
  }
  if (snapshot.largeSpecScore <= 20) {
    return `${snapshot.label} large-spec exposure is near the bottom of its 52-week range. This can amplify a squeeze, but the report does not time one.`;
  }
  if (Math.abs(snapshot.weeklyChange) >= 10) {
    return `${snapshot.label} recorded the largest weekly percentile shift in the current set. The move is material, but remains positioning context rather than a trade call.`;
  }
  return `${snapshot.label} remains inside its middle 52-week positioning range. The current report does not show a clear crowding extreme.`;
}

export default function PositioningWorkspace({ snapshots, storyLinks }: { snapshots: CotSnapshot[]; storyLinks: Record<string, StoryLink | undefined> }) {
  const [mode, setMode] = useState<Mode>("legacy");
  const [group, setGroup] = useState<GroupFilter>("All");

  const filtered = group === "All" ? snapshots : snapshots.filter((snapshot) => snapshot.group === group);
  const extremes = useMemo(() => {
    if (!snapshots.length) return null;
    const mostLong = [...snapshots].sort((a, b) => b.largeSpecScore - a.largeSpecScore)[0];
    const mostShort = [...snapshots].sort((a, b) => a.largeSpecScore - b.largeSpecScore)[0];
    const commercial = [...snapshots].sort((a, b) => b.commercialDisplayScore - a.commercialDisplayScore)[0];
    const weekly = [...snapshots].sort((a, b) => Math.abs(b.weeklyChange) - Math.abs(a.weeklyChange))[0];
    return { mostLong, mostShort, commercial, weekly };
  }, [snapshots]);

  const latestDate = snapshots.map((snapshot) => snapshot.reportDate).sort().at(-1);
  const staleCount = snapshots.filter((snapshot) => snapshot.stale).length;

  return (
    <div className={styles.workspace}>
      <div className={styles.modeSwitch} aria-label="Positioning view">
        <button className={mode === "alchemy" ? styles.active : ""} onClick={() => setMode("alchemy")}>Alchemy View</button>
        <button className={mode === "legacy" ? styles.active : ""} onClick={() => setMode("legacy")}>COTSignal-style View</button>
      </div>

      {!snapshots.length ? (
        <section className={styles.emptyState}>
          <h3>Positioning data is updating</h3>
          <p>The desk is waiting for a verified CFTC response. No positioning score is substituted from price action or illustrative values.</p>
        </section>
      ) : mode === "alchemy" ? (
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <span className={styles.kicker}>ALCHEMY VIEW</span>
              <h3>Official Legacy futures-only positioning</h3>
              <p>Raw net positions and percentages of open interest are preserved beside the 52-week scan.</p>
            </div>
            <span className={`${styles.badge} ${staleCount ? styles.badgeStale : ""}`}>{staleCount ? `${staleCount} stale` : "Current"}</span>
          </div>
          <div className={styles.institutionalList}>
            {snapshots.map((snapshot) => (
              <article className={styles.institutionalRow} key={snapshot.code}>
                <div><b>{snapshot.label}</b><small>{snapshot.group} · report {dateLabel(snapshot.reportDate)}</small></div>
                <div><strong>{pct(snapshot.commercialNetPctOi)}</strong><small>Commercial net</small></div>
                <div><strong>{pct(snapshot.largeSpecNetPctOi)}</strong><small>Large Specs net</small></div>
                <div><strong>{pct(snapshot.smallSpecNetPctOi)}</strong><small>Small Specs net</small></div>
              </article>
            ))}
          </div>
          <div className={styles.sourceLine}>
            <span>Legacy futures-only classifications: Commercial, Non-Commercial and Non-Reportable.</span>
            <a href={snapshots[0].sourceUrl} target="_blank" rel="noreferrer">Open official CFTC dataset ↗</a>
          </div>
        </section>
      ) : (
        <>
          {extremes ? (
            <div className={styles.gridTwo}>
              <section className={styles.panel}>
                <div className={styles.panelHead}>
                  <div>
                    <span className={styles.kicker}>WEEKLY POSITIONING EXTREMES</span>
                    <h3>Latest 52-week extremes</h3>
                    <p>What is most crowded or washed out in the latest verified report.</p>
                  </div>
                  <span className={styles.badge}>52-week score</span>
                </div>
                <div className={styles.extremes}>
                  <article className={styles.extremeCard}><small>Most crowded long</small><b>{extremes.mostLong.label} · Large Specs</b><strong className={styles.green}>{extremes.mostLong.largeSpecScore}</strong></article>
                  <article className={styles.extremeCard}><small>Most crowded short</small><b>{extremes.mostShort.label} · Large Specs</b><strong className={styles.red}>{extremes.mostShort.largeSpecScore}</strong></article>
                  <article className={styles.extremeCard}><small>Commercial net-short extreme</small><b>{extremes.commercial.label} · inverted score</b><strong className={styles.blue}>{extremes.commercial.commercialDisplayScore}</strong></article>
                  <article className={styles.extremeCard}><small>Largest weekly shift</small><b>{extremes.weekly.label} · Large Specs</b><strong className={styles.amber}>{signed(extremes.weekly.weeklyChange)}</strong></article>
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHead}>
                  <div>
                    <span className={styles.kicker}>WEEKLY INSIGHTS</span>
                    <h3>What changed this week</h3>
                    <p>Plain-English context, not a trade call.</p>
                  </div>
                </div>
                <div className={styles.insightList}>
                  {[extremes.mostLong, extremes.mostShort, extremes.weekly].map((snapshot) => (
                    <article className={styles.insight} key={`${snapshot.code}-${snapshot.weeklyChange}`}>
                      <h4>{snapshot.label}</h4>
                      <p>{insightFor(snapshot)}</p>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <span className={styles.kicker}>COTSIGNAL-STYLE LEGACY VIEW</span>
                <h3>52-week positioning heatmap</h3>
                <p>Each score ranks the latest CFTC net position against that market's own previous 52 weekly reports.</p>
              </div>
              <span className={`${styles.badge} ${staleCount ? styles.badgeStale : ""}`}>{staleCount ? "Some reports stale" : `Report ${latestDate ? dateLabel(latestDate) : "current"}`}</span>
            </div>

            <div className={styles.toolbar}>
              <div className={styles.segment}>
                {(["All", "Indices & Bonds", "Currencies", "Commodities"] as GroupFilter[]).map((item) => (
                  <button key={item} className={group === item ? styles.active : ""} onClick={() => setGroup(item)}>{item}</button>
                ))}
              </div>
            </div>

            <div className={styles.explainerGrid}>
              <article>
                <strong>What the score displays</strong>
                <p>A percentile rank, not a percentage long. A score of 90 means the latest net position sits above roughly 90% of the observations in its 52-week range.</p>
              </article>
              <article>
                <strong>How to judge Specs</strong>
                <p>80-100 is near the upper extreme and usually means crowded long. 0-20 is near the lower extreme and usually means crowded short. The middle is less informative.</p>
              </article>
              <article>
                <strong>What “inverted” means</strong>
                <p>The Commercial score is shown as 100 minus its raw percentile. Therefore 80-100 means Commercials are near their most net-short or least net-long level of the year. A 0-20 score means they are near their most net-long or least net-short level.</p>
              </article>
              <article>
                <strong>How to use it</strong>
                <p>Extremes flag crowding and squeeze risk, but they do not time reversals. Confirm them with price structure, trend, catalysts and the direction of the weekly change.</p>
              </article>
            </div>

            <div className={styles.scoreGuide} aria-label="52-week score guide">
              <span className={styles.guideCool}><b>0-20</b> lower extreme</span>
              <span className={styles.guideCoolSoft}><b>21-39</b> below range</span>
              <span className={styles.guideNeutral}><b>40-60</b> mid-range</span>
              <span className={styles.guideWarm}><b>61-79</b> above range</span>
              <span className={styles.guideHot}><b>80-100</b> upper extreme</span>
            </div>

            <div className={styles.heatmapWrap}>
              <div className={styles.heatmap}>
                <div className={styles.head}>Market</div>
                <div className={styles.head}>Commercials<br />inverted</div>
                <div className={styles.head}>Large Specs</div>
                <div className={styles.head}>Small Specs</div>
                <div className={styles.head}>Weekly change</div>
                <div className={styles.head}>Story link</div>

                {filtered.map((snapshot) => {
                  const story = storyLinks[snapshot.code];
                  return (
                    <div style={{ display: "contents" }} key={snapshot.code}>
                      <div className={styles.rowLabel}><b>{snapshot.label}</b><small>{snapshot.group} · {snapshot.stale ? "stale" : "current"}</small></div>
                      <div className={`${styles.tile} ${scoreClass(snapshot.commercialDisplayScore)}`}><strong>{snapshot.commercialDisplayScore}</strong><span>{scoreLabel(snapshot.commercialDisplayScore, "commercial")}</span></div>
                      <div className={`${styles.tile} ${scoreClass(snapshot.largeSpecScore)}`}><strong>{snapshot.largeSpecScore}</strong><span>{scoreLabel(snapshot.largeSpecScore, "spec")}</span></div>
                      <div className={`${styles.tile} ${scoreClass(snapshot.smallSpecScore)}`}><strong>{snapshot.smallSpecScore}</strong><span>{scoreLabel(snapshot.smallSpecScore, "spec")}</span></div>
                      <div className={`${styles.tile} ${Math.abs(snapshot.weeklyChange) >= 10 ? styles.warm : styles.neutral}`}><strong>{signed(snapshot.weeklyChange)}</strong><span>Large Spec percentile points</span></div>
                      <div className={`${styles.tile} ${styles.neutral}`}>{story ? <a className={styles.storyLink} href={story.href}>{story.title}</a> : <span>No active Story link</span>}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.sourceLine}>
              <span>Scores use the latest observation against up to 52 prior weekly reports. Raw positions remain available in Alchemy View.</span>
              <a href={snapshots[0].sourceUrl} target="_blank" rel="noreferrer">Open official CFTC dataset ↗</a>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
