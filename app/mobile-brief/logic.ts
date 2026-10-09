/** Read-only snapshot validation and presentation utilities. No market inference occurs here. */
export type Snapshot = {
  contractVersion: string;
  generatedAt?: string | null;
  dossier?: { status: string; dossierId: string; asOf: string; degraded: boolean };
  regime?: {
    headline: string;
    answer?: string | null;
    regimeImplication?: string | null;
    whatWouldChangeMind?: string | null;
    rateRegime?: { state?: string | null } | null;
  };
  monetarySignals?: { summary?: string; confirming?: string[]; contradicting?: string[]; unresolved?: string[] };
  marketState?: { selectedRows: Array<{ id: string; symbol: string; label: string; last: number | null; change5d: number | null; asOf: string | null; sourceName?: string; sourceUrl?: string }> };
  stories?: Array<{ id: string; persistentStoryId?: string | null; title: string; whatChanged?: string; whyItMatters?: string; mechanism?: string; conclusion?: string; whatWouldChangeMind?: string; epistemicLabel?: string; evidenceRefs?: string[] }>;
  stockRadar?: unknown;
  contradictions?: Array<{ id: string; title: string; detail: string }>;
  researchGaps?: string[];
  guardrails?: string[];
  sourceHealth?: Record<string, string> | null;
};

export type SectionState<T> =
  | { status: "not_supplied" }
  | { status: "empty" }
  | { status: "has_entries"; items: T[] };

export function getSectionState<T>(items: T[] | null | undefined): SectionState<T> {
  if (items === undefined || items === null) {
    return { status: "not_supplied" };
  }
  if (items.length === 0) {
    return { status: "empty" };
  }
  return { status: "has_entries", items };
}

type ResponseLike = { ok: boolean; status: number; json(): Promise<unknown> };

