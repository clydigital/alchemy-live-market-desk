export type Alignment = "unassessed" | "aligned" | "diverging" | "mixed";

export type PresenterCheckItem = {
  key: string;
  title: string;
  group: "Core" | "Additional";
  technical: string;
  lastBreak: string;
  observedOn: string;
  fundamentals: string;
  alignment: Alignment;
  evidenceUrl: string;
  notes: string;
  updatedAt: string;
};

export type PresenterHistoryLog = {
  key: string;
  title: string;
  technical: string;
  alignment: Alignment;
  observedOn: string;
  updatedAt: string;
};

export type PresenterChecklistPayload = {
  contractVersion: string;
  checks: PresenterCheckItem[];
  history: PresenterHistoryLog[];
  revision: number;
  updatedAt: string;
};

export const CONTRACT_VERSION = "technical-checks/2";

export type MonitorSpec = {
  key: string;
  title: string;
  group: "Core" | "Additional";
};

export const MONITOR_SPECS: readonly MonitorSpec[] = [
  { key: "dxy-4h", title: "DXY · 4H EMA20 ± 1σ band", group: "Core" },
  { key: "dxy-1d", title: "DXY · 1D EMA20 ± 1σ band", group: "Core" },
  { key: "jxy", title: "JXY · Yen strength / weakness", group: "Core" },
  { key: "us02y-30y", title: "US02Y–US30Y · Yield spread · GOLD IDEA", group: "Core" },
  { key: "spx-log-channel-rollover", title: "SPX RISING LOG CHANNEL IDEA + ROLLOVER IDEA", group: "Core" },
  { key: "us10y-real", title: "US10Y real yield · Duration pressure", group: "Additional" },
  { key: "hy-credit", title: "US high-yield credit spreads · Stress", group: "Additional" },
  { key: "vix", title: "VIX · Volatility regime", group: "Additional" },
  { key: "equity-breadth", title: "SPX / NDX · Trend and market breadth", group: "Additional" },
  { key: "gold", title: "Gold · Yield and dollar sensitivity", group: "Additional" },
  { key: "oil", title: "Oil · Inflation and supply risk", group: "Additional" },
  { key: "move-vix", title: "MOVE–VIX · Rates-to-equity volatility transmission", group: "Additional" },
  { key: "copper-gold", title: "Copper/Gold · Cyclical growth impulse", group: "Additional" },
];

export const KNOWN_KEYS = new Set(MONITOR_SPECS.map((s) => s.key));

export const VALID_STATUSES = new Set([
  "Not checked",
  "Holding uptrend",
  "Holding downtrend",
  "Upper-band break",
  "Lower-band break",
  "Strengthening",
  "Weakening",
  "Recovering",
  "Deteriorating",
  "Rangebound",
  "Mixed",
  "Rising channel intact",
  "Rollover watch",
  "Rollover confirmed",
]);

export const VALID_BREAKS = new Set([
  "Not applicable",
  "Not checked",
  "UPPER",
  "LOWER",
]);

export const VALID_ALIGNMENTS = new Set<Alignment>([
  "unassessed",
  "aligned",
  "diverging",
  "mixed",
]);

function hasHtmlOrScriptInjection(text: string): boolean {
  if (!text) return false;
  if (/<[^>]*>/i.test(text)) return true;
  if (/javascript:/i.test(text)) return true;
  if (/data:/i.test(text)) return true;
  if (/vbscript:/i.test(text)) return true;
  if (/on\w+\s*=/i.test(text)) return true;
  return false;
}

export function isValidHttpsUrl(url: string): boolean {
  if (!url) return true; // empty URL is allowed
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (hasHtmlOrScriptInjection(url)) return false;
    return true;
  } catch {
    return false;
  }
}

export function isValidDateString(dateStr: string): boolean {
  if (!dateStr) return true; // empty date string is allowed
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parsed = new Date(dateStr + "T00:00:00Z");
  if (isNaN(parsed.getTime())) return false;
  // Strict civil date round-trip check to reject invalid calendar days like 2026-02-30
  if (parsed.toISOString().slice(0, 10) !== dateStr) return false;
  // Date must not be in future relative to server UTC today
  const todayIso = new Date().toISOString().slice(0, 10);
  if (dateStr > todayIso) return false;
  return true;
}

