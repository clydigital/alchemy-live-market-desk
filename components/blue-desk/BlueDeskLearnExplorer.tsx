"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ui from "@/app/blue-desk/learn/learn.module.css";

type Concept = {
  key: string; label: string; definition: string; whyItMatters: string;
  aliases: string[]; regimes: string[];
};
type Category = "all" | "ai" | "rates" | "oil";
const SECTORS: Array<{key: Exclude<Category,"all">;title:string;desc:string;regime:string}> = [
  {key:"ai",title:"AI industry",desc:"Chips, cloud infrastructure and financing",regime:"us-china-ai"},
  {key:"rates",title:"Rates & bonds",desc:"The Fed, yields and credit",regime:"global-cost-of-capital"},
  {key:"oil",title:"Oil & energy",desc:"Production, shipping and inflation",regime:"energy-security-inflation"},
];
export default function BlueDeskLearnExplorer({concepts,storiesHref}:{concepts:Concept[];storiesHref:string}) {
  const [category,setCategory]=useState<Category>("all");
  const [query,setQuery]=useState("");
  const [open,setOpen]=useState<string[]>([]);
  const results=useMemo(()=>concepts.filter(c=>{
    const chosen=category==="all" || c.regimes.includes(SECTORS.find(s=>s.key===category)?.regime||"");
    const term=query.trim().toLowerCase();
    return chosen && (!term || [c.label,c.definition,c.whyItMatters,...c.aliases].some(v=>v.toLowerCase().includes(term)));
  }),[concepts,category,query]);
  const choose=(next:Category)=>{setCategory(next); document.getElementById("bluebelly-glossary")?.scrollIntoView({behavior:"smooth",block:"start"});};
  const toggle=(key:string)=>setOpen(p=>p.includes(key)?p.filter(x=>x!==key):[...p,key]);
  const active=SECTORS.find(s=>s.key===category);
  const faqs=SECTORS.map(s=>({s,items:concepts.filter(c=>c.regimes.includes(s.regime)).slice(0,3)}));
  return <div className={ui.content}>
    <header className={ui.hero}>
      <span className={ui.kicker}>BLUEBELLY / LEARN</span>
      <h1>Markets, explained.</h1>
      <p>Understand the language, companies and economic mechanisms behind the research. Start with a market, open the basic questions, then investigate the source-backed Story.</p>
    </header>

    <div className={ui.sectors} aria-label="Choose a market to learn">
      {SECTORS.map(s=><button type="button" key={s.key} onClick={()=>choose(s.key)}>
        <strong>{s.title}</strong><span>{s.desc}</span><em>Explore basics →</em>
      </button>)}
    </div>

    <section id="bluebelly-glossary" className={ui.block}>
      <div className={ui.heading}><div><span className={ui.kicker}>ALL MARKETS</span><h2>Search the glossary</h2></div><p>Plain-language definitions drawn from the governed Concept Library.</p></div>
      <div className={ui.tools}>
        <label htmlFor="learn-search">Find a keyword
          <input id="learn-search" type="search" value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="Try: HBM, spreads, capex, basis point…" />
        </label>
        <div className={ui.filters} role="group" aria-label="Filter glossary by market">
          {(["all","ai","rates","oil"] as const).map(k=><button type="button" key={k} aria-pressed={category===k}
            className={category===k?ui.active:""} onClick={()=>setCategory(k)}>{({all:"All",ai:"AI",rates:"Rates",oil:"Oil"})[k]}</button>)}
        </div>
      </div>
      <p className={ui.count}>{results.length} concepts {active?"in "+active.title.toLowerCase():"across all markets"}</p>
      <div className={ui.glossary}>
        {results.map(c=><article key={c.key} className={ui.concept}>
          <button type="button" aria-expanded={open.includes(c.key)} onClick={()=>toggle(c.key)}>
            <span><strong>{c.label}</strong><small>{c.regimes.map(slug=>slug.replaceAll("-"," ")).join(" · ")}</small></span>
            <span aria-hidden="true">{open.includes(c.key)?"−":"+"}</span>
          </button>
          {open.includes(c.key)&&<div className={ui.answer}><p>{c.definition}</p><p><strong>Why it matters: </strong>{c.whyItMatters}</p></div>}
        </article>)}
        {!results.length&&<div className={ui.empty}>No governed concepts match that search. Try a broader keyword or switch to All markets.</div>}
      </div>
    </section>
    <section className={ui.block} aria-label="Essential beginner questions">
      <div className={ui.heading}><div><span className={ui.kicker}>QUESTIONS</span><h2>Begin with the essentials</h2></div></div>
      <div className={ui.questionGrid}>
        {faqs.map(({s,items})=><section key={s.key} className={ui.questions}>
          <h3>{s.title}</h3>
          {items.map(c=><details key={c.key}><summary>What is {c.label.toLowerCase()}?</summary><p>{c.definition}</p><p>{c.whyItMatters}</p></details>)}
          <button type="button" onClick={()=>choose(s.key)}>Explore the {s.title.toLowerCase()} glossary →</button>
        </section>)}
      </div>
    </section>
    <div className={ui.end}>
      <p>Learn is educational context, not a current market signal. Dated observations, causal claims and Regime judgements must be checked in the published research.</p>
      <Link href={storiesHref}>Explore current market Stories →</Link>
    </div>
  </div>;
}
