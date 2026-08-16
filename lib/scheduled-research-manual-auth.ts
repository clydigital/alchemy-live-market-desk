import { acceptsResearchAuthorization } from "./research-auth.ts";

/**
 * Promotes the existing manual research credential to the internal cron
 * credential at the primary scheduled route boundary. This lets an explicitly
 * authorised manual workflow exercise the exact scheduled code path (including
 * audited retry identities) without exposing CRON_SECRET outside Vercel.
 *
 * Watchdog routes do not use this bridge and remain CRON_SECRET-only.
 */
export function promoteManualScheduledResearchAuthorization(
  request: Request,
  input: {
    manualToken?: string | null;
    cronSecret?: string | null;
  } = {
    manualToken: process.env.RESEARCH_UPDATE_TOKEN,
    cronSecret: process.env.CRON_SECRET,
  },
) {
  const manualToken = input.manualToken?.trim();
  const cronSecret = input.cronSecret?.trim();
  if (!manualToken || !cronSecret) return request;

  if (!acceptsResearchAuthorization(request.headers.get("authorization"), [manualToken])) {
    return request;
  }

  const headers = new Headers(request.headers);
  headers.set("authorization", `Bearer ${cronSecret}`);
  return new Request(request, { headers });
}
