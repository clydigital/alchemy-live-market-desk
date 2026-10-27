"use client";

import { useMemo, useState } from "react";
import type { CatalystCard, CatalystLane } from "@/lib/bluebelly-catalyst-calendar";
import styles from "./CatalystCalendar.module.css";
import { EntityMark } from "./EntityIdentity";

type DisplayZone = "UTC" | "Asia/Kuala_Lumpur";
type ViewMode = "week" | "agenda";
const LABELS:Record<CatalystLane,string> = {
  macro:"Macro",fed:"Fed",diplomacy:"Peace & geopolitics",earnings:"Earnings",
  technology:"Big Tech & AI",energy:"Energy",other:"Other",
};
const FILTERS:{id:CatalystLane|"all";label:string}[] = [
  {id:"all",label:"All catalysts"},{id:"macro",label:"Macro"},{id:"fed",label:"Fed speakers"},
  {id:"diplomacy",label:"Peace talks"},{id:"earnings",label:"Earnings"},
  {id:"technology",label:"Tech & AI"},{id:"energy",label:"Energy"},
];
function Logo({ticker,country}:{ticker:string|null;country:string|null}) {
  return ticker ? <EntityMark kind="company" code={ticker}/> :
    country ? <EntityMark kind="country" code={country}/> :
      <EntityMark kind="asset" code="GLOBAL" label="Multi-country catalyst"/>;
}
function dayInZone(item:CatalystCard,zone:DisplayZone){
  if(!item.startAt) return item.date;
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(item.startAt));
  const value=(kind:string)=>parts.find(part=>part.type===kind)?.value||"";
  return value("year")+"-"+value("month")+"-"+value("day");
}
function displayClock(item:CatalystCard,zone:DisplayZone) {
  if(!item.startAt) return item.date?"Date only · time TBC":"Timing not established";
  const formatted=new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(item.startAt));
  return formatted+" "+(zone==="UTC"?"UTC":"MYT");
}
function mondayOf(iso:string){
  const d=new Date(iso.slice(0,10)+"T12:00:00Z");
  const n=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-n);return d;
}
function ymd(d:Date){return d.toISOString().slice(0,10)}
function fmtDay(d:Date){return new Intl.DateTimeFormat("en-GB",{timeZone:"UTC",weekday:"short",day:"numeric",month:"short"}).format(d)}
function plusDays(d:Date,n:number){const c=new Date(d);c.setUTCDate(c.getUTCDate()+n);return c}
function EventTile({item,selected,onChoose,zone}:{item:CatalystCard;selected:boolean;onChoose:()=>void;zone:DisplayZone}){
  return <button type="button" onClick={onChoose} aria-pressed={selected}
    className={[styles.eventTile,styles["lane_"+item.lane],selected?styles.selected:"",item.priority==="must_watch"?styles.priority:""].join(" ")}>
    <span className={styles.tileTop}><span className={styles.typeLabel}>{LABELS[item.lane]}</span>
      <span className={styles.certainty}>{item.certainty==="official"?"Verified source":item.certainty==="reported"?"Reported": "Desk source"}</span></span>
    <span className={styles.tileMid}><Logo ticker={item.ticker} country={item.country} />
      <span className={styles.nameBlock}><strong>{item.title}</strong>
        <span>{item.ticker||item.country||"Multi-party"}</span></span></span>
    <span className={styles.tileFoot}><span>{item.callTimeOnly?"Earnings call · ":""}{displayClock(item,zone)}</span>
      <span className={item.priority==="must_watch"?styles.high:styles.normal}>{item.priority==="must_watch"?"High focus":"Watch"}</span></span>
  </button>;
}
function EventDetail({item,zone}:{item:CatalystCard|null;zone:DisplayZone}){
  return <aside className={styles.inspector} aria-label="Catalyst details" data-catalyst-inspector>
    <div className={styles.panelHead}><strong>Event briefing</strong><span>{item?LABELS[item.lane]:"Select a tile"}</span></div>
    {!item?<p className={styles.unknown}>Select an event to see its source, timing and market implications.</p>:
      <div className={styles.detailBody}>
        <div className={styles.detailMark}><Logo ticker={item.ticker} country={item.country}/><span className={styles.detailCategory}>{LABELS[item.lane]}</span></div>
        <h3>{item.title}</h3>
        <div className={styles.detailBadges}>
          <span>{item.certainty==="official"?"Original-source record":item.certainty+" source"}</span>
          <span>{item.signalOnly?"Monitoring lead":item.callTimeOnly?"Call time · not release":item.timePrecision==="exact"?"Confirmed instant":item.date?"Confirmed/reported date":"Date TBC"}</span>
        </div>
        <dl className={styles.facts}>
          <div><dt>When</dt><dd>{item.date||"Unscheduled"}{item.startAt?" · "+(item.callTimeOnly?"Earnings call at ":"")+displayClock(item,zone):" · time not verified"}</dd></div>
          <div><dt>Watch</dt><dd>{item.affectedAssets.length?item.affectedAssets.map(a=>item.country==="DE"?"DAX":a).join(" · "):"Pending market assessment"}</dd></div>
          <div><dt>Status</dt><dd>{item.status}</dd></div>
        </dl>
        <h4>Why it matters</h4><p>{item.why}</p>
        {item.signalOnly?<p className={styles.radarCaution}>Source activity is not proof that a meeting is scheduled. We will not assign it an invented date or hour.</p>:null}
        {item.callTimeOnly?<p className={styles.radarCaution}>This is the confirmed earnings-call time. The financial results may be released earlier; their publication time has not been established by this event.</p>:null}
        <a className={styles.sourceLink} href={item.sourceUrl} target="_blank" rel="noreferrer">
          Open original source ↗
        </a><small className={styles.sourceName}>{item.sourceName}</small>
      </div>}
  </aside>;
}
export default function CatalystCalendar({items,sourceCoverage,nowISO}:{
  items:CatalystCard[];sourceCoverage:{name:string;state:string;detail:string}[];nowISO:string;
}){
  const [lane,setLane]=useState<CatalystLane|"all">("all");
  const [q,setQ]=useState("");const [focus,setFocus]=useState(false);
  const [weekShift,setWeekShift]=useState(0);const [zone,setZone]=useState<DisplayZone>("UTC");
  const [view,setView]=useState<ViewMode>("week");const [selectedId,setSelectedId]=useState<string|null>(null);
  const start=useMemo(()=>plusDays(mondayOf(nowISO),weekShift*7),[nowISO,weekShift]);
  const week=useMemo(()=>Array.from({length:7},(_,i)=>({day:ymd(plusDays(start,i)),date:plusDays(start,i)})),[start]);
  const filtered=useMemo(()=>items.filter(item=>
    (lane==="all"||item.lane===lane)&&(!focus||item.priority==="must_watch")
    &&(item.title+" "+item.ticker+" "+item.sourceName+" "+item.affectedAssets.join(" ")).toLowerCase().includes(q.toLowerCase())
  ),[items,lane,focus,q]);
  const scheduled=filtered.filter(item=>item.date&&week.some(day=>day.day===dayInZone(item,zone)));
  const leads=filtered.filter(item=>item.signalOnly).slice(0,12);
  const details=filtered.find(item=>item.id===selectedId)||scheduled[0]||leads[0]||null;
  const unavailable=sourceCoverage.filter(s=>s.state==="unavailable");
  const notConfigured=sourceCoverage.filter(s=>s.state==="not_configured");
  const stale=sourceCoverage.filter(s=>s.state==="stale");
  const sourceBlocked=[...unavailable,...stale,...notConfigured];
  const weekend=week.slice(5);
  const counts={all:items.length,macro:items.filter(x=>x.lane==="macro").length,
    fed:items.filter(x=>x.lane==="fed").length,diplomacy:items.filter(x=>x.lane==="diplomacy").length,
    earnings:items.filter(x=>x.lane==="earnings").length,technology:items.filter(x=>x.lane==="technology").length,
    energy:items.filter(x=>x.lane==="energy").length,other:0};
  function dayCards(day:string){
    const dayItems=scheduled.filter(e=>dayInZone(e,zone)===day);
    return dayItems.length?dayItems.map(e=><EventTile key={e.id} item={e} selected={details?.id===e.id}
      zone={zone} onChoose={()=>setSelectedId(e.id)}/>)
      :<span className={styles.emptyDay}>No sourced events in this view</span>;
  }
  return <section className={styles.root} data-catalyst-calendar="v4">
    <div className={styles.header}>
      <div><span className={styles.kicker}>BLUEBELLY / CATALYST RADAR</span>
        <h2>The market week, at a glance.</h2>
        <p>Official macro releases plus Fed appearances, peace negotiations, earnings follow-ups and big-tech catalysts.</p>
      </div>
      <div className={styles.dateNav}>
        <button type="button" onClick={()=>setWeekShift(v=>v-1)} aria-label="Previous week">‹</button>
        <strong>{fmtDay(week[0].date)} – {fmtDay(week[6].date)}</strong>
        <button type="button" onClick={()=>setWeekShift(v=>v+1)} aria-label="Next week">›</button>
        <button className={styles.thisWeek} type="button" onClick={()=>setWeekShift(0)}>This week</button>
      </div>
    </div>
    <nav className={styles.filters} aria-label="Catalyst categories">
      {FILTERS.map(f=><button key={f.id} type="button" aria-pressed={lane===f.id}
        onClick={()=>setLane(f.id)}>{f.label}<small>{counts[f.id]}</small></button>)}
    </nav>
    <div className={styles.controls}>
      <div className={styles.views}><button type="button" aria-pressed={view==="week"} onClick={()=>setView("week")}>Week board</button>
        <button type="button" aria-pressed={view==="agenda"} onClick={()=>setView("agenda")}>Agenda</button></div>
      <label className={styles.search}><span>Search</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ticker, event, speaker…" /></label>
      <button type="button" className={styles.focus} aria-pressed={focus} onClick={()=>setFocus(v=>!v)}>High focus only</button>
      <div className={styles.views} aria-label="Timezone"><button type="button" aria-pressed={zone==="UTC"} onClick={()=>setZone("UTC")}>UTC</button>
        <button type="button" aria-pressed={zone!=="UTC"} onClick={()=>setZone("Asia/Kuala_Lumpur")}>MYT</button></div>
    </div>
    <div className={styles.overview}>
      <span><strong>{scheduled.length}</strong> dated this week</span>
      <span><strong>{leads.length}</strong> off-calendar leads</span>
      <span><strong>{unavailable.length+stale.length}</strong> feeds needing review</span>
      <span className={styles.overviewNote}>Monday–Sunday · UTC default · missing times stay unknown</span>
    </div>
    <div className={styles.contentGrid}>
      <div className={styles.primary}>
        {view==="week"?<>
          <div className={styles.board}>
            {week.slice(0,5).map(day=><section className={styles.day} key={day.day}>
              <div className={styles.dayHeading}><strong>{fmtDay(day.date)}</strong>
                <small>{scheduled.filter(x=>dayInZone(x,zone)===day.day).length}</small></div>
              <div className={styles.dayCards}>{dayCards(day.day)}</div>
            </section>)}
          </div>
          <div className={styles.weekend}>{weekend.map(day=><section key={day.day} className={styles.weekendDay}>
            <div className={styles.dayHeading}><strong>{fmtDay(day.date)}</strong><small>Weekend watch</small></div>
            <div className={styles.weekendCards}>{dayCards(day.day)}</div>
          </section>)}</div>
        </>:<div className={styles.agenda}>
          {week.map(day=><section key={day.day} className={styles.agendaDay}><h3>{fmtDay(day.date)}</h3>
            <div>{dayCards(day.day)}</div></section>)}
        </div>}
        <section className={styles.offCalendar}>
          <div className={styles.offCalendarHead}><div><strong>Developing / time not established</strong>
            <p>Official announcements and negotiations under review, not imaginary appointments.</p></div>
            <small>{leads.length} lead{leads.length===1?"":"s"}</small>
          </div>
          <div className={styles.leadTiles}>{leads.length?leads.map(item=><EventTile key={item.id} item={item}
            selected={details?.id===item.id} zone={zone} onChoose={()=>setSelectedId(item.id)} />)
            :<p className={styles.unknown}>No current matching original-source leads. That does not prove no talks or launches are occurring.</p>}</div>
        </section>
      </div>
      <EventDetail item={details} zone={zone}/>
    </div>
    <div className={styles.coverage}>Source coverage: {sourceBlocked.length
      ? sourceBlocked.slice(0,5).map(s=>s.name+" — "+(s.state==="not_configured"?"not configured":s.state==="stale"?"stale":"unavailable")).join(" · ")+" · missing source coverage does not mean no events"
      : "Configured official event sources checked. Publication and event timing remain separate."}</div>
  </section>;
}
