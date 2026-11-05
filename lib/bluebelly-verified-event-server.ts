import "server-only";
import {getCurrentVerifiedMarketMotion} from "./market-motion";
import {selectVerifiedNewsBriefs} from "./market-brief-news";
import {getOriginalPressNews} from "./blue-desk-original-press-news-server";
import {getCompletedOfficialMacroNews} from "./blue-desk-canonical-macro-news-server";
import {combineQualifiedNews} from "./blue-desk-qualified-news";
import {projectVerifiedMarketEvents,type EventSource,type SourceReadState} from "./bluebelly-verified-event-read-model";

/**
 * Reads three EXISTING independently source-qualified news paths. It never
 * consumes unverified intake/creator leads or changes their publication state.
 * A provider failure is visible as degraded coverage, not an empty news day.
 */
export async function readBluebellyQualifiedNews(now=new Date(),limit=18) {
  const [motion,press,macro]=await Promise.allSettled([
    getCurrentVerifiedMarketMotion({limit:24}),
    getOriginalPressNews(now,18,7),
    getCompletedOfficialMacroNews(now,18,7),
  ]);
  const sourceReads:Record<EventSource,SourceReadState>={
    motion:motion.status==="fulfilled"?"READABLE":"UNAVAILABLE",
    originalPress:press.status==="fulfilled"?"READABLE":"UNAVAILABLE",
    officialMacro:macro.status==="fulfilled"?"READABLE":"UNAVAILABLE",
  };
  const verifiedMotion=motion.status==="fulfilled"
    ? selectVerifiedNewsBriefs(motion.value,now,18):[];
  const verifiedOriginal=press.status==="fulfilled"?press.value:[];
  const verifiedMacro=macro.status==="fulfilled"?macro.value:[];
  const qualified=combineQualifiedNews(verifiedMotion,[...verifiedOriginal,...verifiedMacro],Math.max(1,Math.min(18,limit)));
  return {news:qualified,sourceReads};
}

/** Both the owner event API and public Newsroom consume this exact source
 * qualification and dedupe path. The API then applies its extra event DTO. */
export async function getBluebellyVerifiedEvents(
  now=new Date(),
  options:{since?:string;limit?:number}={},
) {
  const {news,sourceReads}=await readBluebellyQualifiedNews(now,18);
  return projectVerifiedMarketEvents(news,now,{...options,sourceReads});
}
