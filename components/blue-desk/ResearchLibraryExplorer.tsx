"use client";

import { useMemo, useState } from "react";
import type { NotionResearchBundle } from "@/lib/notion-market-research";
import { EntityMark } from "./EntityIdentity";
import type { EntityIdentity } from "@/lib/bluebelly-entity-identity";
import styles from "@/app/owner/research/research.module.css";

type Section = "All" | "Latest" | "Themes" | "Gaps" | "Archives";
type ResearchEntry = {
  id: string;
  title: string;
  description: string;
  section: Exclude<Section, "All">;
  discipline: string;
  href: string;
  provenance: string;
  updated?: string;
  quality: string;
};

const COLLECTIONS: ResearchEntry[] = [
  {id:"pulse-26",title:"26 October — full MacroPulse archive",section:"Archives",discipline:"Daily research",
   description:"Every source-qualified two-hour post from 26 October. Read individual original posts and their source timestamps.",href:"https://app.notion.com/p/404519b67a94815197cbcf21b9a19a8a",
   provenance:"Notion · dated full posts",quality:"Research archive",updated:"2026-10-26"},
  {id:"reader-index",title:"Research Library — 26 October market map",section:"Archives",discipline:"Research briefing",
   description:"The dated 26 October index of oil, US rates, Europe credit, FX, AI and the next deciding tests. Updated separately from recurring research posts.",
   href:"https://app.notion.com/p/405519b67a9481738bdacc9dae6e8589",provenance:"Notion · curated navigation",quality:"Research synthesis",updated:"2026-10-26"},
  {id:"rates",title:"US Rate Regime and macro transmission",section:"Themes",discipline:"Rates / FX",
   description:"Treasury yields, the 2Y–30Y curve, Fed decisions, real rates, DXY and JXY. Check source vintage before reading an asset reaction.",
   href:"https://app.notion.com/p/404519b67a94815197cbcf21b9a19a8a",provenance:"MacroPulse · relevant posts",quality:"Topic pathway"},
  {id:"energy",title:"Hormuz, Brent, diesel and LNG",section:"Themes",discipline:"Energy / geopolitical",
   description:"Physical disruption, shipping observations, refinery bottlenecks, inflation, Saudi logistics and the diplomacy countercase.",
   href:"https://app.notion.com/p/405519b67a94815392fed24b0f2bb6be",provenance:"26 Oct MacroPulse 20:00 MYT",quality:"Topic pathway"},
  {id:"europe",title:"European credit and GBP / EUR",section:"Themes",discipline:"European macro / FX",
   description:"ECB lending conditions, fiscal pressures, sterling and gilts, with counterarguments and next observable tests.",
   href:"https://app.notion.com/p/405519b67a94815392fed24b0f2bb6be",provenance:"26 Oct MacroPulse 20:00 MYT",quality:"Topic pathway"},
  {id:"ai",title:"AI Infrastructure — 16-company tracker",section:"Themes",discipline:"AI / equity / credit",
   description:"Issuer cash flows, capex, financing, chip demand and competing bubble-versus-healthy-investment explanations.",
   href:"https://app.notion.com/p/3f4519b67a9481639302eee63384c180",provenance:"Notion · issuer-linked research",quality:"16 company research pages"},
  {id:"framework",title:"Expectations, vulnerabilities and causal tests",section:"Themes",discipline:"Research method",
   description:"How to separate what is already priced, what changed, what investors expected and which data can invalidate a thesis.",
   href:"https://app.notion.com/p/3f5519b67a9481f8beadd329b3732f22",provenance:"Market Intelligence Organiser",quality:"Learning framework"},
  {id:"gap-registry",title:"Research Gap Registry",section:"Gaps",discipline:"Open questions",
   description:"Persistent, deduplicated questions and the minimum evidence needed to distinguish competing market explanations.",
   href:"https://app.notion.com/p/f0eb01304c684dce95696f32671dc55a",provenance:"Notion · Research Gap",quality:"Investigation queue"},
  {id:"gap-runs",title:"Research Gap Runs",section:"Gaps",discipline:"Investigations",
   description:"Actual research gate windows, decisions, unresolved provenance and handoffs. A delivered lead is not canonical evidence.",
   href:"https://app.notion.com/p/3489f73be6f8476bb8baf5eb9ed150de",provenance:"Notion · Gate archive",quality:"Dated research runs"},
  {id:"pulse-log",title:"MacroPulse Feed / Log",section:"Archives",discipline:"Research history",
   description:"Canonical index of published and skipped slots. Useful for source coverage, deduplication and chronological research retrieval.",
   href:"https://app.notion.com/p/851feb425fe24a6abee0458f21d6c755",provenance:"Notion · publication log",quality:"Research ledger"},
  {id:"pulse-root",title:"MacroPulse",section:"Archives",discipline:"Research history",
   description:"Open the full day-by-day source research hierarchy rather than a compressed public summary.",
   href:"https://app.notion.com/p/3ea519b67a948161ba4dec8f97ebf658",provenance:"Notion · full archive",quality:"Historical sources"},
  {id:"organiser",title:"Market Intelligence — Organiser",section:"Archives",discipline:"Research operations",
   description:"Research ownership, information flow, claim admission and the handoff into canonical Dossier and Hybrid systems.",
   href:"https://app.notion.com/p/3f3519b67a9481a0993be57443f9362f",provenance:"Notion · research operations",quality:"Reference"},
];
// Only explicitly curated topic rows receive fixed visual identities.
const CURATED_MARKS:Readonly<Record<string,EntityIdentity>> = {
  rates:{kind:"country",code:"US"}, energy:{kind:"asset",code:"BRENT"},
  europe:{kind:"country",code:"EU"}, ai:{kind:"asset",code:"AI"},
};
const SECTIONS: Section[] = ["All","Latest","Themes","Gaps","Archives"];

