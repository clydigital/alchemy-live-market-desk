import { acceptsResearchAuthorization } from "./research-auth.ts";

/**
 * Scoped Live → Hybrid canonical publication read. A dedicated token distinct
 * from LIVE_HYBRID_DOSSIER_READ_TOKEN, cron, owner and Supabase credentials.
 * Never log or expose this server-only value to a browser.
 */
export const MIN_CANONICAL_FEED_TOKEN_LENGTH = 32;

export function canonicalFeedReadConfigured(token: string | undefined | null): boolean {
  return typeof token === "string"
    && token.length >= MIN_CANONICAL_FEED_TOKEN_LENGTH
    && token.trim() === token
    && !/\s/.test(token);
}

export function acceptsCanonicalFeedRead(
  authorization: string | null,
  configuredToken: string | undefined | null,
): boolean {
  if (!canonicalFeedReadConfigured(configuredToken)) return false;
  if (!authorization || !/^Bearer [^\s]+$/.test(authorization)) return false;
  return acceptsResearchAuthorization(authorization, [configuredToken]);
}
