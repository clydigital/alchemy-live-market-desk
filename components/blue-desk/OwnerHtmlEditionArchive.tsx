"use client";
import {useCallback,useEffect,useState} from "react";
import css from "./owner-html-edition-archive.module.css";

type Receipt={url:string;publisher:string;status:string;publishedAt:string;title:string};
type Edition={
 id:string;report_day:string;title:string;created_at:string;
 html_sha256:string;content_sha256:string;supersedes_id:string|null;
 review_status:string;source_manifest:Receipt[];
};
export default function OwnerHtmlEditionArchive(props:{
 title:string;body:string;selectedSources:string;selectedX:string;previewReady:boolean;disabled:boolean;
}){
 const [editions,setEditions]=useState<Edition[]>([]);
 const [supersedesId,setSupersedesId]=useState("");
 const [busy,setBusy]=useState(false);
 const [note,setNote]=useState("");
 const refresh=useCallback(async()=>{
  try{
   const res=await fetch("/api/owner/html-editions",{credentials:"same-origin",cache:"no-store"});
   if(!res.ok)throw Error("Private HTML history unavailable");
   const data=await res.json() as {editions?:Edition[]};
   setEditions(data.editions||[]);
  }catch{setNote("Could not read private HTML edition history.");}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 async function save(){
  if(busy||props.disabled||!props.previewReady||props.body.trim().length<250){
   setNote("Preview the complete article first, then save an immutable private edition.");return;
  }
  setBusy(true);setNote("");
  try{
   const response=await fetch("/api/owner/html-editions",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
     title:props.title,body:props.body,selectedSources:props.selectedSources,
     selectedX:props.selectedX,supersedesId:supersedesId||null,
    }),
   });
   const data=await response.json().catch(()=>({error:"HTML archive unavailable"})) as {
    id?:string;reportDay?:string;created?:boolean;error?:string;
   };
   if(!response.ok||!data.id)throw Error(data.error||"HTML archive save failed");
   setNote((data.created?"Saved a new immutable private HTML edition":"An identical edition was already stored")+
    " · "+data.reportDay+". View it using the archive links below.");
   setSupersedesId("");await refresh();
  }catch(e){setNote(e instanceof Error?e.message:"HTML archive unavailable");}
  finally{setBusy(false);}
 }
 return <section className={css.archive} data-owner-private-html-archive="session-authorised">
  <header className={css.heading}>
   <div><p className={css.kicker}>PRIVATE HTML / IMMUTABLE HISTORY</p>
    <h3>My HTML report editions</h3>
    <p>Save an independent, server-rendered copy of the current full-length report. Every revision is a new edition; old versions remain unchanged.</p></div>
   <button type="button" onClick={()=>void refresh()} disabled={busy}>Refresh history</button>
  </header>
  <div className={css.actions}>
   <label>Correction of a previous edition (optional)
    <select value={supersedesId} disabled={busy} onChange={e=>setSupersedesId(e.target.value)}>
     <option value="">New edition (no previous correction)</option>
     {editions.map(e=><option key={e.id} value={e.id}>
      {e.report_day} · {e.title.slice(0,42)} · {e.id.slice(0,8)}
     </option>)}
    </select>
   </label>
   <button type="button" onClick={()=>void save()}
    disabled={busy||props.disabled||!props.previewReady||props.body.length<250}>
    {busy?"Saving private HTML…":supersedesId?"Save correction as new HTML edition":"Archive current HTML report"}
   </button>
  </div>
  {!props.previewReady?<p className={css.warning}>Generate or preview the complete HTML reader first; source-linked draft text alone cannot be silently marked reviewed.</p>:null}
  <p className={css.warning}>All editions are PRIVATE_DRAFT. The source manifest records exact available independent receipts and attributed X originals, not proof that every sentence has been verified. Historical HTML opens without scripts; download to keep a personal copy.</p>
  <p className={css.message} role="status">{note}</p>
  <div className={css.history}>
   {editions.length?editions.map(e=><article key={e.id} className={css.entry}>
    <p className={css.meta}>{e.report_day} · {new Date(e.created_at).toLocaleString()} · {e.review_status}</p>
    <h4>{e.title}</h4>
    <p className={css.meta}>Edition {e.id.slice(0,8)} · SHA-256 {e.html_sha256.slice(0,16)}…
     {e.supersedes_id?" · Corrects "+e.supersedes_id.slice(0,8):""}</p>
    <div className={css.links}>
     <a href={"/api/owner/html-editions?edition="+e.id} target="_blank" rel="noopener noreferrer">Read archived HTML</a>
     <a href={"/api/owner/html-editions?edition="+e.id+"&download=1"}>Download exact edition</a>
    </div>
    <details><summary>{e.source_manifest.length} source receipts and attributions</summary>
     <ul>{e.source_manifest.map((s,i)=><li key={s.url+String(i)}>
      <a href={s.url} target="_blank" rel="noopener noreferrer">{s.publisher}</a>
      {" · "}{s.status} · {s.publishedAt}
     </li>)}</ul>
    </details>
   </article>):<p className={css.message}>No archived HTML editions yet.</p>}
  </div>
 </section>;
}
