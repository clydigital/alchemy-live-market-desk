import { acceptsResearchAuthorization } from "./research-auth.ts";

export const MIN_LEGACY_EVIDENCE_TOKEN_LENGTH = 32;

/** Machine credential is separate from cron, Dossier, canonical feed and user JWTs. */
export function legacyEvidenceReadConfigured(token: string | null | undefined): boolean {
  return typeof token === "string" && token.length >= MIN_LEGACY_EVIDENCE_TOKEN_LENGTH
    && token.trim() === token && !/\s/.test(token);
}

export function acceptsLegacyEvidenceRead(
  bearer: string | null,
  configuredToken: string | null | undefined,
): boolean {
  return legacyEvidenceReadConfigured(configuredToken)
    && typeof bearer === "string"
    && /^Bearer [^\s]+$/.test(bearer)
    && acceptsResearchAuthorization(bearer, [configuredToken!]);
}
