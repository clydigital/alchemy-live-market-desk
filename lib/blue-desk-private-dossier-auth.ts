import { acceptsResearchAuthorization } from "./research-auth.ts";

/**
 * P−1c machine-to-machine Dossier read token, not an owner login or public API key.
 * A dedicated random secret must be provisioned separately in Live and Hybrid.
 * No fallback to CRON_SECRET, RESEARCH_UPDATE_TOKEN or public Supabase keys.
 */
export const MIN_HYBRID_DOSSIER_TOKEN_LENGTH = 32;

export function hybridDossierReadConfigured(token: string | undefined | null): boolean {
  return typeof token === "string" && token.length >= MIN_HYBRID_DOSSIER_TOKEN_LENGTH
    && token.trim() === token && !/\s/.test(token);
}

export function acceptsHybridDossierRead(
  authorization: string | null,
  configuredToken: string | undefined | null,
): boolean {
  if (!hybridDossierReadConfigured(configuredToken)) return false;
  if (!authorization || !/^Bearer [^\s]+$/.test(authorization)) return false;
  return acceptsResearchAuthorization(authorization, [configuredToken]);
}