export type BriefLoadState = {
  snapshot: Snapshot | null;
  error: string | null;
  requestedAt: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Reject a new invalid response; never replace a previously verified Dossier with it. */
export function validateSnapshot(value: unknown): Snapshot {
  if (!isRecord(value) ||
      value.contractVersion !== "market-intelligence-snapshot/v1" ||
      !isRecord(value.dossier) ||
      typeof value.dossier.status !== "string" ||
      !value.dossier.status.trim() ||
      typeof value.dossier.dossierId !== "string" ||
      !value.dossier.dossierId.trim() ||
      typeof value.dossier.asOf !== "string" ||
      !value.dossier.asOf.trim() ||
      !Number.isFinite(Date.parse(value.dossier.asOf)) ||
      typeof value.dossier.degraded !== "boolean" ||
      !isRecord(value.regime) ||
      typeof value.regime.headline !== "string" ||
      !value.regime.headline.trim()) {
    throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
  }

  if (value.generatedAt !== undefined && value.generatedAt !== null) {
    if (typeof value.generatedAt !== "string" || !value.generatedAt.trim() || !Number.isFinite(Date.parse(value.generatedAt))) {
      throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
    }
  }

  if (value.regime.answer !== undefined && value.regime.answer !== null && typeof value.regime.answer !== "string") {
    throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
  }
  if (value.regime.regimeImplication !== undefined && value.regime.regimeImplication !== null && typeof value.regime.regimeImplication !== "string") {
    throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
  }
  if (value.regime.whatWouldChangeMind !== undefined && value.regime.whatWouldChangeMind !== null && typeof value.regime.whatWouldChangeMind !== "string") {
    throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
  }
  if (value.regime.rateRegime !== undefined && value.regime.rateRegime !== null) {
    if (!isRecord(value.regime.rateRegime)) {
      throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
    }
    if (value.regime.rateRegime.state !== undefined && value.regime.rateRegime.state !== null && typeof value.regime.rateRegime.state !== "string") {
      throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
    }
  }

  if (value.stories !== undefined && value.stories !== null) {
    if (!Array.isArray(value.stories)) {
      throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
    }
    for (const story of value.stories) {
      if (!isRecord(story) || typeof story.id !== "string" || typeof story.title !== "string") {
        throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
      }
      if (story.whatChanged !== undefined && story.whatChanged !== null && typeof story.whatChanged !== "string") {
        throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
      }
      if (story.whyItMatters !== undefined && story.whyItMatters !== null && typeof story.whyItMatters !== "string") {
        throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
      }
      if (story.mechanism !== undefined && story.mechanism !== null && typeof story.mechanism !== "string") {
        throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
      }
      if (story.conclusion !== undefined && story.conclusion !== null && typeof story.conclusion !== "string") {
        throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
      }
      if (story.whatWouldChangeMind !== undefined && story.whatWouldChangeMind !== null && typeof story.whatWouldChangeMind !== "string") {
        throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
      }
      if (story.epistemicLabel !== undefined && story.epistemicLabel !== null && typeof story.epistemicLabel !== "string") {
        throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
      }
      if (story.persistentStoryId !== undefined && story.persistentStoryId !== null && typeof story.persistentStoryId !== "string") {
        throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
      }
      if (story.evidenceRefs !== undefined && story.evidenceRefs !== null && !isStringArray(story.evidenceRefs)) {
        throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
      }
    }
  }

  if (value.contradictions !== undefined && value.contradictions !== null) {
    if (!Array.isArray(value.contradictions)) {
      throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
    }
    for (const contradiction of value.contradictions) {
      if (!isRecord(contradiction) || typeof contradiction.id !== "string" || typeof contradiction.title !== "string" || typeof contradiction.detail !== "string") {
        throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
      }
    }
  }

  if (value.researchGaps !== undefined && value.researchGaps !== null) {
    if (!isStringArray(value.researchGaps)) {
      throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
    }
  }

  if (value.guardrails !== undefined && value.guardrails !== null) {
    if (!isStringArray(value.guardrails)) {
      throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
    }
  }

  if (value.monetarySignals !== undefined && value.monetarySignals !== null) {
    if (!isRecord(value.monetarySignals)) {
      throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
    }
    if (value.monetarySignals.summary !== undefined && value.monetarySignals.summary !== null && typeof value.monetarySignals.summary !== "string") {
      throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
    }
    if (value.monetarySignals.confirming !== undefined && value.monetarySignals.confirming !== null && !isStringArray(value.monetarySignals.confirming)) {
      throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
    }
    if (value.monetarySignals.contradicting !== undefined && value.monetarySignals.contradicting !== null && !isStringArray(value.monetarySignals.contradicting)) {
      throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
    }
    if (value.monetarySignals.unresolved !== undefined && value.monetarySignals.unresolved !== null && !isStringArray(value.monetarySignals.unresolved)) {
      throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
    }
  }

  if (value.sourceHealth !== undefined && value.sourceHealth !== null) {
    if (!isRecord(value.sourceHealth)) {
      throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
    }
    for (const [provider, status] of Object.entries(value.sourceHealth)) {
      if (typeof provider !== "string" || !provider.trim() || typeof status !== "string" || !status.trim()) {
        throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
      }
    }
  }

  if (value.marketState !== undefined && value.marketState !== null) {
    if (!isRecord(value.marketState)) {
      throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
    }
    if (value.marketState.selectedRows !== undefined && value.marketState.selectedRows !== null) {
      if (!Array.isArray(value.marketState.selectedRows)) {
        throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
      }
      for (const row of value.marketState.selectedRows) {
        if (!isRecord(row) || typeof row.id !== "string" || typeof row.symbol !== "string" || typeof row.label !== "string") {
          throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
        }
        if (row.last !== undefined && row.last !== null && typeof row.last !== "number") {
          throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
        }
        if (row.change5d !== undefined && row.change5d !== null && typeof row.change5d !== "number") {
          throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
        }
        if (row.asOf !== undefined && row.asOf !== null && typeof row.asOf !== "string") {
          throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
        }
        if (row.sourceName !== undefined && row.sourceName !== null && typeof row.sourceName !== "string") {
          throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
        }
        if (row.sourceUrl !== undefined && row.sourceUrl !== null && typeof row.sourceUrl !== "string") {
          throw new Error("Incomplete or malformed snapshot contract. No new assessment shown.");
        }
      }
    }
  }

  return value as Snapshot;
}

/** A failed refresh retains only the prior verified in-session snapshot; no MacroPulse fallback. */
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

/** Dossier age is not the age of every provider observation. */
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

export function formatRegimeAnswer(value?: string | null): string {
  if (typeof value === "string" && value.length > 0) return value;
  return "Regime answer not supplied in this snapshot.";
}

export function formatRegimeImplication(value?: string | null): string {
  if (typeof value === "string" && value.length > 0) return value;
  return "Regime implication not supplied in this snapshot.";
}

export function formatWhatWouldChangeMind(value?: string | null): string {
  if (typeof value === "string" && value.length > 0) return value;
  return "Conditions to change mind not supplied in this snapshot.";
}

export function formatRateRegimeState(value?: string | null): string {
  if (typeof value === "string" && value.length > 0) return value;
  return "Not supplied";
}

export function formatObservationDate(value: unknown): string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : "unknown";
}