export function createDefaultPresenterChecklist(): PresenterChecklistPayload {
  return {
    contractVersion: CONTRACT_VERSION,
    checks: MONITOR_SPECS.map((spec) => ({
      key: spec.key,
      title: spec.title,
      group: spec.group,
      technical: spec.key.startsWith("dxy-") ? "Holding uptrend" : spec.key === "us02y-30y" ? "Recovering" : "Not checked",
      lastBreak: spec.key === "dxy-4h" ? "UPPER" : spec.key === "dxy-1d" ? "Not checked" : "Not applicable",
      observedOn: "",
      fundamentals: "",
      alignment: "unassessed",
      evidenceUrl: "",
      notes: "",
      updatedAt: "",
    })),
    history: [],
    revision: 0,
    updatedAt: "",
  };
}

export type ValidationResult =
  | { success: true; expectedRevision: number; checks: PresenterCheckItem[]; history: PresenterHistoryLog[] }
  | { success: false; error: string };

export function validateIncomingPutPayload(body: unknown): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { success: false, error: "Request payload must be a JSON object." };
  }

  const payload = body as Record<string, unknown>;

  if (
    typeof payload.expectedRevision !== "number" ||
    !Number.isInteger(payload.expectedRevision) ||
    payload.expectedRevision < 0
  ) {
    return { success: false, error: "expectedRevision must be a non-negative integer." };
  }

  if ("userId" in payload || "user_id" in payload) {
    return { success: false, error: "userId may not be supplied as an incoming field." };
  }

  if (!Array.isArray(payload.checks)) {
    return { success: false, error: "checks must be an array." };
  }

  // Exact 13 items required to prevent partial or empty save state wipes
  if (payload.checks.length !== 13) {
    return { success: false, error: "checks array must contain exactly 13 monitor items." };
  }

  const seenKeys = new Set<string>();
  const validatedChecks: PresenterCheckItem[] = [];

  for (let i = 0; i < payload.checks.length; i++) {
    const rawCheck = payload.checks[i];
    if (!rawCheck || typeof rawCheck !== "object" || Array.isArray(rawCheck)) {
      return { success: false, error: `Check item at index ${i} is invalid.` };
    }

    const check = rawCheck as Record<string, unknown>;

    if (typeof check.key !== "string" || !KNOWN_KEYS.has(check.key)) {
      return { success: false, error: `Unknown or invalid monitor key: '${String(check.key)}'.` };
    }

    if (seenKeys.has(check.key)) {
      return { success: false, error: `Duplicate key found: '${check.key}'.` };
    }
    seenKeys.add(check.key);

    const spec = MONITOR_SPECS.find((s) => s.key === check.key)!;

    if (typeof check.technical !== "string" || !VALID_STATUSES.has(check.technical)) {
      return { success: false, error: `Invalid technical status for '${check.key}': '${String(check.technical)}'.` };
    }

    if (typeof check.lastBreak !== "string" || !VALID_BREAKS.has(check.lastBreak)) {
      return { success: false, error: `Invalid lastBreak for '${check.key}': '${String(check.lastBreak)}'.` };
    }

    if (typeof check.alignment !== "string" || !VALID_ALIGNMENTS.has(check.alignment as Alignment)) {
      return { success: false, error: `Invalid alignment for '${check.key}': '${String(check.alignment)}'.` };
    }

    const observedOn = typeof check.observedOn === "string" ? check.observedOn.trim() : "";
    if (!isValidDateString(observedOn)) {
      return { success: false, error: `Invalid or future observedOn date for '${check.key}': '${check.observedOn}'.` };
    }

    const fundamentals = typeof check.fundamentals === "string" ? check.fundamentals.trim() : "";
    if (fundamentals.length > 600) {
      return { success: false, error: `fundamentals for '${check.key}' exceeds maximum length of 600 characters.` };
    }
    if (hasHtmlOrScriptInjection(fundamentals)) {
      return { success: false, error: `fundamentals for '${check.key}' contains disallowed HTML or script content.` };
    }

    const evidenceUrl = typeof check.evidenceUrl === "string" ? check.evidenceUrl.trim() : "";
    if (evidenceUrl && !isValidHttpsUrl(evidenceUrl)) {
      return { success: false, error: `evidenceUrl for '${check.key}' must be a valid https:// URL.` };
    }

    const notes = typeof check.notes === "string" ? check.notes.trim() : "";
    if (notes.length > 700) {
      return { success: false, error: `notes for '${check.key}' exceeds maximum length of 700 characters.` };
    }
    if (hasHtmlOrScriptInjection(notes)) {
      return { success: false, error: `notes for '${check.key}' contains disallowed HTML or script content.` };
    }

    const updatedAt = typeof check.updatedAt === "string" ? check.updatedAt.trim() : "";

    validatedChecks.push({
      key: check.key,
      title: spec.title,
      group: spec.group,
      technical: check.technical,
      lastBreak: check.lastBreak,
      observedOn,
      fundamentals,
      alignment: check.alignment as Alignment,
      evidenceUrl,
      notes,
      updatedAt,
    });
  }

  // Ensure every single known monitor key is present in the checks array
  if (seenKeys.size !== KNOWN_KEYS.size) {
    return { success: false, error: "checks array must contain all 13 required monitor keys." };
  }

  const validatedHistory: PresenterHistoryLog[] = [];
  if (payload.history !== undefined) {
    if (!Array.isArray(payload.history)) {
      return { success: false, error: "history must be an array." };
    }
    if (payload.history.length > 30) {
      return { success: false, error: "history array cannot exceed 30 items." };
    }

    for (let i = 0; i < payload.history.length; i++) {
      const rawLog = payload.history[i];
      if (!rawLog || typeof rawLog !== "object" || Array.isArray(rawLog)) {
        return { success: false, error: `History item at index ${i} is invalid.` };
      }

      const log = rawLog as Record<string, unknown>;
      if (typeof log.key !== "string" || !KNOWN_KEYS.has(log.key)) {
        return { success: false, error: `History item at index ${i} has unknown key: '${String(log.key)}'.` };
      }

      const spec = MONITOR_SPECS.find((s) => s.key === log.key)!;

      if (typeof log.technical !== "string" || !VALID_STATUSES.has(log.technical)) {
        return { success: false, error: `History item at index ${i} has invalid technical status.` };
      }

      if (typeof log.alignment !== "string" || !VALID_ALIGNMENTS.has(log.alignment as Alignment)) {
        return { success: false, error: `History item at index ${i} has invalid alignment.` };
      }

      const observedOn = typeof log.observedOn === "string" ? log.observedOn.trim() : "";
      if (!isValidDateString(observedOn)) {
        return { success: false, error: `History item at index ${i} has invalid observedOn date.` };
      }

      const updatedAt = typeof log.updatedAt === "string" ? log.updatedAt.trim() : "";

      validatedHistory.push({
        key: log.key,
        title: typeof log.title === "string" ? log.title : spec.title,
        technical: log.technical,
        alignment: log.alignment as Alignment,
        observedOn,
        updatedAt,
      });
    }
  }

  return {
    success: true,
    expectedRevision: payload.expectedRevision,
    checks: validatedChecks,
    history: validatedHistory,
  };
}

