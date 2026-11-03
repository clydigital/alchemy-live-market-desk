import {createHash} from "node:crypto";
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");

/** A locally authored reader is source text, not evidence that its claims were
 * independently checked. Keep graphics and text, remove active content and
 * reject remote resources rather than shipping executable local HTML. */
export type ExistingHtmlInput={filename:string;html:string;supersedesId:string|null};
export type StaticHtmlEdition={
 title:string;reportDay:string;html:string;htmlSha256:string;contentSha256:string;
};
const forbidden=/<(?:iframe|object|embed|form|input|button|link|base|img|video|audio|source|picture|foreignobject)\b|<meta\b[^>]*http-equiv\s*=\s*["']?refresh\b|\bon[a-z]{3,}\s*=|javascript\s*:|@import\b|url\s*\(/i;
function realDay(value:string):boolean{
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(value))return false;
 const epoch=Date.parse(value+"T00:00:00.000Z");
 return Number.isFinite(epoch)&&new Date(epoch).toISOString().slice(0,10)===value;
}
function plainTitle(raw:string):string{
 return raw.replace(/<br\s*\/?>/gi," ").replace(/<[^>]*>/g," ")
  .replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
  .replace(/&nbsp;/gi," ").replace(/\s+/g," ").trim();
}
export function parseExistingHtmlEdition(raw:unknown):{input:ExistingHtmlInput;edition:StaticHtmlEdition}{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("INVALID_HTML_FILE");
 const o=raw as Record<string,unknown>;
 const filename=typeof o.filename==="string"?o.filename.trim():"";
 const source=typeof o.html==="string"?o.html:"";
 const supersedesId=o.supersedesId===null||o.supersedesId===undefined?null:o.supersedesId;
 if(!/^[^/\\\0]{1,180}\.html?$/i.test(filename)||
    (supersedesId!==null&&
     (typeof supersedesId!=="string"||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(supersedesId)))||
    source.length<1000||Buffer.byteLength(source,"utf8")>950000||
    !/^\s*<!doctype\s+html\s*>/i.test(source)||
    !/<html\b/i.test(source)||!/<head\b/i.test(source)||
    !/<body\b/i.test(source)||!/<\/html\s*>/i.test(source))
  throw Error("INVALID_HTML_FILE");
 const titleTag=source.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]||"";
 if(!/bluebelly/i.test(plainTitle(titleTag)))throw Error("NOT_BLUEBELLY_HTML");
 // Preserve in-document text and graphics, including existing timecoded
 // creator links and static tweet fallbacks. Original X widget script is
 // deliberately stripped because the archive is scriptless.
 const html=source.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,"");
 if(/<script\b|<\/script\b/i.test(html)||forbidden.test(html))
  throw Error("ACTIVE_HTML_NOT_ALLOWED");
 const heading=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i)?.[1]||"";
 const title=plainTitle(heading).slice(0,110);
 if(title.length<8)throw Error("HTML_TITLE_MISSING");
 const date=(filename+" "+plainTitle(titleTag)+" "+html.slice(0,20000))
  .match(/20\d{2}-\d{2}-\d{2}/)?.[0]||"";
 if(!realDay(date))throw Error("HTML_REPORT_DAY_MISSING");
 const htmlSha256=digest(html);
 const contentSha256=digest(JSON.stringify({
  kind:"BLUEBELLY_OWNER_IMPORTED_HTML_V1",reportDay:date,
  supersedesId,htmlSha256,
 }));
 return {input:{filename,html, supersedesId},edition:{
  title,reportDay:date,html,htmlSha256,contentSha256,
 }};
}

/** Work uploads arrive through an owner-scoped, service-only immutable inbox.
 * Unlike manual browser imports they need not include "Bluebelly" in the HTML
 * <title>, and their reporting day comes from the separately recorded session
 * metadata, never from the first (possibly historical) date in the article.
 *
 * Work HTML must already be STATIC: no script stripping, no byte mutation and
 * no networked/active elements are allowed. Preserve the exact stored SHA.
 */
export function validateDeliveredWorkHtmlEdition(raw:unknown):{
 reportDay:string;htmlSha256:string;
}{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("INVALID_WORK_HTML");
 const row=raw as Record<string,unknown>;
 const html=typeof row.html==="string"?row.html:"";
 const reportDay=typeof row.reportDay==="string"?row.reportDay:"";
 const receiptTitle=typeof row.title==="string"?row.title.trim():"";
 if(!realDay(reportDay)||receiptTitle.length<8||receiptTitle.length>110||
    html.length<1000||Buffer.byteLength(html,"utf8")>950000||
    !/^\s*<!doctype\s+html\s*>/i.test(html)||
    !/<html\b/i.test(html)||!/<head\b/i.test(html)||
    !/<body\b/i.test(html)||!/<\/html\s*>/i.test(html))
  throw Error("INVALID_WORK_HTML");
 const documentTitle=plainTitle(
  html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]||"");
 const heading=plainTitle(
  html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i)?.[1]||"");
 if(documentTitle.length<8||heading.length<8)
  throw Error("INVALID_WORK_HTML");
 // The same hostile-content denylist as manual HTML import; unlike that
 // browser-import path, even removable scripts invalidate a Work artifact.
 if(/<script\b|<\/script\b/i.test(html)||forbidden.test(html))
  throw Error("ACTIVE_WORK_HTML_NOT_ALLOWED");
 return {reportDay,htmlSha256:digest(html)};
}
