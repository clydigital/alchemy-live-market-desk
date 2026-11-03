import {officialActualQuickPass} from "@/lib/macro/official-actual-quick-pass";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=120;

/** Existing Vercel CRON_SECRET only. No browser session, manual arbitrary ID,
 * research writer, source classification bypass or sixth ChatGPT schedule.
 */
export async function GET(request:Request){
 return officialActualQuickPass(request);
}