export function formatObservationLabel(value: unknown): string {
  const date = formatObservationDate(value);
  return date === "unknown" ? "Observation date unknown" : `Observed: ${date}`;
}

export function sanitizeSourceUrl(url?: string | null): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname || parsed.hostname.trim() === "") return null;
    if (parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function formatSourceName(sourceName?: string | null): string {
  if (typeof sourceName !== "string" || !sourceName.trim()) {
    return "Source not reported";
  }
  return sourceName.trim();
}

export function evidenceCount(refs: unknown): string {
  return Array.isArray(refs) ? String(refs.length) : "not supplied";
}

export function snapshotRows(snapshot: Snapshot): NonNullable<Snapshot["marketState"]>["selectedRows"] {
  return Array.isArray(snapshot.marketState?.selectedRows) ? snapshot.marketState.selectedRows : [];
}

export function snapshotStories(snapshot: Snapshot): NonNullable<Snapshot["stories"]> {
  return Array.isArray(snapshot.stories)
    ? snapshot.stories.filter(isRecord) as NonNullable<Snapshot["stories"]>
    : [];
}

export function snapshotHealth(snapshot: Snapshot): SectionState<[string, string]> {
  if (snapshot.sourceHealth === undefined || snapshot.sourceHealth === null) {
    return { status: "not_supplied" };
  }
  const entries = Object.entries(snapshot.sourceHealth);
  if (entries.length === 0) {
    return { status: "empty" };
  }
  return { status: "has_entries", items: entries };
}

export type BriefStatusInput = {
  loading: boolean;
  snapshot: Snapshot | null;
  error: string | null;
  hasRefreshed?: boolean;
};

export type BriefStatusResult = {
  srStatus: string;
  isAlert: boolean;
};

export function getMobileBriefStatus(input: BriefStatusInput): BriefStatusResult {
  const { loading, snapshot, error, hasRefreshed = false } = input;

  if (loading) {
    return {
      srStatus: snapshot || hasRefreshed ? "Refreshing market intelligence brief…" : "Loading market intelligence brief…",
      isAlert: false,
    };
  }

  if (error) {
    if (snapshot) {
      return {
        srStatus: `Latest refresh failed. Showing retained snapshot from this browser session, which may be out of date. ${error}`,
        isAlert: true,
      };
    }
    return {
      srStatus: `Live snapshot unavailable. ${error}`,
      isAlert: true,
    };
  }

  if (!snapshot) {
    return {
      srStatus: "No verified market assessment available.",
      isAlert: false,
    };
  }

  return {
    srStatus: hasRefreshed ? "Brief refreshed." : "Market intelligence brief loaded.",
    isAlert: false,
  };
}