export function normalizePresenterChecklistTimestamps(
  incomingChecks: PresenterCheckItem[],
  existingChecks: PresenterCheckItem[] | null,
  incomingHistory: PresenterHistoryLog[],
  nowIso: string,
): { checks: PresenterCheckItem[]; history: PresenterHistoryLog[] } {
  const existingMap = new Map<string, PresenterCheckItem>();
  if (existingChecks) {
    for (const c of existingChecks) existingMap.set(c.key, c);
  }

  const checks = incomingChecks.map((incoming) => {
    const existing = existingMap.get(incoming.key);
    if (!existing) {
      return { ...incoming, updatedAt: incoming.observedOn ? nowIso : "" };
    }

    const isChanged =
      incoming.technical !== existing.technical ||
      incoming.lastBreak !== existing.lastBreak ||
      incoming.observedOn !== existing.observedOn ||
      incoming.fundamentals !== existing.fundamentals ||
      incoming.alignment !== existing.alignment ||
      incoming.evidenceUrl !== existing.evidenceUrl ||
      incoming.notes !== existing.notes;

    if (isChanged) {
      return { ...incoming, updatedAt: nowIso };
    }

    return { ...incoming, updatedAt: existing.updatedAt };
  });

  const history = incomingHistory.map((log) => ({
    ...log,
    updatedAt: log.updatedAt && !isNaN(Date.parse(log.updatedAt)) && log.updatedAt <= nowIso ? log.updatedAt : nowIso,
  })).slice(0, 30);

  return { checks, history };
}
