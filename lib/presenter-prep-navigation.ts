/** Only Journey context keys may cross into optional Presenter Prep. */
export function presenterPrepHref(activePath: string, queryString: string): string {
  const base = "/hybrid-output/prepare";
  if (activePath !== "/hybrid-output" && activePath !== base) return base;
  const incoming = new URLSearchParams(queryString);
  const safe = new URLSearchParams();
  for (const key of ["edition", "story", "motion", "regime", "event"] as const) {
    // Preserve duplicate keys so Prep's fail-closed parser can reject ambiguity.
    for (const value of incoming.getAll(key)) safe.append(key, value);
  }
  return safe.size ? base + "?" + safe.toString() : base;
}
