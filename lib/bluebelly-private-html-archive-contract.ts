import {createHash} from "node:crypto";

/** Pure contract shared by browser-free tests and private server archive. */
export const HTML_BUCKET="editorial-html";
export const HTML_TABLE="blue_desk_private_html_editions";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type ArchiveInput={title:string;body:string;selectedSources:string;selectedX:string;supersedesId:string|null};
export type Receipt={url:string;publisher:string;publishedAt:string;title:string;status:"ORIGINAL_VERIFIED"|"CORROBORATED"|"ATTRIBUTED"};
export const digest=(s:string|Uint8Array)=>createHash("sha256").update(s).digest("hex");
export const validArchiveId=(s:unknown):s is string=>typeof s==="string"&&UUID.test(s);
export function archivePath(owner:string,day:string,id:string){
 if(!validArchiveId(owner)||!validArchiveId(id)||!/^\d{4}-\d\d-\d\d$/.test(day))
  throw Error("INVALID_ARCHIVE_PATH");
 return "private-html/"+owner.toLowerCase()+"/"+day+"/"+id.toLowerCase()+".html";
}
export function parseArchiveInput(raw:unknown):ArchiveInput{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("INVALID_ARCHIVE_INPUT");
 const r=raw as Record<string,unknown>;
 const title=typeof r.title==="string"?r.title.trim():"";
 const body=typeof r.body==="string"?r.body.trim():"";
 const selectedSources=typeof r.selectedSources==="string"?r.selectedSources.trim():"";
 const selectedX=typeof r.selectedX==="string"?r.selectedX.trim():"";
 const supersedesId=r.supersedesId==null?null:r.supersedesId;
 if(title.length<8||title.length>110||body.length<250||body.length>75000||
   selectedSources.length>6000||selectedX.length>3500||
   (supersedesId!==null&&!validArchiveId(supersedesId)))throw Error("INVALID_ARCHIVE_INPUT");
 return {title,body,selectedSources,selectedX,supersedesId};
}