function shortText(text:string,max=320){
  const trimmed=text.replace(/\s+/g," ").trim();
  return trimmed.length>max ? trimmed.slice(0,max).replace(/\s+\S*$/,"")+"…" : trimmed;
}
function safeDate(iso?:string) {
  if(!iso || Number.isNaN(Date.parse(iso)))return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric",
    timeZone:"Asia/Kuala_Lumpur"}).format(new Date(iso));
}
export default function ResearchLibraryExplorer({intake}:{intake:NotionResearchBundle}) {
  const [term,setTerm]=useState("");
  const [section,setSection]=useState<Section>("All");
  const [sort,setSort]=useState<"curated"|"title">("curated");
  const recent:ResearchEntry[]=useMemo(()=>intake.sources.map(source=>({
    id:source.pageId,title:source.title,description:shortText(source.text),
    section:"Latest" as const,discipline:source.kind==="MACROPULSE"?"MacroPulse":"Research Gap",
    href:source.url,provenance:"Notion · retrieved source page",
    updated:source.retrievedAt,quality:"Research input · not canonical",
  })),[intake.sources]);
  const results = useMemo(()=>{
    const needle=term.trim().toLocaleLowerCase("en-GB");
    const entries=[...recent,...COLLECTIONS].filter(entry=>
      (section==="All"||entry.section===section) &&
      (!needle || [entry.title,entry.description,entry.discipline,entry.provenance,entry.quality]
        .some(value=>value.toLocaleLowerCase("en-GB").includes(needle)))
    );
    return sort==="title"?entries.sort((a,b)=>a.title.localeCompare(b.title)):entries;
  },[term,section,sort,recent]);

  return <div className={styles.shell}>
    <header className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>OWNER WORKSPACE / SOURCED RESEARCH</p>
        <h1>Research Library<span>.</span></h1>
        <p className={styles.intro}>Find the original work behind the market view — the latest research,
          longer-running themes, open questions and dated source records. One place to start, without
          flattening every source into the same level of authority.</p>
        <div className={styles.actionRow}>
          <a className={styles.primary} href="https://app.notion.com/p/405519b67a9481738bdacc9dae6e8589" target="_blank" rel="noopener noreferrer">Open 26 October market map ↗</a>
          <a href="https://app.notion.com/p/3ea519b67a9481d0910ff8d54c5b40b3" target="_blank" rel="noopener noreferrer">Full Financial Research workspace ↗</a>
        </div>
      </div>
      <aside className={styles.status}>
        <p className={styles.eyebrow}>TODAY'S RESEARCH INTAKE</p>
        <strong>{intake.sources.length} <span>source pages retrieved</span></strong>
        <p className={styles.statusText}>Notion reader: {intake.status.replaceAll("_"," ").toLowerCase()}</p>
        <p className={styles.small}>Checked {safeDate(intake.fetchedAt)} · The full archive is reached through the links below. The search covers the visible index and recent retrieved page previews, not every archived paragraph.</p>
        {intake.warnings.length>0 && <details><summary>Coverage limitations ({intake.warnings.length})</summary>
          <ul>{intake.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>}
      </aside>
    </header>

    <section className={styles.toolbar} aria-label="Find research">
      <label className={styles.searchLabel} htmlFor="research-search">Search research
        <input id="research-search" type="search" value={term} onChange={e=>setTerm(e.target.value)}
          placeholder="Try Brent, yields, AI, credit, research gaps…" />
      </label>
      <label className={styles.sortLabel} htmlFor="research-sort">Sort
        <select id="research-sort" value={sort} onChange={e=>setSort(e.target.value as "curated"|"title")}>
          <option value="curated">Recommended</option><option value="title">Title A–Z</option>
        </select>
      </label>
      <div className={styles.filters} role="group" aria-label="Research collection">
        {SECTIONS.map(item=><button key={item} type="button" aria-pressed={section===item}
          className={section===item?styles.active:""} onClick={()=>setSection(item)}>{item}</button>)}
      </div>
    </section>

    <div className={styles.resultsHead}>
      <div><p className={styles.eyebrow}>RESEARCH INDEX</p>
      <h2>{section==="All"?"Explore the library":section}</h2></div>
      <span role="status">{results.length} matching entries</span>
    </div>
    {results.length ? <div className={styles.results}>
      {results.map(entry=><article key={entry.id} className={styles.item}>
        <div className={styles.itemTop}><span className={styles.category}>{entry.discipline}</span>
          <span className={styles.quality}>{entry.quality}</span></div>
        <h3>{CURATED_MARKS[entry.id]?<EntityMark kind={CURATED_MARKS[entry.id].kind} code={CURATED_MARKS[entry.id].code} size="sm"/>:null}{" "}<a href={entry.href} target="_blank" rel="noopener noreferrer">{entry.title}</a></h3>
        <p>{entry.description || "Full original research available at the linked source."}</p>
        <div className={styles.itemFoot}><span>{entry.provenance}{entry.updated?" · "+safeDate(entry.updated):""}</span>
          <a href={entry.href} target="_blank" rel="noopener noreferrer" aria-label={"Open "+entry.title+" in Notion"}>Read source ↗</a></div>
      </article>)}
    </div> : <div className={styles.noResults}>
      <h3>No matching items in this index</h3>
      <p>Searches do not index all historical Notion content. Try another topic or open the full archive.</p>
      <button type="button" onClick={()=>{setTerm("");setSection("All");}}>Clear filters</button>
    </div>}
    <footer className={styles.footer}>
      <strong>Research is not a Dossier decision.</strong> Original-source observations, research explanations,
      unresolved questions and canonical System 2 thesis updates have separate authority. Historical records
      remain dated. No scheduled task, Story writer or private technical checklist was changed.
    </footer>
  </div>;
}
