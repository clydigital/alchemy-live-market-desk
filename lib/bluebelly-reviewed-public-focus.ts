/** Previously used for the fixed November 1 Hormuz editorial promotion.
 * That one-off item has been retired in favour of the live Hormuz status view.
 * Keep the generic return contract while the existing Newsroom/Markets
 * consumers migrate; no stale geopolitical article is re-promoted.
 */
export type ReviewedPublicFocus={
  id:string;eventDay:string;headline:string;fact:string;why:string;
  mechanism:string;test:string;sourceName:string;sourceUrl:string;
  href:string;assets:readonly string[];topics:readonly string[];
};
export function currentReviewedPublicFocus(_now:Date):ReviewedPublicFocus[]{
  return [];
}
export function reviewedFocusIsRecent(eventDay:string,now:Date){
  const at=now.getTime(),day=Date.parse(eventDay+"T00:00:00.000Z");
  return Number.isFinite(at)&&Number.isFinite(day)&&at>=day&&at-day<48*3600000;
}
