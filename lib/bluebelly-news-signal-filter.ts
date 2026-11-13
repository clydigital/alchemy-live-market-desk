import type {NewsBriefV1} from "./market-brief-news.ts";
import {SIGNAL_TAGS,suggestSignalTags,type SignalTagId,type SignalTag} from "./bluebelly-signal-tags.ts";

/** Only already source-qualified NewsBriefs are eligible for this UI filter.
 * The tags are hypothetical research classifications, not verification.
 */
export type NewsSignalFilter=SignalTagId|"all";
export function normaliseNewsSignalFilter(value:unknown):NewsSignalFilter{
 if(typeof value!=="string")return "all";
 return SIGNAL_TAGS.some(tag=>tag.id===value)?value as SignalTagId:"all";
}
export function newsResearchTags(news:Pick<NewsBriefV1,"headline"|"summary">):SignalTag[]{
 return suggestSignalTags({title:news.headline,detail:news.summary,evidence:"SOURCE_ONLY_NEWS"});
}
export function filterNewsBySignal<T extends Pick<NewsBriefV1,"headline"|"summary">>(
 news:readonly T[],signal:NewsSignalFilter,
):T[]{
 if(signal==="all")return [...news];
 return news.filter(item=>newsResearchTags(item).some(tag=>tag.id===signal));
}
