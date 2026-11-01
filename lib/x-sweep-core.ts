/**
 * Bounded X discovery contract. MacroPulse owns the actual source retrieval.
 * This module NEVER fetches X, proves a claim or writes canonical evidence.
 */
export type XSweepSettings = {
  sweep: "x";
  preset: "normal" | "custom";
  lookbackHours: number;
  overlapMinutes: number;
  maxCandidatesPerRun: number;
  softLimitPerAccount: number;
  recoveryLookbackHours: number;
  deepInvestigationsCap: number;
  schedule: "existing MacroPulse only";
  newScheduledTask: false;
};

export const X_SWEEP_DEFAULTS: XSweepSettings = Object.freeze({
  sweep: "x",
  preset: "normal",
  lookbackHours: 2.5,
  overlapMinutes: 30,
  maxCandidatesPerRun: 250,
  softLimitPerAccount: 40,
  recoveryLookbackHours: 72,
  deepInvestigationsCap: 12,
  schedule: "existing MacroPulse only",
  newScheduledTask: false,
});

export const X_CORE_ROSTER = Object.freeze([
  { handle: "Bluekurtic", focus: "energy" },
  { handle: "HFI_Research", focus: "energy" },
  { handle: "OilandEnergy", focus: "energy" },
  { handle: "HormuzReport", focus: "hormuz" },
  { handle: "TheStudyofWar", focus: "geopolitics" },
  { handle: "Currentreport1", focus: "breaking" },
  { handle: "arena", focus: "markets" },
  { handle: "KobeissiLetter", focus: "macro" },
  { handle: "FirstSquawk", focus: "breaking" },
  { handle: "zerohedge", focus: "global-news" },
  { handle: "TGLetter", focus: "civil-resilience" },
  { handle: "macropaperr", focus: "cross-asset" },
] as const);
// 30 Oct owner override restores ZeroHedge and adds TGLetter; GordianKnotDev remains excluded.
export const X_WIRE_EXCLUDED_HANDLES = Object.freeze(["gordianknotdev"] as const);
export function isExcludedXWireHandle(handle: string): boolean {
  return X_WIRE_EXCLUDED_HANDLES.some(blocked =>
    blocked === handle.trim().replace(/^@/, "").toLowerCase());
}
// Focus is a discovery grouping, never identity verification or a reliability tier.

function bounded(name: string, value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error("Invalid X sweep " + name);
  }
  return value;
}

export function configureXSweep(input: Partial<XSweepSettings> = {}): XSweepSettings {
  if (input.sweep !== undefined && input.sweep !== "x") throw new Error("Unsupported sweep");
  if (input.newScheduledTask !== undefined && input.newScheduledTask !== false) throw new Error("No new scheduler permitted");
  if (input.schedule !== undefined && input.schedule !== "existing MacroPulse only") throw new Error("Must use existing MacroPulse");
  if (input.preset !== undefined && !["normal", "custom"].includes(input.preset)) throw new Error("Unsupported X preset");
  const value = { ...X_SWEEP_DEFAULTS, ...input };
  bounded("lookbackHours", value.lookbackHours, 1, 168);
  bounded("overlapMinutes", value.overlapMinutes, 0, 120);
  bounded("maxCandidatesPerRun", value.maxCandidatesPerRun, 1, 600);
  bounded("softLimitPerAccount", value.softLimitPerAccount, 1, 100);
  bounded("recoveryLookbackHours", value.recoveryLookbackHours, 1, 168);
  bounded("deepInvestigationsCap", value.deepInvestigationsCap, 0, 12);
  if (value.recoveryLookbackHours < value.lookbackHours) throw new Error("Recovery window shorter than normal window");
  for (const name of ["overlapMinutes", "maxCandidatesPerRun", "softLimitPerAccount", "recoveryLookbackHours", "deepInvestigationsCap"] as const) {
    if (!Number.isInteger(value[name])) throw new Error("X sweep " + name + " must be an integer");
  }
  return value;
}

function timestamp(value: string) {
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error("Missing time zone");
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error("Invalid timestamp");
  return time;
}

export function xSweepWindow(nowIso: string, lastSuccessfulCheckAt: string | null, settings: XSweepSettings = X_SWEEP_DEFAULTS) {
  const now = timestamp(nowIso);
  const last = lastSuccessfulCheckAt ? timestamp(lastSuccessfulCheckAt) : null;
  if (last !== null && last > now + 300_000) throw new Error("Future X checkpoint");
  const uncoveredHours = last === null ? null : Math.max(0, now - last) / 3_600_000 + settings.overlapMinutes / 60;
  const requestedHours = Math.max(settings.lookbackHours, uncoveredHours ?? 0);
  const actualHours = Math.min(settings.recoveryLookbackHours, requestedHours);
  return {
    startAt: new Date(now - actualHours * 3_600_000).toISOString(),
    endAt: new Date(now).toISOString(),
    checkpointAvailable: last !== null,
    hasUncoveredGap: uncoveredHours !== null && uncoveredHours > settings.recoveryLookbackHours,
    windowHours: actualHours,
  };
}

