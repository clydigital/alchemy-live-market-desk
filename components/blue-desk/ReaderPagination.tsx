import Link from "next/link";
import {readerPageTokens} from "@/lib/bluebelly-reader-pagination";
import styles from "./ReaderPagination.module.css";

type Props={
 page:number;totalPages:number;totalItems:number;firstItem:number;lastItem:number;
 label:string;getHref?:(page:number)=>string;onPageChange?:(page:number)=>void;
 compact?:boolean;
};
export default function ReaderPagination({
 page,totalPages,totalItems,firstItem,lastItem,label,getHref,onPageChange,compact=false,
}:Props){
 if(totalItems===0||totalPages<=1)return null;
 const target=(number:number,text:string,kind:"number"|"control",disabled=false)=>{
  const visibleText=compact&&kind==="control"?(text==="Previous"?"‹":"›"):text;
  const active=number===page&&kind==="number";
  const className=active?styles.current:kind==="control"?styles.control:styles.number;
  if(disabled)return <span key={text} className={styles.disabled} aria-disabled="true">{visibleText}</span>;
  if(active)return <span key={number} className={className} aria-current="page" aria-label={label+" page "+number+", current page"}>{number}</span>;
  if(getHref)return <Link key={kind+number+text} href={getHref(number)} className={className}
    aria-label={kind==="number"?label+" page "+number:label+" "+text.toLowerCase()+" page"}>{visibleText}</Link>;
  return <button key={kind+number+text} type="button" className={className}
    onClick={()=>onPageChange?.(number)}
    aria-label={kind==="number"?label+" page "+number:label+" "+text.toLowerCase()+" page"}>{visibleText}</button>;
 };
 return <nav className={compact?styles.compact:styles.nav} aria-label={label+" pagination"} data-reader-pagination={label.toLowerCase().replace(/\s+/g,"-")}>
  <p className={compact?styles.compactSummary:styles.summary} role="status">Showing {firstItem}–{lastItem} of {totalItems} available · Page {page} of {totalPages}</p>
  <div className={styles.actions}>
   {target(Math.max(1,page-1),"Previous","control",page<=1)}
   <div className={styles.pages} aria-label="Select page">
    {readerPageTokens(page,totalPages).map((entry,i)=>entry==="ellipsis"?
     <span key={"ellipsis-"+i} className={styles.ellipsis} aria-hidden="true">…</span>:
     target(entry,String(entry),"number"))}
   </div>
   {target(Math.min(totalPages,page+1),"Next","control",page>=totalPages)}
  </div>
 </nav>;
}
