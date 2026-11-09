import CurrentMarketUpdates from "@/components/blue-desk/CurrentMarketUpdates";
import Link from "next/link";
import ReaderPagination from "@/components/blue-desk/ReaderPagination";
import {EditorialUpdatedToday} from "@/components/blue-desk/CurrentMarketUpdates";
import {paginateReaderItems} from "@/lib/bluebelly-reader-pagination";
import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import {PUBLIC_RESEARCH_CATEGORIES,selectPublicResearch} from "@/lib/bluebelly-public-research-library";
import layout from "../blue-desk.module.css";
import ui from "./research.module.css";

export const metadata={
  title:"Research | Bluebelly",
  description:"Dated, source-linked manually researched markets features and editorial investigations.",
};
export const dynamic="force-dynamic";

type SearchParams={q?:string|string[];category?:string|string[];page?:string|string[]};
function selected(value:string|string[]|undefined):string{
  return typeof value==="string"?value.slice(0,100):"";
}

export default async function PublicResearchPage({
 searchParams,
}:{searchParams?:Promise<SearchParams>}){
 const host=(await headers()).get("host");
 const params=(await searchParams)||{};
 const q=selected(params.q);
 const category=selected(params.category);
 const active=PUBLIC_RESEARCH_CATEGORIES.some(x=>x===category)?category:"All";
 const results=selectPublicResearch(q,active);
 const page=paginateReaderItems(results,typeof params.page==="string"?params.page:undefined,6);
 const href=blueDeskPublicHref("/blue-desk/research",host);
 const categoryHref=(name:string)=>{
   const query=new URLSearchParams();
   if(q.trim())query.set("q",q.trim());
   if(name!=="All")query.set("category",name);
   return href+(query.size?"?"+query.toString():"");
 };
 const pageHref=(number:number)=>{
   const query=new URLSearchParams();
   if(q.trim())query.set("q",q.trim());
   if(active!=="All")query.set("category",active);
   if(number>1)query.set("page",String(number));
   return href+(query.size?"?"+query.toString():"")+"#research-results";
 };
 return <main className={layout.page} data-bluebelly-research-index="public-approved-dated">
   <BlueDeskHeader activePath="/blue-desk/research"/>
   <div className={layout.content}>
     <header className={ui.hero} data-v7-research-command="dated-archive">
       <div>
         <p className={ui.eyebrow}>BLUEBELLY / INVESTIGATIONS</p>
         <h1>Research<span>.</span></h1>
         <p className={ui.intro}>The deeper work behind the headlines. Read the original thesis, the evidence and what could prove it wrong — without mistaking an older investigation for today's market news.</p>
       </div>
       <div className={ui.heroMeta}>
         <strong>Dated, not frozen in the homepage.</strong>
         <p>Each article retains its original research date. Fresh announcements and live market changes belong in the <Link href={blueDeskPublicHref("/blue-desk/newsroom",host)}>Newsroom</Link>.</p>
       </div>
     </header>

     <section className={ui.controls} aria-label="Find research">
       <form className={ui.search} action={href} method="get" role="search">
         <label htmlFor="public-research-search">Search investigations</label>
         <div className={ui.searchRow}>
           <input id="public-research-search" type="search" name="q" maxLength={100}
             defaultValue={q} placeholder="Search AI, the Fed, bonds, oil..." />
           {active!=="All"?<input type="hidden" name="category" value={active}/>:null}
           <button type="submit">Search</button>
         </div>
       </form>
       <nav className={ui.categories} aria-label="Research categories">
         {PUBLIC_RESEARCH_CATEGORIES.map(name=>
           <Link key={name} href={categoryHref(name)} aria-current={active===name?"page":undefined}
             className={active===name?ui.categoryActive:ui.category}>{name}</Link>)}
       </nav>
     </section>

     <div className={ui.listHeading} id="research-results">
       <div><h2>Source-linked investigations</h2>
       <p>{results.length?`Showing ${page.firstItem}–${page.lastItem} of ${page.totalItems}`:"No matching editions"} · Most recent research first</p></div>
       {q||active!=="All"?<Link href={href}>Clear filters</Link>:null}
     </div>
     {results.length?<div className={ui.grid}>
       {page.items.map(item=><article className={ui.card} key={item.id} data-research-edition={item.id}>
          <p className={ui.cardTop}>{item.category}<span>{item.type}</span><EditorialUpdatedToday initialPublishedOn={item.asOf} editorialUpdatedAt={item.editorialUpdatedAt} now={new Date()}/></p>
          <h3><Link href={blueDeskPublicHref("/blue-desk"+item.href,host)}>{item.title}</Link></h3>
          <p className={ui.summary}>{item.summary}</p>
          <p className={ui.context}>{item.context}</p>
          <footer>
            <span>Research as of <time dateTime={item.asOf}>{new Date(item.asOf+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})}</time></span>
            <Link href={blueDeskPublicHref("/blue-desk"+item.href,host)}>Read investigation <span aria-hidden>→</span></Link>
          </footer>
       </article>)}
     </div>:<div className={ui.empty}>
       <h3>No published research matches these filters.</h3>
       <p>Private drafts and research leads are not displayed here. Change the search or browse all investigations.</p>
       <Link href={href}>View all research</Link>
     </div>}
     <ReaderPagination label="Research Library" page={page.page} totalPages={page.totalPages}
       totalItems={page.totalItems} firstItem={page.firstItem} lastItem={page.lastItem}
       getHref={pageHref}/>
     <details className={ui.editionContext} data-research-editorial="archived-secondary">
       <summary>Source-dated editorial context · expand earlier reports</summary>
       <CurrentMarketUpdates host={host} mode="compact"/>
     </details>
     <footer className={ui.bottom}>
       <div>
         <h2>Keeping the record straight</h2>
         <p>Published features are dated editorial interpretations, not automatically updated market data or canonical Dossier verdicts. Original evidence and limitations remain inside each article. A new qualified event earns a fresh Newsroom item; it does not rewrite this older edition.</p>
       </div>
       <div>
         <strong>Private research</strong>
         <p>MacroPulse investigations, creator notes, presenter checks and unpublished OB/COTD drafts remain owner-only.</p>
         <Link href="/owner/research">Open owner Research Library ↗</Link>
       </div>
     </footer>
   </div>
 </main>;
}
