/**
 * Pure, owner-only Editorial Reader v4 renderer.
 * Input is a frozen, source-qualified packet. No new research, model calls,
 * external fetching, storage, PDF export, or public publication.
 */
export type ReaderSource={
 id:string;title:string;publisher:string;url:string;publishedAt:string;
 status:"ORIGINAL_VERIFIED"|"CORROBORATED"|"ATTRIBUTED"|"UNRESOLVED";period?:string;
};
export type ReaderBlock=
 |{kind:"paragraph";text:string;sourceIds:string[]}
 |{kind:"figure";title:string;period:string;unit:string;method:string;sourceId:string;
   rows:Array<{label:string;value:number}>;caption:string}
 |{kind:"cause-chain";title:string;nodes:Array<{label:string;observed:boolean}>;note:string;sourceIds:string[]}
 |{kind:"x-post";url:string;handle:string;publishedAt:string;summary:string;originalVerified:boolean;sourceIds:string[]};
export type ReaderSection={id:string;title:string;opening:string;blocks:ReaderBlock[]};
export type ReaderEdition={
 editionId:string;reportDay:string;asOf:string;title:string;deck:string;
 snapshotSha256:string;executiveSummary:string;sections:ReaderSection[];sources:ReaderSource[];
 status:"PRIVATE_DRAFT"|"OWNER_REVIEWED";
};
const CSS=[
':root{color-scheme:light;--ink:#192b39;--navy:#10293d;--accent:#167078;--line:#d9e4e7}',
'*{box-sizing:border-box}body{margin:0;background:#edf1f2;color:var(--ink);font:18px/1.76 system-ui,Arial,sans-serif}',
'a{color:#126273;text-underline-offset:3px}p{margin:0 0 1.2em}h1,h2,h3{font-family:Georgia,serif;line-height:1.25}',
'h1{font-size:clamp(36px,4.2vw,58px);margin:14px 0 22px}h2{font-size:34px;margin:0 0 23px}h3{font-size:24px}',
'.layout{display:grid;grid-template-columns:205px minmax(0,795px);gap:32px;max-width:1108px;margin:auto;padding:24px 18px}',
'nav{align-self:start;position:sticky;top:16px;background:var(--navy);color:#fff;border-radius:10px;padding:21px}',
'nav b{display:block;font-size:20px;margin-bottom:18px}nav a{display:block;color:#dcebf0;font-size:13px;line-height:1.35;padding:10px 0;border-top:1px solid #30475a;text-decoration:none}',
'article{min-width:0;background:#fff;border:1px solid var(--line);border-radius:10px;padding:42px 50px 65px;box-shadow:0 8px 30px #12263a12}',
'.kicker{color:#a0732b;font:700 11px/1.5 Arial,sans-serif;letter-spacing:.15em;text-transform:uppercase}',
'.deck{font-size:21px;line-height:1.65;color:#4f6475}.meta{font-size:13px;color:#687a89;border-top:1px solid var(--line);padding-top:14px}',
'section{padding:46px 0;border-bottom:1px solid var(--line)}.opening{font-size:20px;line-height:1.7}',
'.status{font:700 12px Arial,sans-serif;color:#725322;background:#fff5e6;padding:10px 13px;border-left:4px solid #ad7a2f}',
'.proof{font:12px/1.55 Arial,sans-serif;color:#57717e;margin-top:8px}.proof a{margin-right:10px}',
'figure,.x-card{margin:32px 0 36px;padding:19px 21px;border:1px solid var(--line);background:#f7fafb;border-radius:9px;break-inside:avoid}',
'figure figcaption{font-size:13px;line-height:1.6;color:#576e7b;border-top:1px solid var(--line);padding-top:13px;margin-top:12px}',
'.viz-head{font:700 21px Georgia,serif;margin:0 0 7px}.viz-sub{font:13px/1.5 Arial,sans-serif;color:#617785;margin-bottom:21px}',
'.bar-row{display:grid;grid-template-columns:minmax(60px,105px) 1fr 95px;gap:12px;align-items:center;margin:14px 0;font:14px/1.45 Arial,sans-serif}',
'.track{height:24px;background:#e3eaed;border-radius:3px}.fill{height:100%;background:#24817c;border-radius:3px}.bar-row strong{text-align:right;font-variant-numeric:tabular-nums}',
'.chain{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}.chain-step{padding:14px;background:#fff;border-left:4px solid #207f74;font:14px/1.45 Arial,sans-serif}',
'.chain-step.hypothesis{border-left:4px dashed #bd862f}.chain-step span{display:block;color:#697d86;font-size:11px;margin-top:8px;text-transform:uppercase}',
'.x-card{background:#f5f8fa}.x-card .byline{font:700 13px Arial,sans-serif}.x-card .x-summary{font-size:16px;line-height:1.6;margin:12px 0}',
'.x-card .x-state{font-size:12px;color:#795a24}.x-card button{font:600 13px Arial,sans-serif;background:#173c53;border:0;border-radius:4px;color:white;padding:10px 13px;cursor:pointer;margin:10px 8px 0 0}',
'.x-card a{overflow-wrap:anywhere}ul.sources{padding-left:22px}.sources li{margin:14px 0;font:13px/1.65 Arial,sans-serif;overflow-wrap:anywhere}',
'@media(max-width:850px){.layout{display:block;padding:0}nav{position:static;border-radius:0}nav .toc{display:none}article{border:0;border-radius:0;padding:30px 22px}h2{font-size:29px}section{padding:33px 0}}',
'@media(max-width:420px){article{padding:22px 18px}.bar-row{grid-template-columns:65px 1fr 77px;gap:7px;font-size:12px}figure,.x-card{padding:12px}.chain{grid-template-columns:repeat(2,minmax(0,1fr))}.deck{font-size:19px}}',
'@page{size:A4;margin:18mm 15mm 17mm}',
'@media print{html,body{background:white}nav{display:none}.layout{display:block;max-width:none;padding:0}article{border:0;padding:0;box-shadow:none}body{font-size:15px;line-height:1.6}h1{font-size:39px}h2{font-size:29px}h3{font-size:21px}section{padding:8mm 0;break-before:auto}section h2{break-after:avoid-page}.deck{font-size:18px}p{margin-bottom:13px;orphans:3;widows:3}figure,.x-card{break-inside:avoid}.x-card button{display:none}.x-card .x-native{display:none}.bar-row{font-size:12px}.proof{font-size:11px}}'
].join('');
function esc(value:string):string{return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");}
function httpsUrl(value:string):string{
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw new Error('Unsafe URL');
 return u.toString();
}
function validClock(v:string):boolean{return /^\d{4}-\d\d-\d\dT/.test(v)&&Number.isFinite(Date.parse(v));}
function validate(e:ReaderEdition):Map<string,ReaderSource>{
 if(!e.editionId||!e.title||!e.deck||!e.executiveSummary||!validClock(e.asOf)||
  !/^\d{4}-\d\d-\d\d$/.test(e.reportDay)||!/^[a-f\d]{64}$/i.test(e.snapshotSha256))
  throw new Error('Incomplete immutable edition identity');
 if(!e.sections.length||(e.status==="OWNER_REVIEWED"&&!e.sources.length))throw new Error('Missing evidence or narrative');
 const sources=new Map<string,ReaderSource>();
 for(const s of e.sources){
  if(!s.id||sources.has(s.id)||!s.title||!s.publisher||!validClock(s.publishedAt))throw new Error('Invalid source receipt');
  httpsUrl(s.url);sources.set(s.id,s);
 }
 const joined=(ids:string[])=>{for(const id of ids)if(!sources.has(id))throw new Error('Unjoined source ID: '+id);};
 const anchors=new Set<string>();
 for(const s of e.sections){
  if(!/^[a-z0-9-]{1,60}$/.test(s.id)||anchors.has(s.id)||!s.title||!s.opening)throw new Error('Invalid section');
  anchors.add(s.id);
  for(const b of s.blocks){
   if(b.kind==='paragraph'){if(!b.text.trim())throw new Error('Empty paragraph');joined(b.sourceIds);}
   else if(b.kind==='figure'){
    const source=sources.get(b.sourceId);
    if(!source||source.status!=='ORIGINAL_VERIFIED'||!b.period||!b.unit||!b.method||!b.caption||
       !b.rows.length||b.rows.length>12||b.rows.some(r=>!r.label||!Number.isFinite(r.value)||r.value<0))
     throw new Error('Figure is missing verified source, method, period, unit or values');
   }else if(b.kind==='cause-chain'){
    joined(b.sourceIds);if(b.nodes.length<2||b.nodes.length>8||b.nodes.some(n=>!n.label))throw new Error('Invalid causal chain');
    if(b.nodes.some(n=>n.observed)&&!b.sourceIds.some(id=>sources.get(id)?.status==='ORIGINAL_VERIFIED'))throw new Error('Observed causal node lacks original verified evidence');
   }else if(b.kind==='x-post'){
    joined(b.sourceIds);
    const u=new URL(httpsUrl(b.url));
    if(!['x.com','www.x.com','twitter.com','www.twitter.com'].includes(u.hostname)||
     !/^\/[A-Za-z0-9_]{1,15}\/status\/\d+\/?$/.test(u.pathname)||
     !validClock(b.publishedAt)||!b.summary.trim()||!/^[A-Za-z0-9_]{1,15}$/.test(b.handle)||
     u.pathname.split('/')[1].toLowerCase()!==b.handle.toLowerCase())
     throw new Error('X post requires exact attributed original');
    if(b.originalVerified&&!b.sourceIds.some(id=>{
      const r=sources.get(id);return r?.status==='ORIGINAL_VERIFIED'&&httpsUrl(r.url)===httpsUrl(b.url);
    }))throw new Error('Verified X original requires exact independently verified post receipt');
   }
  }
 }
 return sources;
}
function refs(ids:string[],sources:Map<string,ReaderSource>):string{
 return ids.length?'<p class="proof">Sources: '+ids.map(id=>{
  const s=sources.get(id)!;
  return '<a href="'+esc(httpsUrl(s.url))+'" rel="noopener noreferrer" target="_blank">'+esc(s.publisher+' · '+id)+'</a>';
 }).join(' ')+'</p>':'';
}
function renderBlock(b:ReaderBlock,sources:Map<string,ReaderSource>):string{
 if(b.kind==='paragraph')return '<p>'+esc(b.text)+'</p>'+refs(b.sourceIds,sources);
 if(b.kind==='figure'){
  const max=Math.max(0.001,...b.rows.map(r=>r.value));
  const rows=b.rows.map(r=>'<div class="bar-row"><b>'+esc(r.label)+'</b><div class="track"><div class="fill" style="width:'+(100*r.value/max).toFixed(2)+'%"></div></div><strong>'+r.value.toLocaleString('en-GB',{maximumFractionDigits:2})+' '+esc(b.unit)+'</strong></div>').join('');
  const source=sources.get(b.sourceId)!;
  return '<figure role="group" aria-label="'+esc(b.title)+'"><div class="viz-head">'+esc(b.title)+'</div><div class="viz-sub">'+esc(b.period)+' · '+esc(b.method)+'</div>'+rows+'<figcaption>'+esc(b.caption)+' · <a target="_blank" rel="noopener noreferrer" href="'+esc(httpsUrl(source.url))+'">'+esc(source.publisher)+'</a></figcaption></figure>';
 }
 if(b.kind==='cause-chain')return '<figure><div class="viz-head">'+esc(b.title)+'</div><div class="chain">'+b.nodes.map(n=>'<div class="chain-step'+(n.observed?'':' hypothesis')+'">'+esc(n.label)+'<span>'+(n.observed?'Observed':'Hypothesis')+'</span></div>').join('')+'</div><figcaption>'+esc(b.note)+refs(b.sourceIds,sources)+'</figcaption></figure>';
 const url=esc(httpsUrl(b.url));
 return '<aside class="x-card"><div class="byline">@'+esc(b.handle)+' · '+esc(b.publishedAt)+'</div>'+
 '<p class="x-summary">'+esc(b.summary)+'</p><p class="x-state">'+(b.originalVerified?'Original post verified':'Attributed original link; post not independently verified')+'</p>'+
 '<a href="'+url+'" target="_blank" rel="noopener noreferrer">Read original X post</a> '+
 '<button type="button" data-load-x="'+url+'">Load original X embed</button><div class="x-native"></div>'+refs(b.sourceIds,sources)+'</aside>';
}
/** Caller independently authenticates private HTML read and any same-snapshot PDF export. */
export function renderPrivateEditorialReaderHtml(e:ReaderEdition):string{
 const sources=validate(e);
 const toc=e.sections.map((s,i)=>'<a href="#'+s.id+'">'+String(i+1).padStart(2,'0')+' · '+esc(s.title)+'</a>').join('');
 const sections=e.sections.map((s,i)=>'<section id="'+s.id+'"><p class="kicker">'+String(i+1).padStart(2,'0')+' / daily intelligence</p><h2>'+esc(s.title)+'</h2><p class="opening">'+esc(s.opening)+'</p>'+s.blocks.map(b=>renderBlock(b,sources)).join('')+'</section>').join('');
 const ledger=e.sources.length?e.sources.map(s=>'<li><b>'+esc(s.id)+' · '+esc(s.publisher)+'</b> · '+esc(s.status)+' · '+esc(s.publishedAt)+' · '+esc(s.period||'No period')+'<br/><a href="'+esc(httpsUrl(s.url))+'" rel="noopener noreferrer" target="_blank">'+esc(s.title)+'</a></li>').join(''):'<li>No independently source-qualified receipts attached to this private unreviewed preview. This is a formatting surface, not a factual source certificate.</li>';
 const clickJs='(function(){document.addEventListener("click",function(ev){var b=ev.target.closest("[data-load-x]");if(!b)return;var url=b.getAttribute("data-load-x");if(!/^https:\\/\\/(?:www\\.)?(?:x\\.com|twitter\\.com)\\/[A-Za-z0-9_]{1,15}\\/status\\/\\d+\\/?$/.test(url))return;var frame=b.parentElement.querySelector(".x-native");if(!frame||frame.firstChild)return;var q=document.createElement("blockquote");q.className="twitter-tweet";q.setAttribute("data-dnt","true");var a=document.createElement("a");a.href=url;a.textContent="Read original post";q.appendChild(a);frame.appendChild(q);var script=document.querySelector("script[data-x-widget]");if(!script){script=document.createElement("script");script.src="https://platform.twitter.com/widgets.js";script.async=true;script.dataset.xWidget="1";document.head.appendChild(script);script.addEventListener("load",function(){window.twttr?.widgets?.load(frame);});}else window.twttr?.widgets?.load(frame);b.textContent="Embed requested";b.disabled=true;});})();';
 return '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>'+esc(e.title)+' | Bluebelly Private</title><style>'+CSS+'</style></head><body>'+
  '<div class="layout"><nav aria-label="Report contents"><b>BLUEBELLY</b><div class="toc">'+toc+'</div></nav><article data-private-reader-v4="true" data-snapshot-sha256="'+e.snapshotSha256+'">'+
  '<header><div class="kicker">Private Daily Intelligence · '+esc(e.reportDay)+'</div><h1>'+esc(e.title)+'</h1><p class="deck">'+esc(e.deck)+'</p><p class="meta">Edition '+esc(e.editionId)+' · As of '+esc(e.asOf)+'</p>'+
  '<p class="status">'+(e.status==='OWNER_REVIEWED'?'Owner-reviewed private edition':'Private unapproved draft; not public')+'</p></header>'+
  '<section id="executive"><p class="kicker">Five-minute orientation</p><h2>The essential argument</h2><p class="opening">'+esc(e.executiveSummary)+'</p></section>'+
  sections+'<section id="sources"><h2>Evidence and source ledger</h2><ul class="sources">'+ledger+'</ul></section></article></div><script>'+clickJs+'</script></body></html>';
}
