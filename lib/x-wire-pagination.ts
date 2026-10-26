import { isExcludedXWireHandle, normaliseXPostUrl } from "./x-sweep-core.ts";
import type { XWirePost } from "./x-wire-provider.ts";

/** Pure FxEmbed page parser. External metadata is untrusted discovery, never proof. */
type Rec = Record<string, unknown>;
const rec = (x: unknown): Rec => x && typeof x === "object" && !Array.isArray(x) ? x as Rec : {};
const text = (x: unknown, n = 2000) => typeof x === "string" ? x.trim().slice(0,n) : "";
function published(x: Rec) {
  const t = Date.parse(text(x.created_at, 100));
  if (Number.isFinite(t)) return new Date(t).toISOString();
  const raw = x.created_timestamp;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  const time = new Date(raw > 1e12 ? raw : raw * 1000);
  return Number.isFinite(time.getTime()) ? time.toISOString() : null;
}
export type FxPage = {
  posts: XWirePost[]; nextCursor: string | null;
  malformed: number; total: number; oldestAt: string | null;
};
/** Cursor is a provider-supplied opaque token; never interpolate it into a path. */
export function parseFxTimeline(json: unknown, handle: string, startAt: string, nowIso: string): FxPage {
  if (isExcludedXWireHandle(handle)) throw new Error("X Wire source explicitly excluded");
  const data = rec(json);
  if (data.code !== 200 || !Array.isArray(data.results) || data.results.length > 50)
    throw new Error("Unexpected X provider page");
  const oldestAt = data.results.reduce<string | null>((min, value) => {
    const date = published(rec(value)); return !date ? min : !min || date < min ? date : min;
  }, null);
  const posts: XWirePost[] = [];
  let malformed = 0;
  for (const raw of data.results) {
    const row=rec(raw), author=rec(row.author);
    const screen=text(author.screen_name,20), id=text(row.id,25), date=published(row), body=text(row.text);
    if (row.reposted_by || (date && Date.parse(date) < Date.parse(startAt))) continue;
    if (row.type !== "status" || screen.toLowerCase() !== handle.toLowerCase() ||
      !date || Date.parse(date) > Date.parse(nowIso) + 300_000 || !body) {malformed++;continue;}
    try {
      const normalized = normaliseXPostUrl("https://x.com/"+screen+"/status/"+id);
      const quote=rec(row.quote), qs=text(rec(quote.author).screen_name,20), qid=text(quote.id,25);
      let quoteUrl: string | null = null;
      try { if(qs && qid && !isExcludedXWireHandle(qs)) quoteUrl=normaliseXPostUrl("https://x.com/"+qs+"/status/"+qid).url; } catch { /* no invented quote */ }
      const photos=rec(row.media).photos;
      const images=Array.isArray(photos)?photos.map(p=>text(rec(p).url,600)).filter(v=>v.startsWith("https://")).slice(0,4):[];
      posts.push({id:normalized.postId,url:normalized.url,handle:screen,publishedAt:date,
        text:body,quoteUrl,images,attribution:"THIRD_PARTY_ONLY"});
    } catch {malformed++;}
  }
  const cursor=text(rec(data.cursor).bottom,2048);
  return { posts, nextCursor:cursor || null, malformed,total:data.results.length,oldestAt };
}

/** Resuming never advances a full-coverage checkpoint until the cursor is exhausted. */
export function xWireRequestWindow(nowIso:string, lastCompleteAt:string|null,
  cursor:string|null, startAt:string|null, lookbackHours=2.5, overlapMinutes=30, recoveryHours=72) {
  const now=Date.parse(nowIso);
  if(!Number.isFinite(now))throw new Error("Invalid now");
  if(cursor && startAt && Number.isFinite(Date.parse(startAt))) {
    const age=(now-Date.parse(startAt))/3_600_000;
    if(age>=0 && age<=recoveryHours)return {
      startAt:new Date(startAt).toISOString(),cursor,resumed:true,gap:false,
    };
    // An expired provider cursor cannot silently defeat the 72h recovery cap.
    return {startAt:new Date(now-recoveryHours*3_600_000).toISOString(),
      cursor:null,resumed:false,gap:true};
  }
  const elapsed = lastCompleteAt ? (now-Date.parse(lastCompleteAt))/3_600_000 : lookbackHours;
  if(!Number.isFinite(elapsed)||elapsed < 0)throw new Error("Invalid last complete");
  const wanted=Math.max(lookbackHours,elapsed+(lastCompleteAt?overlapMinutes/60:0));
  return {startAt:new Date(now-Math.min(recoveryHours,wanted)*3_600_000).toISOString(),
    cursor:null,resumed:false,gap:wanted>recoveryHours};
}
export function xWireNextState(nextCursor:string|null, pagesRead:number, pageLimit:number) {
  if(!nextCursor)return {complete:true,nextCursor:null};
  if(pagesRead>=pageLimit)return {complete:false,nextCursor};
  return {complete:false,nextCursor};
}
