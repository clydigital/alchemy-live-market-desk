import { handleScheduledResearch } from "@/lib/cron-research-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * PART C: Watchdog for evening research schedule.
 * Thin delegation to canonical handleScheduledResearch.
 * Invoked ~5 minutes after primary evening cron (21:15 → 21:20 MYT).
 * If primary completed/running/terminal, this safely no-ops.
 * If primary never invoked, this recovers with identical run-key/claim logic.
 *
 * SAME-FAILURE-DOMAIN RESILIENCE:
 * This shares Vercel cron delivery infrastructure with primary.
 * Does NOT eliminate Vercel platform latency risk; only provides
 * a small grace period to detect and retry failed primary invocation.
 */
export async function GET(request: Request) {
  return handleScheduledResearch(request, "evening");
}
