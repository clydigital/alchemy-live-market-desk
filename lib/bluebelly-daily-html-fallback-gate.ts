/**
 * Deliberate opt-in for the legacy, model-assisted owner-only HTML fallback.
 * Research Gap itself stays scheduled and active. A shared/global research
 * schedule flag is NOT permission to produce an extra Daily Intelligence.
 *
 * The public-facing Daily Intelligence UI was retired in PR #1364 and all
 * observed recent editions came from CHATGPT_WORK (zero SCHEDULED_RESEARCH).
 * Re-enable only after a concrete consumer, cost and acceptance review.
 */
export function scheduledDailyHtmlFallbackEnabled(
 env:Readonly<Record<string,string|undefined>>,
):boolean{
 return env.BLUEBELLY_DAILY_HTML_FALLBACK_ENABLED==="true" &&
  env.BLUEBELLY_DAILY_HTML_FALLBACK_DISABLED!=="true" &&
  env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED==="true";
}
