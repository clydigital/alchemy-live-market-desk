type ProviderCheck = { status: string };

/**
 * A persisted transcript proves only that a past video was retrieved. It must
 * not override a discovery failure from the latest monitored YouTube cycle.
 */
export function youtubeDiscoveryHealthState(configured: boolean, checks: ProviderCheck[]) {
  if (!configured) return "not_configured";
  if (checks.some((check) => !["ok", "checked", "no_recent_videos"].includes(check.status))) {
    return "attention_required";
  }
  return checks.length ? "healthy" : "configured_unverified";
}
