"use client";

import { useEffect, useMemo, useState } from "react";
import ui from "@/app/blue-desk/learn/learn.module.css";
import type { LearnConcept as RegistryLearnConcept } from "@/lib/bluebelly-learn-glossary";
type LearnConcept = Omit<RegistryLearnConcept,"regimes"> & {regimes:{slug:string;label:string}[]};

const categories = [
  { slug:"all",label:"All terms",code:"00" },
  { slug:"foundations",label:"The basics",code:"01" },
  { slug:"rates",label:"Rates & bonds",code:"02" },
  { slug:"companies",label:"AI & companies",code:"03" },
  { slug:"energy",label:"Oil & energy",code:"04" },
  { slug:"fx",label:"Currencies",code:"05" },
  { slug:"trading",label:"Charts & risk",code:"06" },
  { slug:"equities",label:"Equities",code:"07" },
  { slug:"gold",label:"Gold",code:"08" },
] as const;

const regimeByCategory: Record<string,string> = {
  rates:"global-cost-of-capital",
  companies:"us-china-ai",
  energy:"energy-security-inflation",
  equities:"equity-rally-quality",
  gold:"gold-reserve-diversification",
};

function inCategory(item: LearnConcept, category: string) {
  return category==="all" || item.topic===category ||
    item.regimes.some((r) => r.slug===regimeByCategory[category]);
}

function termGroup(item: LearnConcept) {
  if(item.topic==="regime") return item.regimes[0]?.label || "Market mechanics";
  return ({
    foundations:"Market foundations",rates:"Rates & bonds",
    companies:"Companies & AI",energy:"Oil & energy",
    fx:"Foreign exchange",trading:"Trading & risk",
  } as Record<string,string>)[item.topic] || "Market mechanics";
}

