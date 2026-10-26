import {type AutomaticReportEvidence,type AutomatedReportNarrative,type ReportSource} from "./blue-desk-automated-report-contract.ts";

/** Dependency-free, bounded PDF renderer for the fixed automated edition.
 * The output is a real PDF snapshot stored once in the existing private bucket.
 * No external HTML-to-PDF requests, chromium or arbitrary user HTML. */
const PAGE_W=595,PAGE_H=842,LEFT=53,RIGHT=542;
const dark=[0.035,0.12,0.19],navy=[0.05,0.21,0.33],muted=[0.36,0.44,0.50],cyan=[0.12,0.57,0.69];
type Page={ops:string[];links:Array<{url:string;y:number}>};
function ascii(s:string):string{
 return s.replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"')
  .replace(/[\u2013\u2014]/g,"-").replace(/\u2022/g,"-")
  .replace(/\u00a0/g," ").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[^\x20-\x7e\n\r]/g,"?");
}
function esc(s:string){return ascii(s).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");}
function rgb(a:number[]){return a.map(v=>v.toFixed(3)).join(" ");}
function wrap(s:string,maxChars:number):string[]{
 const lines:string[]=[];
 for(const paragraph of ascii(s).split(/\r?\n/)){
  const words=paragraph.trim().split(/\s+/).filter(Boolean);
  if(!words.length){lines.push("");continue;}
  let row="";
  for(const word of words){
   if(!row){row=word;continue;}
   if(row.length+word.length+1>maxChars){lines.push(row);row=word;}
   else row+=" "+word;
  }
  if(row)lines.push(row);
 }
 return lines;
}
function dateText(s:string){
 const d=new Date(s);return Number.isFinite(d.getTime())
  ?d.toLocaleString("en-GB",{timeZone:"UTC",dateStyle:"medium",timeStyle:"short"})+" UTC":"Unavailable";
}
export function renderAutomatedReportPdf(e:AutomaticReportEvidence,n:AutomatedReportNarrative):Uint8Array{
 const pages:Page[]=[];let page:Page={ops:[],links:[]};let y=750;
 const newPage=()=>{
  page={ops:[],links:[]};pages.push(page);y=750;
  page.ops.push(`0.975 0.984 0.992 rg 0 0 ${PAGE_W} ${PAGE_H} re f`);
  page.ops.push(`${rgb(navy)} rg 0 800 ${PAGE_W} 42 re f`);
  page.ops.push(`1 1 1 rg BT /F2 13 Tf 53 816 Td (BLUEBELLY) Tj ET`);
  page.ops.push(`${rgb(cyan)} rg 0 794 ${PAGE_W} 6 re f`);
 };
 const line=(s:string,x:number,yy:number,size=10,bold=false,color=dark)=>{
  page.ops.push(`${rgb(color)} rg BT /${bold?"F2":"F1"} ${size} Tf ${x} ${yy} Td (${esc(s)}) Tj ET`);
 };
 const rule=()=>{page.ops.push(`0.75 0.83 0.87 RG 0.6 w ${LEFT} ${y} m ${RIGHT} ${y} l S`);y-=16;};
 const ensure=(pts:number)=>{if(y-pts<73)newPage();};
 const heading=(s:string,kicker?:string)=>{
  ensure(75);y-=8;
  if(kicker){line(kicker.toUpperCase(),LEFT,y,8,true,cyan);y-=17;}
  for(const w of wrap(s,59)){line(w,LEFT,y,18,true,navy);y-=24;}
  y-=9;rule();
 };
 const paragraph=(s:string)=>{
  const lines=wrap(s,92);
  for(const row of lines){ensure(17);line(row,LEFT,y,10,false,dark);y-=15;}
  y-=12;
 };
 const item=(label:string,text:string)=>{
  ensure(55);line(label,LEFT,y,10,true,navy);y-=18;paragraph(text);
 };
 const sourcesFor=(refs:string[],originals:ReportSource[])=>{
  const lookup=new Map(originals.map(s=>[s.id,s]));
  ensure(30);line("EVIDENCE REFERENCES",LEFT,y,8,true,cyan);y-=16;
  for(const ref of refs){
   const s=lookup.get(ref);if(!s)continue;
   const u=new URL(s.url);
   const label=`[${ref}] ${s.sourceName} | ${dateText(s.eventAt)} | ${u.hostname}`;
   for(const row of wrap(label,95)){ensure(15);line(row,LEFT,y,8,false,muted);y-=12;}
   page.links.push({url:s.url,y:y+8});
  }
  y-=12;
 };
 newPage();
 // Cover is deliberately a substantial, readable editorial summary, not an empty title leaf.
 y=711;
 line("DAILY MARKET INTELLIGENCE / AUTOMATED EDITION",LEFT,y,10,true,cyan);y-=55;
 for(const r of wrap(n.title,34)){line(r,LEFT,y,30,true,navy);y-=40;}
 y-=16;
 for(const r of wrap(n.deck,68)){line(r,LEFT,y,13,false,muted);y-=21;}
 y-=36;rule();
 line(`EDITION  ${e.slot.toUpperCase()}  |  AS OF ${dateText(e.asOf)}`,LEFT,y,10,true,navy);
 y-=42;
 line("THE ONE-MINUTE READ",LEFT,y,10,true,cyan);y-=28;
 paragraph(n.executiveSummary);
 y-=20;
 line("WHAT THIS REPORT IS",LEFT,y,10,true,cyan);y-=23;
 paragraph("An automated, source-qualified account of market developments and the financial questions they raise. The underlying original notices are attributed; interpretations and scenarios are AI-assisted and have not been independently reviewed by a human editor.");
 newPage();
 heading("The big picture","01 / executive intelligence");
 paragraph(n.bigPicture);
 heading("The stories behind the moves","02 / catalysts and consequences");
 n.stories.forEach((s,i)=>{
  heading(s.headline,`STORY ${i+1} / ${n.stories.length}`);
  item("The setup",s.setup);
  item("The reveal - what the numbers or decisions mean",s.reveal);
  item("Who feels it",s.humanStake);
  item("How the effect could reach markets",s.mechanism);
  item("The catch",s.countercase);
  item("Next evidence that matters",s.nextTest);
  sourcesFor(s.sourceIds,e.sources);
 });
 heading("Cross-market transmission","03 / equities, bonds, FX and commodities");
 for(const [i,s] of n.crossMarket.entries())item(`MARKET LENS ${i+1}`,s);
 heading("The watchlist","04 / upcoming decisions");
 for(const itemValue of n.watchlist){
  heading(itemValue.event,itemValue.when);
  item("The market question",itemValue.question);
  item("If developments are supportive",itemValue.positiveCase);
  item("If developments are adverse",itemValue.negativeCase);
  sourcesFor(itemValue.sourceIds,e.sources);
 }
 heading("Outlook and what would change it","05 / assessment");
 paragraph(n.concludingAssessment);
 heading("Scope, uncertainty and methods","06 / source limitations");
 paragraph(n.limitations);
 paragraph(e.coverageNote);
 heading("Source ledger","07 / original documents and event clocks");
 for(const src of e.sources){
  ensure(65);line(`[${src.id}] ${src.type} - ${src.sourceName}`,LEFT,y,10,true,navy);y-=16;
  paragraph(src.title);
  ensure(25);line(`Event / release: ${dateText(src.eventAt)}`,LEFT,y,8,false,muted);y-=13;
  for(const w of wrap(src.url,90)){ensure(14);line(w,LEFT,y,8,false,cyan);y-=12;}
  page.links.push({url:src.url,y:y+15});y-=12;
 }
 // Footer and page number after final count is known.
 const objects:string[]=[];
 const add=(v:string)=>{objects.push(v);return objects.length;};
 const catalog=add(""),tree=add("");
 const normalFont=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
 const boldFont=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
 const pageRefs:number[]=[];
 for(let index=0;index<pages.length;index++){
  const p=pages[index];
  p.ops.push(`0.72 0.78 0.82 RG 0.5 w 53 53 m 542 53 l S`);
  p.ops.push(`${rgb(muted)} rg BT /F1 8 Tf 53 37 Td (BLUEBELLY  |  AUTOMATED SOURCE-QUALIFIED BRIEF) Tj ET`);
  p.ops.push(`${rgb(muted)} rg BT /F1 8 Tf 508 37 Td (${index+1} / ${pages.length}) Tj ET`);
  const content=p.ops.join("\n");
  const stream=add(`<< /Length ${Buffer.byteLength(content,"latin1")} >>\nstream\n${content}\nendstream`);
  const annotations=p.links.map(v=>add(`<< /Type /Annot /Subtype /Link /Rect [53 ${Math.max(55,v.y-8)} 542 ${Math.max(66,v.y+10)}] /Border [0 0 0] /A << /S /URI /URI (${esc(v.url)}) >> >>`));
  const pageRef=add(`<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${normalFont} 0 R /F2 ${boldFont} 0 R >> >> /Contents ${stream} 0 R /Annots [${annotations.map(n=>n+" 0 R").join(" ")}] >>`);
  pageRefs.push(pageRef);
 }
 objects[catalog-1]=`<< /Type /Catalog /Pages ${tree} 0 R >>`;
 objects[tree-1]=`<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map(n=>n+" 0 R").join(" ")}] >>`;
 let pdf="%PDF-1.4\n%\xFF\xFF\xFF\xFF\n";
 const offsets=[0];
 for(let i=0;i<objects.length;i++){
  offsets.push(Buffer.byteLength(pdf,"latin1"));
  pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;
 }
 const startxref=Buffer.byteLength(pdf,"latin1");
 pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 offsets.slice(1).forEach(n=>pdf+=String(n).padStart(10,"0")+" 00000 n \n");
 pdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
 return new Uint8Array(Buffer.from(pdf,"latin1"));
}
