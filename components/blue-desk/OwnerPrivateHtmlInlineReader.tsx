"use client";
import {useEffect,useState} from "react";
import s from "@/app/my-reports/my-desk.module.css";

/** Fetches only the exact owner-authorised, SHA-checked archived artifact.
 * A sandboxed opaque-origin iframe prevents scripts and first-party origin
 * access, even if an old edition contains executable widgets. */
export default function OwnerPrivateHtmlInlineReader({editionId,title}:{
 editionId:string;title:string;
}){
 const [expanded,setExpanded]=useState(true);
 const [html,setHtml]=useState("");
 const [error,setError]=useState("");
 useEffect(()=>{
  if(!expanded||html)return;
  const abort=new AbortController();
  async function load(){
   setError("");
   try{
    const res=await fetch("/api/owner/html-editions?edition="+encodeURIComponent(editionId),{
     credentials:"same-origin",cache:"no-store",signal:abort.signal,
    });
    if(!res.ok)throw Error("The saved edition could not be loaded ("+res.status+").");
    const result=await res.text();
    if(!/^\s*<!doctype html>/i.test(result)||result.length>950000)
     throw Error("The archived HTML failed reader checks.");
    setHtml(result);
   }catch(e){
    if(!abort.signal.aborted)setError(e instanceof Error?e.message:"Private reader unavailable");
   }
  }
  void load();
  return ()=>abort.abort();
 },[editionId,expanded,html]);
 return <div className={s.dailyReader} data-private-inline-edition={editionId}>
  <button type="button" className={s.readerToggle} onClick={()=>setExpanded(v=>!v)}
   aria-expanded={expanded}>
   {expanded?"Hide full report":"Read full report here"}
  </button>
  {expanded?<div>
   {error?<p role="alert">{error} <a href={"/api/owner/html-editions?edition="+editionId}>Open secure original</a></p>:null}
   {html?<iframe className={s.readerFrame}
    title={"Private Daily Intelligence: "+title}
    sandbox="allow-popups" referrerPolicy="no-referrer"
    srcDoc={html}/>:
    !error?<p className={s.readerLoading} role="status">Loading saved private HTML edition…</p>:null}
   <p className={s.readerFoot}>Original HTML from the private, integrity-checked archive.
    Inline reading is script-disabled; original source links remain attributed, not independently verified.</p>
  </div>:null}
 </div>;
}
