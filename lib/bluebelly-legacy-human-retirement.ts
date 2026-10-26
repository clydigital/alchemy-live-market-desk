/** Human-facing retirement mapping, intentionally NOT wired into request middleware yet.
 * Old machine endpoints never redirect; exact edition replay cannot silently
 * substitute the current report for a historical research edition.
 * Activation follows canonical PDF + Bluebelly owner-login acceptance.
 */
export const BLUEBELLY_HUMAN_ORIGIN = "https://bluebelly-desk.vercel.app";
export type RetirementSource = "live" | "hybrid";
export type LegacyRetirementResolution =
  | { state:"ready"; target:string; requiresOwner:boolean }
  | { state:"defer"; reason:"historical_edition_needs_exact_replay"|"owner_host_not_yet_proven" }
  | { state:"not_mapped" };

const LIVE_PUBLIC:Record<string,string> = {
 "/":"/", "/owner/live":"/", "/blue-desk":"/",
 "/markets":"/markets", "/owner/markets":"/markets",
 "/calendar":"/calendar", "/blue-desk/calendar":"/calendar",
 "/stories":"/key-stories", "/regimes":"/key-stories",
 "/dossier":"/daily-report", "/hybrid-output":"/daily-report",
 "/articles":"/daily-report", "/blue-desk/daily-report":"/daily-report",
 "/blue-desk/key-stories":"/key-stories",
};
const HYBRID_PUBLIC:Record<string,string> = {
 "/":"/", "/journey":"/daily-report", "/dossier":"/daily-report",
 "/markets":"/markets", "/tracking":"/key-stories",
 "/investigations":"/key-stories", "/history":"/daily-report",
 "/feed":"/", "/overview":"/", "/wire":"/",
};
/** Deny query-derived arbitrary destinations and all non-human API paths. */
export function resolveLegacyBluebellyHumanLink(
 source:RetirementSource,
 pathname:string,
 search:string="",
):LegacyRetirementResolution{
 if(typeof pathname!=="string"||pathname.length>300||!pathname.startsWith("/")
  ||pathname.startsWith("//")||/[\\%?#\u0000-\u001f]/.test(pathname)
  ||typeof search!=="string"||search.length>1024)return {state:"not_mapped"};
 if(pathname.startsWith("/api/")||pathname.startsWith("/auth/")
  ||pathname.startsWith("/_next/")||pathname.startsWith("/cron/")
  ||pathname==="/login")return {state:"not_mapped"};
 const query=new URLSearchParams(search.startsWith("?")?search.slice(1):search);
 // Exact historical editions, Story IDs and deep-linked focused evidence are
 // not compatible with a generic current report. Fail closed until tested.
 if(query.has("edition")||query.has("story")||query.has("motion")||
    query.has("regime")||query.has("event")||query.has("research_run")||
    query.has("dossier")||query.has("article")||pathname.startsWith("/story/")
    ||pathname.startsWith("/stories/")||pathname.startsWith("/investigations/")){
  return {state:"defer",reason:"historical_edition_needs_exact_replay"};
 }
 if(source==="live"&&["/owner/presenter","/owner/editorial","/owner/daily-report",
     "/hybrid-output/prepare"].includes(pathname)){
  return {state:"defer",reason:"owner_host_not_yet_proven"};
 }
 const paths=source==="live"?LIVE_PUBLIC:HYBRID_PUBLIC;
 const dest=Object.hasOwn(paths,pathname)?paths[pathname]:null;
 if(!dest)return {state:"not_mapped"};
 return {state:"ready",target:BLUEBELLY_HUMAN_ORIGIN+dest,requiresOwner:false};
}
