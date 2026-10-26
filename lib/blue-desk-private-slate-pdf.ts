import type {EditorialSlate,SlateIdea} from "./editorial-slate-core.ts";

/** Fixed, deterministic private PDF: faithfully typesets the scheduled
 * Writing Brain's actual slate. No AI paraphrasing, fabricated market facts,
 * new source links, chart claims, or public publication. */
const W=595,H=842,L=51;
type Page={ops:string[];links:{url:string,y:number}[]};
function plain(v:string):string {
 return v.normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"')
  .replace(/[\u2013\u2014]/g,"-").replace(/\u2022/g,"-")
  .replace(/[^\x20-\x7e\n]/g,"?");
}
function escaped(v:string):string {
 return plain(v).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
}
function wrap(v:string,columns:number):string[]{
 const lines:string[]=[];
 for(const paragraph of plain(v).split(/\r?\n/)){
  const words=paragraph.trim().split(/\s+/).filter(Boolean);
  if(!words.length){lines.push("");continue;}
  let row="";
  for(const word of words){
   const parts=word.match(new RegExp(".{1,"+columns+"}","g"))||[];
   for(const part of parts){
    if(!row){row=part;continue;}
    if(row.length+part.length+1>columns){lines.push(row);row=part;}
    else row+=" "+part;
   }
  }
  if(row)lines.push(row);
 }
 return lines;
}
function urlSafe(url:string):boolean {
 try{const u=new URL(url);return u.protocol==="https:"&&!u.username&&!u.password
   &&!!u.hostname&&url.length<=1500;}
 catch{return false;}
}
export function renderPrivateEditorialSlatePdf(slate:EditorialSlate):Uint8Array {
 if(slate.ideas.length!==3||!Number.isFinite(Date.parse(slate.producedAt)))
  throw new Error("INVALID_EDITORIAL_SLATE");
 const pages:Page[]=[];let page!:Page,y=0;
 function fresh(){
  page={ops:[],links:[]};pages.push(page);y=745;
  page.ops.push("0.979 0.986 0.993 rg 0 0 595 842 re f");
  page.ops.push("0.035 0.145 0.220 rg 0 799 595 43 re f");
  page.ops.push("1 1 1 rg BT /F2 13 Tf 51 817 Td (BLUEBELLY / PRIVATE RESEARCH) Tj ET");
  page.ops.push("0.11 0.55 0.67 rg 0 793 595 6 re f");
 }
 function line(s:string,size=10,bold=false,colour="0.06 0.16 0.23",x=L){
  page.ops.push(`${colour} rg BT /${bold?"F2":"F1"} ${size} Tf ${x} ${y} Td (${escaped(s)}) Tj ET`);
  y-=size+5;
 }
 function ensure(points:number){if(y-points<72)fresh();}
 function para(value:string,chars=94){
  for(const text of wrap(value,chars)){ensure(18);line(text,9.6);}
  y-=11;
 }
 function title(value:string,kicker:string){
  ensure(70);line(kicker.toUpperCase(),9,true,"0.06 0.48 0.62");y-=12;
  for(const part of wrap(value,47)){ensure(28);line(part,20,true,"0.06 0.18 0.29");}
  y-=18;
 }
 function block(label:string,value:string){
  if(!value.trim())return;
  ensure(60);line(label.toUpperCase(),10,true,"0.06 0.37 0.50");y-=4;para(value);
 }
 function sources(urls:string[]){
  const links=[...new Set(urls)].filter(urlSafe).slice(0,12);
  ensure(45);line("ORIGINAL LINKS / REQUIRES INDEPENDENT VERIFICATION",9,true,"0.06 0.48 0.62");
  y-=7;
  if(!links.length){para("No independently verified original links supplied. Treat all claims as research leads.");return;}
  for(let i=0;i<links.length;i++){
   const url=links[i];
   for(const part of wrap(`[${i+1}] ${url}`,87)){
    ensure(14);line(part,8,false,"0.12 0.34 0.53");page.links.push({url,y:y+12});
   }
   y-=7;
  }
 }
 fresh();
 title("The OB / COTD research slate","SCHEDULED WRITING BRAIN / NON-CANONICAL");
 block("Edition",`${slate.dayMyt} MYT. Original slate produced ${slate.producedAt}.`);
 block("What this is","A private source-attributed editorial research pack. This PDF transcribes the three scheduled ideas; it is NOT an independently verified article, published report, trade recommendation or canonical Story update.");
 block("Source status",slate.verificationStatus==="source_checked"
  ?"Upstream producer marked sources checked. The PDF generator did not independently re-read or validate them."
  :"PARTIAL. The upstream research producer marked source coverage incomplete. All claims remain conditional.");
 block("The three proposed angles",slate.ideas.map(i=>`${i.rank}. ${i.title} [${i.format}]`).join("\n"));
 block("Producer notes",slate.notes||"No additional producer notes supplied.");
 for(const idea of slate.ideas){
  fresh();
  title(idea.title,`IDEA ${idea.rank} / ${idea.format} / PRIVATE EDITORIAL RESEARCH`);
  block("Opening hook",idea.hook);
  block("Dated catalyst timeline",idea.catalystTimeline);
  block("Expected reaction",idea.expectation);
  block("Actually observed / 1D-3D-5D comparison",idea.priceReaction||"UNKNOWN: no source-backed session comparison supplied.");
  block("Economic and market transmission",idea.mechanism);
  block("Best countercase",idea.countercase);
  block("Next deciding trigger",idea.nextTrigger);
  if(idea.chartGuidance.length)block("Technical charts to CHECK, not verified signals",idea.chartGuidance.map((v,i)=>`${i+1}. ${v}`).join("\n"));
  block("Missing proof",idea.missingProof||"Independent verification is still required before publication or advice.");
  sources(idea.sourceUrls);
 }
 fresh();
 title("Source and provenance manifest","RESEARCH ONLY / NOT A VERIFIED ARTICLE");
 block("Provenance",`Producer: Blue Desk OB/COTD Writing Brain (scheduled ChatGPT task). Slate source date: ${slate.dayMyt}. Actual persisted producer timestamp: ${slate.producedAt}. No plugin invocations are asserted by this PDF renderer.`);
 block("Verification boundary","Only source URLs and text supplied in the saved slate were used. References are attributed research candidates, not independent verification by the report renderer. Treat creator/social claims as leads and leave unknown market reactions unresolved.");
 sources(slate.sources.length?slate.sources:slate.ideas.flatMap(i=>i.sourceUrls));
 const objects:string[]=[];
 const add=(s:string)=>{objects.push(s);return objects.length;};
 const root=add(""),parent=add("");
 const normal=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
 const bold=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
 const refs:number[]=[];
 for(let i=0;i<pages.length;i++){
  const p=pages[i];
  p.ops.push("0.65 0.75 0.81 RG 0.5 w 51 55 m 544 55 l S");
  p.ops.push(`0.34 0.40 0.46 rg BT /F1 8 Tf 51 38 Td (PRIVATE / UNVERIFIED RESEARCH LEADS / NOT FOR PUBLICATION) Tj ET`);
  p.ops.push(`0.34 0.40 0.46 rg BT /F1 8 Tf 505 38 Td (${i+1} / ${pages.length}) Tj ET`);
  const content=p.ops.join("\n");
  const stream=add(`<< /Length ${Buffer.byteLength(content,"latin1")} >>\nstream\n${content}\nendstream`);
  const annotations=p.links.map(x=>add(`<< /Type /Annot /Subtype /Link /Rect [51 ${Math.max(56,x.y-7)} 544 ${Math.max(68,x.y+9)}] /Border [0 0 0] /A << /S /URI /URI (${escaped(x.url)}) >> >>`));
  refs.push(add(`<< /Type /Page /Parent ${parent} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${normal} 0 R /F2 ${bold} 0 R >> >> /Contents ${stream} 0 R /Annots [${annotations.map(n=>n+" 0 R").join(" ")}] >>`));
 }
 objects[root-1]=`<< /Type /Catalog /Pages ${parent} 0 R >>`;
 objects[parent-1]=`<< /Type /Pages /Count ${refs.length} /Kids [${refs.map(n=>n+" 0 R").join(" ")}] >>`;
 let pdf="%PDF-1.4\n%\xFF\xFF\xFF\xFF\n";const offsets=[0];
 for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf,"latin1"));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const pos=Buffer.byteLength(pdf,"latin1");
 pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 for(const at of offsets.slice(1))pdf+=String(at).padStart(10,"0")+" 00000 n \n";
 pdf+=`trailer\n<< /Size ${objects.length+1} /Root ${root} 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
 return new Uint8Array(Buffer.from(pdf,"latin1"));
}
