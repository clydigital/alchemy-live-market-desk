import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { isBluebellyReaderHost } from "@/lib/blue-desk-host";
import { getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { publicMarketObservations } from "@/lib/blue-desk-public-markets";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import PresenterTechnicalChecks from "@/components/live-desk/PresenterTechnicalChecks";
import PresenterChecksExplorer from "@/components/blue-desk/PresenterChecksExplorer";
import desk from "../blue-desk.module.css";
import ui from "./v6-studio.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Presenter Prep | Bluebelly",
  description: "Private, evidence-aware on-air talk preparation and technical × fundamental comparison.",
};
type Search = Record<string,string|string[]|undefined>;
type Props = {searchParams:Promise<Search>};
const FOCUS_KEYS = ["edition","story","motion","regime","event"] as const;
const EXACT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Forward only bounded, explicit source identities to the existing exact reader. */
function editionPinnedPrepHref(query:Search):string{
  const params = new URLSearchParams();
  for(const key of FOCUS_KEYS){
    const value=query[key];
    if(value===undefined)continue;
    if(typeof value !== "string" || !value.trim() || value.length>180 || /[\x00-\x1f\x7f]/.test(value))notFound();
    if(key==="edition" && !EXACT_UUID.test(value)) notFound();
    params.set(key, value);
  }
  const suffix=params.toString();
  return "/presenter/full-prep"+(suffix?"?"+suffix:"");
}
const LENSES=[
  {
    number:"01",title:"Dollar strength: does the chart agree with rate pricing?",
    question:"Compare DXY 4H and 1D EMA bands with US rates and JXY. Which market moved first?",
    show:"DXY 4H / 1D, JXY, US 2Y and 10Y, overseas rate differentials",
    challenge:"A DXY band break without a matching yield-spread move would challenge a rates-only explanation.",
  },
  {
    number:"02",title:"The yield curve and the Gold Idea",
    question:"Is a steeper 2Y–30Y curve driven by falling short yields or rising long yields? Those outcomes mean different things for gold.",
    show:"US 2Y / 30Y, 10Y real yield, gold with matched observation dates",
    challenge:"Gold's response can differ when the short end falls versus when long yields rise.",
  },
  {
    number:"03",title:"AI earnings versus possible equity rollover",
    question:"Supplier earnings and share-price leadership can diverge. Test the business outlook independently from SPX and SMH/QQQ charts.",
    show:"SPX log channel, SMH/QQQ, semiconductor guidance, HY credit and earnings revisions",
    challenge:"Do not claim a rollover or capital-spending reversal without dated price and company evidence.",
  },
];
export default async function BlueDeskPresenterStudio({searchParams}:Props){
  const query=await searchParams;
  const pinHref=editionPinnedPrepHref(query);
  const host=(await headers()).get("host")?.trim().toLowerCase().replace(/:443$/,"");
  const bluebelly=isBluebellyReaderHost(host);
  const prepRoot=bluebelly?"/presenter":"/blue-desk/presenter";
  const pinSuffix=pinHref.includes("?")?pinHref.slice(pinHref.indexOf("?")+1):"";
  const tabHref=(view:"talk"|"checks"|"source")=>prepRoot+"?view="+view+(pinSuffix?"&"+pinSuffix:"");
  const view=query.view==="checks"||query.view==="source"?query.view:"talk";
  const fullPrepHref=bluebelly ? pinHref : pinHref.replace("/presenter/full-prep","/blue-desk/presenter/full-prep");
  const editorialHref=(bluebelly?"/presenter/editorial":"/blue-desk/presenter/editorial")
    +(query.edition&&typeof query.edition==="string"?"?edition="+encodeURIComponent(query.edition):"");
  const dossierHref=bluebelly?"/presenter/dossier":"/blue-desk/dossier";
  const changesHref=bluebelly?"/presenter/changes":"/blue-desk/changes";
  const [rawMotions,monitor]=await Promise.all([
    getCurrentVerifiedMarketMotion({limit:18}).catch(()=>[]),
    getMarketMonitor().catch(()=>null),
  ]);
  const news=selectVerifiedNewsBriefs(rawMotions,new Date(),8);
  const readings=publicMarketObservations(monitor?.rows||[],"all")
    .filter(row=>["us2y","us10y-fred","us30y-fred","brent","wti","spx","dxy","gold-proxy","smh"].includes(row.id))
    .slice(0,9);

  return <main className={desk.page} data-blue-desk-presenter="private-owner" data-v6-presenter-view={view}>
    <BlueDeskHeader activePath="/blue-desk/presenter" />
    <div className={ui.content}>
      <div className={ui.privateStrip}>
        <div><strong>Private Presenter Studio</strong><span> · Bluebelly owner workspace · Source-admitted material only</span></div>
        <Link href={bluebelly?"/":"/blue-desk"}>← Return to Bluebelly</Link>
      </div>
      <header className={ui.studioHeader}>
        <div className={ui.headerCopy}>
          <span className={ui.kicker}>OWNER WORKSPACE / PRESENTER PREP</span>
          <h1>Prepare today's market talk.</h1>
          <p>A technical observation is one part of the argument. Compare it with the fundamental picture and explain the disagreement when the two point in different directions.</p>
        </div>
        <div className={ui.headerActions}>
          <Link className={ui.press} href={editorialHref}>COTD / OB editorial preview →</Link>
          <Link className={ui.pressStrong} href={fullPrepHref}>Exact-edition evidence ↗</Link>
        </div>
      </header>
      <nav className={ui.tabs} aria-label="Presenter Prep sections">
        {([
          ["talk","Today's talk"],
          ["checks","Technical checks"],
          ["source","Source & access"],
        ] as const).map(([id,title])=><Link key={id} href={tabHref(id)} aria-current={view===id?"page":undefined}
          className={view===id?ui.tabActive:ui.tab}>{title}</Link>)}
      </nav>

      {view==="talk"&&<>
        <section className={ui.briefIntro} data-presenter-fast-path="source-first">
          <span className={ui.kicker}>TALK OVERVIEW · RESEARCH QUESTIONS, NOT TRADING CALLS</span>
          <h2>Three connections worth testing before the stream.</h2>
          <p>Dollar and yield differentials, the curve's signal for gold, and AI supplier strength versus equity leadership. Start with the question, check your chart, then open the dated source. No chart direction is inferred from a headline.</p>
          <div className={ui.factStrip}><span>{news.length} verified news developments</span><span>{readings.length} source-dated market observations</span><span>14 private technical monitors</span><span>{query.edition?"Edition requested · exact match required":"No historical edition selected"}</span></div>
        </section>
        <div className={ui.briefLayout}>
          <div className={ui.talkStack}>
            <div className={ui.blockHeading}><span className={ui.kicker}>ON-AIR STORYLINE</span><h2>Three connections worth explaining</h2></div>
            {LENSES.map(lens=><article className={ui.talk} key={lens.number}>
              <div className={ui.talkTop}><span className={ui.talkNum}>{lens.number}</span><h3>{lens.title}</h3></div>
              <p>{lens.question}</p>
              <div className={ui.talkNote}><strong>Show on stream:</strong> {lens.show}</div>
              <p className={ui.challenge}><strong>Countercheck:</strong> {lens.challenge}</p>
            </article>)}
            <div className={ui.box}>
              <span className={ui.kicker}>IF THE MARKET DISAGREES</span>
              <h3>Do not force the technicals to match the thesis.</h3>
              <p>A divergence can be the talking point. Explain the mechanism, the observed market action and the missing check before making a stronger conclusion.</p>
              <Link className={ui.inlineLink} href={tabHref("checks")}>Open your actual 14 monitors →</Link>
            </div>
          </div>
          <aside className={ui.sideBox}>
            <section className={ui.box}>
              <span className={ui.kicker}>PRIVATE TECHNICAL MONITORS</span>
              <h2>14 <small>existing saved checklist</small></h2>
              <p className={ui.muted}>Cloud revision and dated readings are visible only after opening the owner technical panel. Initial defaults are not market evidence.</p>
              <Link className={ui.pressStrong} href={tabHref("checks")}>Inspect technical checks →</Link>
            </section>
            <section className={ui.box}>
              <span className={ui.kicker}>DATED MARKET OBSERVATIONS</span>
              {readings.length?readings.slice(0,6).map(row=><div className={ui.marketRow} key={row.id}>
                <strong>{row.label}</strong><span>{row.last===null?"Unavailable":row.last.toLocaleString("en-GB",{maximumFractionDigits:3})+(row.type==="Rates"?"%":"")}</span>
                <small><DualTimestamp value={row.asOf} sourceDate={row.asOf}/></small>
              </div>):<p className={ui.muted}>No dated publisher-qualified levels are currently available.</p>}
              <p className={ui.muted}>These levels do not establish causality or live chart conditions.</p>
            </section>
            <section className={ui.box}>
              <span className={ui.kicker}>LATEST VERIFIED REPORTING</span>
              {news.length?news.slice(0,4).map(item=><article className={ui.newsRow} key={item.id}>
                <strong>{item.headline}</strong>
                <small><DualTimestamp value={item.occurredAt} sourceDate={item.occurredAt}/></small>
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName} ↗</a>
              </article>):<p className={ui.muted}>No verified reports passed the freshness gate; this is not evidence of a quiet session.</p>}
              <Link className={ui.inlineLink} href={changesHref}>What changed in our view →</Link>
            </section>
          </aside>
        </div>
      </>}

      {view==="checks"&&<section aria-labelledby="technical-checklist-heading">
        <div className={ui.blockHeading}><span className={ui.kicker}>02 / TECHNICAL × FUNDAMENTALS</span>
          <h2 id="technical-checklist-heading">Reconcile your 14 monitors.</h2>
          <p>Choose a saved reading, review the source and read the challenge before presenting. Unverified defaults are never live market observations.</p></div>
        <PresenterChecksExplorer />
        <details className={ui.editDrawer}><summary>Update readings, attach charts and manage saved revisions ↓</summary>
          <PresenterTechnicalChecks compact />
        </details>
      </section>}

      {view==="source"&&<section aria-label="Source & access">
        <div className={ui.blockHeading}><span className={ui.kicker}>03 / SOURCE & ACCESS</span>
          <h2>The technical checklist stays private.</h2>
          <p>Saved presenter readings, notes and charts are never admitted as evidence merely because they appear beside research. Historical preparation must retain its exact edition and Dossier identity.</p></div>
        <div className={ui.briefLayout}>
          <div className={ui.box}>
            <span className={ui.kicker}>DATA BOUNDARY · EXISTING RUNTIME</span>
            <h3>Where each piece of information comes from</h3>
            <dl className={ui.ledger}>
              <div><dt>Verified news feed</dt><dd>{news.length} source-verified developments admitted from existing Market Motion records. These are factual reports, not canonical Story changes.</dd></div>
              <div><dt>Market-data adapter</dt><dd>{readings.length} publisher-dated observations from the existing public-market monitor. Stale or missing levels must retain their source dates.</dd></div>
              <div><dt>Technical source</dt><dd>Authenticated owner API · /api/presenter/technical-checks · technical-checks/3. Your saved chart readings are not public market evidence.</dd></div>
              <div><dt>Plugin and creator intelligence</dt><dd>External research/creator inputs belong in discovery and source verification first. No direct plugin-to-public Story publication or checklist overwrite is authorised.</dd></div>
              <div><dt>Learn</dt><dd>Governed concept registry for stable explanations; no current trade signals or private research intake.</dd></div>
              <div><dt>Authentication</dt><dd>Approved Google account + active Supabase allowlist</dd></div>
              <div><dt>Research identity</dt><dd>{query.edition&&typeof query.edition==="string"?query.edition:"No edition pinned · current available context only"}</dd></div>
              <div><dt>Reconciliation</dt><dd>Presenter explanation · non-evidentiary; no Story or Regime mutation</dd></div>
              <div><dt>Public Bluebelly</dt><dd>Publication-approved source projections only; no private technical revisions or notes</dd></div>
            </dl>
            <div className={ui.headerActions}><Link className={ui.pressStrong} href={fullPrepHref}>Inspect exact-edition source pack →</Link><Link className={ui.press} href={dossierHref}>Dossier history →</Link></div>
          </div>
          <aside className={ui.box}>
            <span className={ui.kicker}>SAFETY BOUNDARIES</span>
            {([
              ["No silent promotion","A technical note never becomes a verified catalyst or changes Regime confidence."],
              ["No accidental publication","Private chart links, notes and credentials must not enter the public reader."],
              ["Historical identity","An edition-pinned session must not silently substitute a current snapshot."],
              ["Fail closed","Missing sources or unauthorised requests show an unavailable state rather than invented facts."],
            ] as const).map(([h,p])=><article key={h} className={ui.boundary}><h3>{h}</h3><p>{p}</p></article>)}
          </aside>
        </div>
      </section>}
      <footer className={ui.footer}>Bluebelly owner-only preparation. Source dates belong to the publisher; technical readings and presenter questions do not modify canonical evidence, Stories, Regimes or immutable editions.</footer>
    </div>
  </main>;
}