export default function BlueDeskLearnExplorer({concepts}:{concepts:LearnConcept[]}) {
  const [query,setQuery] = useState("");
  const [category,setCategory] = useState<string>("all");
  const [selectedKey,setSelectedKey] = useState("");
  const [visibleCount,setVisibleCount] = useState(18);

  useEffect(()=>{
    const key=decodeURIComponent(window.location.hash.slice(1));
    if(!key || !concepts.some((item)=>item.key===key)) return;
    setSelectedKey(key);
    const position=concepts.findIndex((item)=>item.key===key);
    if(position>=18) setVisibleCount(Math.max(18,position+1));
  },[concepts]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase("en-GB");
    return concepts.filter((item)=>inCategory(item,category) && (!q || [
      item.label,item.definition,item.whyItMatters,item.example || "",
      ...item.aliases,...item.watch,...item.regimes.map((r)=>r.label),
    ].some((part)=>part.toLocaleLowerCase("en-GB").includes(q))));
  },[category,concepts,query]);

  const selected=filtered.find((item)=>item.key===selectedKey) || filtered[0];
  const shown=filtered.slice(0,visibleCount);

  return <section aria-label="Market concepts" className={ui.library} data-glossary-mode="field-manual">
    <div className={ui.tools}>
      <div className={ui.searchHead}>
        <div>
          <p className={ui.terminalLabel}>REFERENCE TERMINAL / INDEX 01</p>
          <label className={ui.searchLabel} htmlFor="concept-search">Find the missing piece</label>
        </div>
        <span className={ui.terminalTotal}>{concepts.length.toString().padStart(2,"0")} ENTRIES</span>
      </div>
      <div className={ui.searchLine}>
        <span aria-hidden="true" className={ui.searchSymbol}>⌕</span>
        <input id="concept-search" className={ui.search} value={query}
          onChange={(event)=>{setQuery(event.target.value);setVisibleCount(18);}}
          placeholder="Search a term, indicator or market question…" type="search"/>
        {query && <button className={ui.clearSearch} type="button" onClick={()=>setQuery("")}>Clear</button>}
      </div>
      <nav className={ui.filters} aria-label="Filter glossary by market">
        {categories.map((item)=><button key={item.slug} type="button"
          aria-pressed={category===item.slug}
          className={category===item.slug ? ui.selected : ui.filter}
          onClick={()=>{setCategory(item.slug);setVisibleCount(18);}}>
          <span aria-hidden="true">{item.code}</span>{item.label}
        </button>)}
      </nav>
      <p className={ui.count} aria-live="polite">DISPLAYING {filtered.length} / {concepts.length} DEFINITIONS — SELECT AN ENTRY TO INSPECT</p>
    </div>

    {filtered.length===0 ? <div className={ui.empty}>
      <p>No matching term. Try a broader keyword or explore all categories.</p>
      <button onClick={()=>{setQuery("");setCategory("all");setVisibleCount(18);}} type="button">Reset glossary</button>
    </div> : <div className={ui.glossaryWorkspace}>
      <div className={ui.indexPane}>
        <div className={ui.paneHeading}><span>01 / CONCEPT INDEX</span><span>ALPHABETICAL</span></div>
        <div className={ui.grid}>
          {shown.map((item,index)=><article key={item.key} id={item.key}
            className={ui.entry} data-active={selected?.key===item.key ? "true" : "false"}>
            <button type="button" className={ui.entryButton}
              aria-pressed={selected?.key===item.key} onClick={()=>{setSelectedKey(item.key);if(window.matchMedia("(max-width:760px)").matches) document.getElementById("concept-focus")?.scrollIntoView({behavior:"smooth",block:"start"});}}>
              <span className={ui.entryNumber}>{String(index+1).padStart(2,"0")}</span>
              <span className={ui.entryCopy}>
                <strong>{item.label}</strong><small>{termGroup(item)}</small>
              </span>
              <span className={ui.entryArrow} aria-hidden="true">↗</span>
            </button>
          </article>)}
        </div>
        {filtered.length>visibleCount && <button type="button" className={ui.loadMore}
          onClick={()=>setVisibleCount((n)=>n+18)}>LOAD MORE DEFINITIONS <span>+{Math.min(18,filtered.length-visibleCount)}</span></button>}
      </div>

      <article className={ui.focusPane} id="concept-focus" aria-live="polite" aria-atomic="true">
        <div className={ui.paneHeading}><span>02 / TERM BREAKDOWN</span><span>LEARNING FILE</span></div>
        {selected && <>
          <div className={ui.focusBody}>
            <span className={ui.focusCode}>BLUEBELLY / {selected.topic==="regime"?"MARKET REFERENCE":"LEARNING EXTENSION"}</span>
            <h3>{selected.label}</h3>
            <div className={ui.focusBlock}>
              <span className={ui.focusLabel}>THE SIMPLE EXPLANATION</span>
              <p className={ui.focusDefinition}>{selected.definition}</p>
            </div>
            {selected.example && <div className={ui.exampleBlock}>
              <span className={ui.focusLabel}>EXAMPLE / MAKE IT REAL</span>
              <p>{selected.example}</p>
            </div>}
            <div className={ui.focusBlock}>
              <span className={ui.focusLabel}>WHY YOU WOULD CARE</span>
              <p>{selected.whyItMatters}</p>
            </div>
            <div className={ui.focusBlock}>
              <span className={ui.focusLabel}>WHAT TO CHECK ON THE MARKET</span>
              <p>{selected.watch.join(" · ")}</p>
            </div>
            {selected.regimes.length>0 && <div className={ui.relatedLabels}>
              {selected.regimes.map((r)=><span key={r.slug}>{r.label}</span>)}
            </div>}
          </div>
          <a href={"#"+selected.key} className={ui.termPermalink}>JUMP TO THIS TERM / PERMALINK ↗</a>
        </>}
      </article>
    </div>}
    <p className={ui.footnote}>The 28 governed Regime concepts retain their original research definitions. Additional Learn-only concepts are educational explanations, not live readings, forecasts or approved changes to market theses. Verify the instrument, time and source before trading.</p>
  </section>;
}
