"use client";

import { useMemo, useRef, useState } from "react";
import type { EarningsTone } from "@/lib/bluebelly-earnings-quick-read";
import css from "./EarningsResultRail.module.css";

export type EarningsRailCard = {
  id: string;
  ticker: string;
  name: string;
  period: string;
  day: string;
  fact: string;
  test: string;
  sourceUrl: string;
  sourceName: string;
  resultTone: EarningsTone;
  resultLabel: string;
  guidanceTone: EarningsTone;
  guidanceLabel: string;
  interpretation: string;
  guidanceDetail: string;
};

type Filter = "all" | "positive" | "mixed" | "caution" | "unverified";
const FILTERS: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "positive", label: "Strong" },
  { id: "mixed", label: "Mixed" },
  { id: "caution", label: "Weak / cautious" },
  { id: "unverified", label: "Unverified" },
];

function toneIcon(tone: EarningsTone) {
  return tone === "positive" ? "↑" : tone === "mixed" ? "◐" : tone === "caution" ? "!" : "?";
}

export default function EarningsResultRail({ items }: { items: EarningsRailCard[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [active, setActive] = useState(0);
  const visible = useMemo(
    () => filter === "all" ? items : items.filter(item => item.resultTone === filter),
    [items, filter],
  );
  const current = Math.min(active, Math.max(0, visible.length - 1));

  function goTo(index: number) {
    const target = Math.max(0, Math.min(index, visible.length - 1));
    const rail = railRef.current;
    const card = rail?.children.item(target) as HTMLElement | null | undefined;
    if (rail && card) rail.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
    setActive(target);
  }

  function chooseFilter(next: Filter) {
    setFilter(next);
    setActive(0);
    railRef.current?.scrollTo({ left: 0, behavior: "auto" });
  }

  function trackScroll() {
    const rail = railRef.current;
    if (!rail || rail.children.length < 2) return;
    const first = rail.children.item(0) as HTMLElement;
    const second = rail.children.item(1) as HTMLElement;
    const step = second.offsetLeft - first.offsetLeft;
    if (step > 0) setActive(Math.max(0, Math.min(visible.length - 1, Math.round(rail.scrollLeft / step))));
  }

  return <div className={css.widget} data-earnings-result-slider="source-reviewed">
    <nav className={css.filters} aria-label="Filter released earnings by result assessment">
      {FILTERS.map(option => {
        const count = option.id === "all" ? items.length : items.filter(item => item.resultTone === option.id).length;
        return <button key={option.id} type="button" aria-pressed={filter === option.id}
          onClick={() => chooseFilter(option.id)}>{option.label} <span>{count}</span></button>;
      })}
    </nav>
    <div className={css.rail} ref={railRef} onScroll={trackScroll}
      role="region" aria-label="Earnings results, scroll horizontally" tabIndex={0}>
      {visible.map(item => <article className={css.card} key={item.id} data-issuer-result={item.ticker}>
        <div className={css.cardTop}>
          <strong>{item.ticker} <span className={css.name}>· {item.name}</span></strong>
          <span className={css.day}>{item.day}</span>
        </div>
        <div className={css.period}>{item.period} · RESULT PUBLISHED</div>
        <div className={css.signals}>
          <div className={css.signalRow}>
            <span>Results</span>
            <span className={css.signal} data-tone={item.resultTone}>
              <span aria-hidden="true">{toneIcon(item.resultTone)}</span> {item.resultLabel}
            </span>
          </div>
          <div className={css.signalRow}>
            <span>Guidance</span>
            <span className={css.signal} data-tone={item.guidanceTone}>
              <span aria-hidden="true">{toneIcon(item.guidanceTone)}</span> {item.guidanceLabel}
            </span>
          </div>
        </div>
        <p className={css.interpretation}>{item.interpretation}</p>
        <details className={css.details}>
          <summary>Guidance, reported facts & next test</summary>
          <p><strong>Management outlook:</strong> {item.guidanceDetail}</p>
          <p><strong>Reported:</strong> {item.fact}</p>
          <p><strong>Watch:</strong> {item.test}</p>
        </details>
        <a className={css.source} href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
          {item.sourceName} · Original release ↗
        </a>
      </article>)}
      {!visible.length ? <p className={css.empty}>No source-reviewed reports match this filter.</p> : null}
    </div>
    {visible.length > 1 ? <div className={css.navigation}>
      <button type="button" onClick={() => goTo(current - 1)} disabled={current === 0}
        aria-label="Previous earnings card">‹</button>
      <label className={css.sliderLabel}>
        <span>{current + 1} / {visible.length}</span>
        <input type="range" aria-label="Choose earnings card" min={0} max={visible.length - 1}
          value={current} onChange={event => goTo(Number(event.currentTarget.value))} />
      </label>
      <button type="button" onClick={() => goTo(current + 1)} disabled={current === visible.length - 1}
        aria-label="Next earnings card">›</button>
    </div> : null}
    <p className={css.disclaimer}>Colour describes reviewed operating evidence or management outlook, not an analyst-consensus beat, share-price reaction or trading signal. Grey means not assessed. Swipe or use the slider to browse.</p>
  </div>;
}
