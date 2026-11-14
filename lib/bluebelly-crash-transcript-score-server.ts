import "server-only";
import {getPrivateReviewedCreatorArguments} from "./bluebelly-private-creator-reviews.ts";
import {emptyCrashTranscriptScore,scoreReviewedCrashTranscripts,
 type CrashTranscriptScore} from "./bluebelly-crash-transcript-score.ts";
import type {CrashWatchView} from "./bluebelly-crash-opportunity.ts";
import type {MarketCompassSummary} from "./bluebelly-market-compass.ts";

/** Privileged read stays server-side. Return only capped aggregates to the
 * public Crash page: no raw video transcript, title, creator logic, claims,
 * account identity, or private research notes are placed in page HTML.
 * Existing transcript worker ingests/reviews automatically; no new cron.
 */
export async function getCrashTranscriptScore(
 view:CrashWatchView,compass:MarketCompassSummary,now=new Date(),
):Promise<CrashTranscriptScore>{
 try{
  const reviews=await getPrivateReviewedCreatorArguments(now,10);
  return scoreReviewedCrashTranscripts(reviews,view,compass,now);
 }catch{
  return emptyCrashTranscriptScore("UNAVAILABLE");
 }
}
