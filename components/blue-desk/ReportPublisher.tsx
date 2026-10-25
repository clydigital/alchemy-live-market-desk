"use client";
import {useState,type FormEvent} from "react";
import {parseReviewedSubmission} from "@/lib/editorial-publications";
import css from "./publisher.module.css";
type Kind="OB"|"COTD";
export default function ReportPublisher(){
 const [kind,setKind]=useState<Kind>("OB");
 const [title,setTitle]=useState("");
 const [meta,setMeta]=useState("");
 const [body,setBody]=useState("");
 const [sources,setSources]=useState("");
 const [file,setFile]=useState<File|null>(null);
 const [packet,setPacket]=useState("");
 const [checks,setChecks]=useState([false,false,false,false]);
 const [working,setWorking]=useState(false);
 const [error,setError]=useState("");
 const [published,setPublished]=useState<{articleUrl:string;pdfUrl:string}|null>(null);
 function fillPacket(){
  try{
   const data=JSON.parse(packet) as Record<string,unknown>;
   setKind(data.kind==="COTD"?"COTD":"OB");
   setTitle(typeof data.title==="string"?data.title.slice(0,63):"");
   setMeta(typeof data.meta==="string"?data.meta.slice(0,150):
    typeof data.meta_description==="string"?data.meta_description.slice(0,150):"");
   setBody(typeof data.body==="string"?data.body.slice(0,15000):"");
   const urls=data.source_urls??data.sourceUrls??data.sources;
   setSources(Array.isArray(urls)?urls.filter((x):x is string=>typeof x==="string").join("\n"):
    typeof urls==="string"?urls:"");
   setChecks([false,false,false,false]);
   setError("Imported as an unapproved working packet. Review the text and PDF before publication.");
  }catch{setError("Invalid JSON packet. Paste the complete draft fields instead.");}
 }
 async function publish(e:FormEvent){
  e.preventDefault();
  if(working)return;
  setPublished(null);setError("");
  if(!file||file.type!=="application/pdf"||file.size>3145728){
   setError("Attach a completed PDF file smaller than 3 MB.");return;
  }
  const submission=parseReviewedSubmission({kind,title,meta,body,sources});
  if(!submission){setError("Check the title (5–63 chars), body (200–15,000 chars) and at least one HTTPS original source.");return;}
  if(!checks.every(Boolean)){setError("Complete all four independent editorial approval checks.");return;}
  if(!window.confirm("Publish this article and PDF permanently to the public Bluebelly library? "+
     "This version cannot be edited or automatically replaced."))return;
  setWorking(true);
  try{
   const data=new FormData();
   data.append("publication",JSON.stringify(submission));
   data.append("pdf",file);
   for(const k of ["sourcesChecked","chartsChecked","copyApproved","publicRightsConfirmed"])
    data.append(k,"yes");
   const res=await fetch("/api/owner/editorial-publish",{
    method:"POST",body:data,credentials:"same-origin",
   });
   const info=await res.json() as {error?:string;articleUrl?:string;pdfUrl?:string};
   if(!res.ok||!info.articleUrl||!info.pdfUrl)
    throw Error(info.error||"Publication failed; draft remains unchanged.");
   setPublished({articleUrl:info.articleUrl,pdfUrl:info.pdfUrl});
  }catch(e){setError(e instanceof Error?e.message:"Publication unavailable");}
  finally{setWorking(false);}
 }
 return <section className={css.panel} aria-label="Approved report publisher">
  <p className={css.note}>OWNER APPROVAL ONLY · PUBLIC HTML + FIXED PDF · NO MODEL CALL</p>
  <h2>Publish a reviewed edition</h2>
  <p>Prepare the article in ChatGPT or the Bluebelly Editorial Lab, export a PDF,
   then verify its sources and upload both here. This action creates immutable,
   public links. It does not change a canonical Market Story or Dossier.</p>
  <details><summary>Import working research JSON</summary>
   <textarea rows={4} value={packet} onChange={e=>setPacket(e.target.value)}
    placeholder='{"kind":"OB","title":"...","body":"...","sourceUrls":["https://..."]}'/>
   <button type="button" onClick={fillPacket}>Populate editor from JSON</button>
  </details>
  <form onSubmit={publish} className={css.form}>
   <label>Edition
    <select value={kind} onChange={e=>setKind(e.target.value as Kind)}>
     <option value="OB">Opening Bell</option><option value="COTD">Chart of the Day</option>
    </select>
   </label>
   <label>Approved headline (maximum 63 characters)
    <input required maxLength={63} value={title} onChange={e=>setTitle(e.target.value)}/>
   </label>
   <label>Meta description (maximum 150 characters)
    <textarea maxLength={150} rows={2} value={meta} onChange={e=>setMeta(e.target.value)}/>
   </label>
   <label>Final client-facing article body
    <textarea required minLength={200} maxLength={15000} rows={16}
     value={body} onChange={e=>setBody(e.target.value)}/>
   </label>
   <label>Original-source HTTPS URLs (one per line, at least one)
    <textarea required rows={5} value={sources} onChange={e=>setSources(e.target.value)}/>
   </label>
   <label>Matching approved PDF (up to 3 MB)
    <input type="file" accept="application/pdf,.pdf"
     onChange={e=>setFile(e.target.files?.[0]||null)}/>
   </label>
   <fieldset><legend>Mandatory owner review</legend>
    {[
     "I opened the original sources and verified key factual claims and release clocks.",
     "I inspected every technical chart and any claimed market-reaction window.",
     "I reviewed the full article for client-facing quality and correctness.",
     "I confirm the PDF and article may be publicly distributed.",
    ].map((label,i)=>
      <label key={i} className={css.check}>
       <input type="checkbox" checked={checks[i]}
        onChange={e=>setChecks(x=>x.map((v,j)=>i===j?e.target.checked:v))}/>
       {label}
      </label>)}
   </fieldset>
   {error?<p role="alert" className={css.warning}>{error}</p>:null}
   {published?<div role="status" className={css.success}>
    Publication saved. <a href={published.articleUrl} target="_blank" rel="noopener noreferrer">Read article</a>
    {" · "}<a href={published.pdfUrl} target="_blank" rel="noopener noreferrer">Open PDF</a>
   </div>:null}
   <button type="submit" disabled={working||!file||!checks.every(Boolean)}>
    {working?"Saving approved edition…":"Publish reviewed article + PDF"}
   </button>
  </form>
 </section>;
}
