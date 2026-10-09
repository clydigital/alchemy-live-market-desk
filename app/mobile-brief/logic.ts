/** Pure, read-only presentation logic for the mobile intelligence brief. */
export type Snapshot = {
  contractVersion: string;
  generatedAt?: string;
  dossier?: { status: string; dossierId: string; asOf: string; degraded: boolean };
  regime?: { headline: string; answer: string; regimeImplication: string; whatWouldChangeMind: string; rateRegime?: { state?: string } };
  monetarySignals?: { summary: string; confirming: string[]; contradicting: string[]; unresolved: string[] };
  marketState?: { selectedRows: Array<{ id: string; symbol: string; label: string; last: number | null; change5d: number | null; asOf: string | null }> };
  stories?: Array<{ id: string; persistentStoryId?: string | null; title: string; whatChanged: string; whyItMatters: string; mechanism: string; conclusion: string; whatWouldChangeMind: string; epistemicLabel: string; evidenceRefs: string[] }>;
  stockRadar?: unknown;
  contradictions?: Array<{ id: string; title: string; detail: string }>;
  researchGaps?: string[];
  guardrails?: string[];
  sourceHealth?: Record<string, string>;
};

type ResponseLike = { ok: boolean; status: number; json(): Promise<unknown> };

export type BriefLoadState = {
  snapshot: Snapshot | null;
  error: string | null;
  requestedAt: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateSnapshot(value: unknown): Snapshot {
  if (!isRecord(value) || value.contractVersion !== "market-intelligence-snapshot/v1" ||
      !isRecord(value.dossier) || typeof value.dossier.dossierId !== "string" || !value.dossier.dossierId.trim() ||
      typeof value.dossier.asOf !== "string" || !value.dossier.asOf.trim() ||
      !Number.isFinite(Date.parse(value.dossier.asOf)) ||
      !isRecord(value.regime) || typeof value.regime.headline !== "string" || !value.regime.headline.trim()) {
    throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
  }
  return value as Snapshot;
}

/** No fallback is synthesised. Failed refreshes retain only the prior verified in-session snapshot. */
export async function loadMobileSnapshot(
  previous: BriefLoadState,
  request: () => Promise<ResponseLike>,
  now: () => string = () => new Date().toISOString(),
): Promise<BriefLoadState> {
  try {
    const response = await request();
    if (!response.ok) {
      throw new Error(response.status === 503
        ? "No usable Dossier presentation is available."
        : `Snapshot unavailable (HTTP ${response.status}).`);
    }
    const snapshot = validateSnapshot(await response.json());
    return { snapshot, error: null, requestedAt: now() };
  } catch (cause) {
    return {
      snapshot: previous.snapshot,
      requestedAt: previous.requestedAt,
      error: cause instanceof Error ? cause.message : "Unable to load the snapshot.",
    };
  }
}

export function formatBriefDate(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Unknown";
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function dossierWarnings(snapshot: Snapshot | null, nowMs: number): { stale: boolean; degraded: boolean } {
  const asOf = snapshot?.dossier?.asOf ? Date.parse(snapshot.dossier.asOf) : NaN;
  return {
    stale: !Number.isFinite(asOf) || nowMs - asOf > 24 * 60 * 60 * 1000,
    degraded: Boolean(snapshot?.dossier?.degraded || (snapshot?.dossier?.status && snapshot.dossier.status !== "current")),
  };
}

export function formatMarketLast(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "n/a";
}

export function formatMarketChange(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}%` : "n/a";
}

export function formatObservationDate(value: unknown): string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : "unknown";
}

export function evidenceCount(refs: unknown): string {
  return Array.isArray(refs) ? String(refs.length) : "not supplied";
}

export function snapshotRows(snapshot: Snapshot): NonNullable<Snapshot["marketState"]>["selectedRows"] {
  return Array.isArray(snapshot.marketState?.selectedRows) ? snapshot.marketState.selectedRows : [];
}

export function snapshotStories(snapshot: Snapshot): NonNullable<Snapshot["stories"]> {
  return Array.isArray(snapshot.stories) ? snapshot.stories.filter(isRecord) as NonNullable<Snapshot["stories"]> : [];
}

export function snapshotHealth(snapshot: Snapshot): Array<[string, string]> {
  return isRecord(snapshot.sourceHealth)
    ? Object.entries(snapshot.sourceHealth).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    : [];
}
