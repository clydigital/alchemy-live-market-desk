"use client";
import {useEffect,useState} from "react";
import css from "./owner-daily-report-attachments.module.css";
type Attachment={name:string;day:string;createdAt:string;sizeBytes:number|null};
const endpoint="/api/owner/report-attachments";
export default function OwnerDailyReportAttachments(){
 const [files,setFiles]=useState<Attachment[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [file,setFile]=useState<File|null>(null);
 const [message,setMessage]=useState("");
 async function refresh(){
  try{
   const response=await fetch(endpoint,{credentials:"same-origin",cache:"no-store"});
   if(!response.ok)throw Error("Private attachment archive unavailable");
   const data=await response.json() as {files:Attachment[]};
   setFiles(data.files||[]);
  }catch{setMessage("Could not read private attachments. Sign in to your approved owner account.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[]);
 async function upload(){
  if(!file||busy)return;
  if(!/\.pdf$/i.test(file.name)||file.size>3_000_000){
   setMessage("Select a PDF under 3 MB.");return;
  }
  setBusy(true);setMessage("");
  try{
   const data=new FormData();data.set("file",file);
   const date=file.name.match(/20\d{2}-\d{2}-\d{2}/)?.[0];
   if(date)data.set("reportDay",date);
   const response=await fetch(endpoint,{method:"POST",body:data,credentials:"same-origin",cache:"no-store"});
   if(!response.ok)throw Error("Attachment upload was not accepted.");
   setMessage("Saved privately. This is a research attachment, not a source-verified Daily Report.");
   setFile(null);await refresh();
  }catch(e){setMessage(e instanceof Error?e.message:"Attachment upload failed");}
  finally{setBusy(false);}
 }
 return <section className={css.section} data-owner-report-attachments="private-downloads" aria-labelledby="owner-report-attachments-title">
  <div className={css.heading}>
   <div><p className={css.kicker}>SUPPLEMENTAL FILES / OWNER-PRIVATE</p>
    <h3 id="owner-report-attachments-title">Daily Report research attachments</h3>
    <p>Download chart packs and supplemental PDFs without replacing your saved Daily Intelligence report.
     These are presenter research files, not public stories or canonical evidence.</p>
   </div>
  </div>
  <div className={css.uploader}>
   <label htmlFor="daily-report-attachment">Add a completed PDF chart pack (up to 3 MB)</label>
   <div className={css.controls}>
    <input id="daily-report-attachment" type="file" accept=".pdf,application/pdf"
     onChange={e=>setFile(e.target.files?.[0]||null)} disabled={busy}/>
    <button type="button" disabled={!file||busy} onClick={()=>void upload()}>
     {busy?"Saving privately…":"Save attachment"}
    </button>
   </div>
  </div>
  <p className={css.status} role="status">{message}</p>
  {loading?<p className={css.muted}>Reading private attachments…</p>:files.length?
   <ul className={css.items}>{files.map(f=><li key={f.name}>
    <div><strong>{f.name.replace(/--[a-f0-9-]{36}\.pdf$/,"").replaceAll("--"," · ").replaceAll("-"," ")}</strong>
     <span>{f.day} · {f.sizeBytes?Math.ceil(f.sizeBytes/1024)+" KB":"PDF"} · Private research</span>
    </div>
    <a href={endpoint+"?name="+encodeURIComponent(f.name)}>Download PDF</a>
   </li>)}</ul>:<p className={css.muted}>No supplemental PDFs saved yet. The main Daily Intelligence archive is unchanged.</p>}
 </section>;
}