export function normaliseXPostUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Invalid X post URL"); }
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Only public HTTPS X post URLs");
  if (!["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"].includes(url.hostname.toLowerCase())) {
    throw new Error("Not an X post host");
  }
  const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d{6,25})\/?$/);
  if (!match) throw new Error("Not a direct X status URL");
  return { handle: match[1], postId: match[2], url: "https://x.com/" + match[1] + "/status/" + match[2] };
}

export type XCandidate = {
  postUrl: string;
  accountHandle: string;
  publishedAt: string | null;
  retrievedAt: string;
  importance: number; // a research priority supplied by a reviewer, NOT popularity or claim truth
  type?: "post" | "repost" | "quote";
  investigate?: boolean;
};
export type XQueueRow = XCandidate & { canonicalUrl: string; postId: string };

export function selectXSweepCandidates(
  rows: XCandidate[],
  nowIso: string,
  settings: XSweepSettings = X_SWEEP_DEFAULTS,
  lastSuccessfulCheckAt: string | null = null,
) {
  const window = xSweepWindow(nowIso, lastSuccessfulCheckAt, settings);
  const min = Date.parse(window.startAt), max = Date.parse(window.endAt);
  const valid: XQueueRow[] = [];
  const withheld: Array<{ item: XCandidate; reason: string }> = [];
  const ids = new Set<string>();
  for (const item of rows) {
    try {
      const post = normaliseXPostUrl(item.postUrl);
      if (isExcludedXWireHandle(post.handle) || isExcludedXWireHandle(item.accountHandle)) {
        withheld.push({ item, reason: "excluded_x_wire_source" });
        continue;
      }
      if (post.handle.toLowerCase() !== item.accountHandle.replace(/^@/, "").toLowerCase()) {
        withheld.push({ item, reason: "account_identity_mismatch" });
        continue;
      }
      const published = item.publishedAt ? timestamp(item.publishedAt) : NaN;
      timestamp(item.retrievedAt);
      if (!Number.isFinite(published)) { withheld.push({ item, reason: "unknown_publication_time" }); continue; }
      if (published < min || published > max + 300_000) { withheld.push({ item, reason: "outside_window" }); continue; }
      if (item.type === "repost") { withheld.push({ item, reason: "bare_repost" }); continue; }
      if (ids.has(post.postId)) { withheld.push({ item, reason: "duplicate_post_id" }); continue; }
      if (!Number.isFinite(item.importance) || item.importance < 0 || item.importance > 100) {
        withheld.push({ item, reason: "invalid_priority" }); continue;
      }
      ids.add(post.postId);
      valid.push({ ...item, postId: post.postId, canonicalUrl: post.url });
    } catch {
      withheld.push({ item, reason: "invalid_source" });
    }
  }
  valid.sort((a, b) => b.importance - a.importance || Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!));
  const usedByAccount = new Map<string, number>();
  const selected: XQueueRow[] = [];
  const deferred: XQueueRow[] = [];
  for (const item of valid) {
    const key = item.accountHandle.replace(/^@/, "").toLowerCase();
    const count = usedByAccount.get(key) ?? 0;
    if (selected.length >= settings.maxCandidatesPerRun || count >= settings.softLimitPerAccount) {
      deferred.push(item);
      continue;
    }
    usedByAccount.set(key, count + 1);
    selected.push(item);
  }
  return {
    window,
    selected,
    // Deferred rows must remain in the existing backlog; never advance an account cursor past them.
    deferred,
    withheld,
    deepInvestigationCandidates: selected.filter(item => item.investigate === true).slice(0, settings.deepInvestigationsCap),
    limitReached: deferred.length > 0,
  };
}

export type XAccountAttempt = {
  handle: string;
  status: "healthy" | "partial" | "blocked" | "unavailable" | "unconfigured";
  attemptedAt: string;
  lastSuccessAt: string | null;
  lastObservedPostAt: string | null;
  fetched: number;
  newPosts: number;
  error: string | null;
};

export function xSourceHealth(attempts: XAccountAttempt[]) {
  return {
    monitored: X_CORE_ROSTER.length,
    attempted: attempts.length,
    healthy: attempts.filter(item => item.status === "healthy").length,
    partial: attempts.filter(item => item.status === "partial").length,
    inaccessible: attempts.filter(item => ["blocked", "unavailable", "unconfigured"].includes(item.status)).length,
    // A failed retrieval is NOT evidence that an account has zero new posts.
    complete: attempts.length === X_CORE_ROSTER.length && attempts.every(item => item.status === "healthy"),
  };
}
