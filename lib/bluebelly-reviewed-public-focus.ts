/**
 * Already-published, source-dated public editorial readers that can be
 * discovered across Today, Newsroom and Markets. Not a news intake, an
 * automatic research approval, a new canonical event or a live-price feed.
 * Date-only reporting stays date-only: never invent a publication clock.
 */
export const HORMUZ_MEDIATION_PUBLIC_FOCUS = {
  id:"hormuz-mediation-november-2026",
  eventDay:"2026-11-01",
  headline:"Iran proposes a two-day Hormuz reopening. Is there a deal?",
  fact:"Qatari mediators and Iran discussed a conditional two-day reopening plan on 1 November. The US has not confirmed acceptance, and a return to safe passage is not verified.",
  why:"The proposal could reduce disruption risk, but the negotiations have not restored shipping or refined-fuel supply.",
  mechanism:"A diplomatic breakthrough could ease oil's risk premium before physical supply recovers. Compare confirmed crossings, insurance availability and dated Brent and diesel readings; do not attribute a price move to the proposal alone.",
  test:"Look for documented US acceptance, actual multi-day ship crossings and safer insurance terms, then check whether diesel cracks and deliveries also ease.",
  sourceName:"Reuters · Doha mediation, 1 November 2026",
  sourceUrl:"https://www.reuters.com/world/middle-east/iranian-negotiators-doha-continue-talks-end-us-iran-war-official-says-2026-11-01/",
  href:"?feature=hormuz-mediation-november-2026",
  assets:["BRENT","WTI"],
  topics:["energy","policy"],
} as const;

/** A seven-day discovery shelf, not a rolling claim that this event is new. */
export function currentReviewedPublicFocus(now:Date){
  const at=now.getTime(), start=Date.parse("2026-11-01T00:00:00.000Z");
  return Number.isFinite(at)&&at>=start&&at<start+7*86400000
    ? [HORMUZ_MEDIATION_PUBLIC_FOCUS] : [];
}
/** An event can lead Today briefly; its historical reader stays accessible. */
export function reviewedFocusIsRecent(eventDay:string,now:Date){
  const at=now.getTime(),day=Date.parse(eventDay+"T00:00:00.000Z");
  return Number.isFinite(at)&&Number.isFinite(day)&&at>=day&&at-day<48*3600000;
}
