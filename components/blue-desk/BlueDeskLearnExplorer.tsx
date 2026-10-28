"use client";

import { useMemo, useState } from "react";
import ui from "@/app/blue-desk/learn/learn.module.css";

type Concept = {
  key: string;
  label: string;
  definition: string;
  whyItMatters: string;
  watch: string[];
  aliases: string[];
  regimes: { slug: string; label: string }[];
};
const categories = [
  { slug: "all", label: "All concepts" },
  { slug: "global-cost-of-capital", label: "Rates & credit" },
  { slug: "us-china-ai", label: "AI & semiconductors" },
  { slug: "energy-security-inflation", label: "Oil & energy" },
  { slug: "gold-reserve-diversification", label: "Gold" },
  { slug: "equity-rally-quality", label: "Equities" },
] as const;

export default function BlueDeskLearnExplorer({ concepts }: { concepts: Concept[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("en-GB");
    return concepts.filter((item) => (
      (category === "all" || item.regimes.some((r) => r.slug === category)) &&
      (!q || [
        item.label, item.definition, item.whyItMatters,
        ...item.aliases, ...item.watch, ...item.regimes.map((r) => r.label),
      ].some((part) => part.toLocaleLowerCase("en-GB").includes(q)))
    ));
  }, [category, concepts, query]);

  return <section aria-label="Market concepts" className={ui.library}>
    <div className={ui.tools}>
      <label className={ui.searchLabel} htmlFor="concept-search">Search terms and market topics</label>
      <input id="concept-search" className={ui.search} value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Try: CDS, real yields, crack spread, HBM…" type="search" />
      <nav className={ui.filters} aria-label="Filter glossary by market">
        {categories.map((item) => <button key={item.slug} type="button"
          aria-pressed={category === item.slug}
          className={category === item.slug ? ui.selected : ui.filter}
          onClick={() => setCategory(item.slug)}>{item.label}</button>)}
      </nav>
      <p className={ui.count} aria-live="polite">{filtered.length} of {concepts.length} concepts</p>
    </div>
    {filtered.length === 0 ? <div className={ui.empty}>
      <p>No matching glossary entry. Try another term or category.</p>
      <button onClick={() => { setQuery(""); setCategory("all"); }} type="button">Show all concepts</button>
    </div> : <div className={ui.grid}>
      {filtered.map((item) => <article key={item.key} id={item.key} className={ui.entry}>
        <h2>{item.label}</h2>
        <p className={ui.definition}>{item.definition}</p>
        <h3>Why traders follow it</h3>
        <p>{item.whyItMatters}</p>
        <h3>What to check</h3>
        <p>{item.watch.join(" · ")}</p>
        <footer>
          {item.regimes.map((r) => <span key={r.slug}>{r.label}</span>)}
        </footer>
      </article>)}
    </div>}
    <p className={ui.footnote}>Concepts explain market mechanisms. A term or indicator alone does not establish a market thesis; verify current readings, dates and sources before drawing a conclusion.</p>
  </section>;
}
