/**
 * Historical, immutable *commentary* recovery for consecutive zero-change editions.
 * Never treats earlier Stories as current publication or as new evidence.
 */
export const MAX_ZERO_CHANGE_DOSSIER_CONTEXT_AGE_MS = 5 * 24 * 60 * 60 * 1000;
export const MAX_ZERO_CHANGE_EDITION_LOOKBACK = 32;

export function nearestImmutableDossierContext<T>(
  rows: Array<{ published_at: string; payload: Record<string, unknown> }>,
  generatedAt: string,
  exactReasoningSources: (payload: Record<string, unknown>) => T[],
): { sources: T[]; publishedAt: string } | null {
  const asOf = Date.parse(generatedAt);
  if (!Number.isFinite(asOf)) return null;
  const ordered = [...rows].sort(
    (a, b) => Date.parse(b.published_at) - Date.parse(a.published_at),
  );
  for (const row of ordered.slice(0, MAX_ZERO_CHANGE_EDITION_LOOKBACK)) {
    const publishedAt = Date.parse(row.published_at);
    if (!Number.isFinite(publishedAt)
      || publishedAt > asOf
      || asOf - publishedAt > MAX_ZERO_CHANGE_DOSSIER_CONTEXT_AGE_MS
    ) continue;
    const sources = exactReasoningSources(row.payload);
    if (sources.length) return { sources, publishedAt: row.published_at };
  }
  return null;
}
