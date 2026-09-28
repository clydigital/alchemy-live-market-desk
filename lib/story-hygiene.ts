import type { StoryThesisVersion } from "./persistence/contracts.ts";

export type StoryCatalystStatus =
  | "missing"
  | "ongoing"
  | "upcoming"
  | "due"
  | "expired"
  | "resolved";

export type StoryCatalystAssessment = {
  status: StoryCatalystStatus;
  label: string | null;
  dueAt: string | null;
  expiresAt: string | null;
  explicitDate: string | null;
  recalibrationRequired: boolean;
  source: "canonical_next_test" | "legacy_label" | "none";
};

type CanonicalNextTestLike = {
  label?: unknown;
  status?: unknown;
  dueAt?: unknown;
  expiresAt?: unknown;
};

const MONTHS = "(January|February|March|April|May|June|July|August|September|October|November|December)";

function validIso(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function catalystTimestamp(label: string | null | undefined) {
  if (!label) return null;

  const iso = label.match(/\\b\\d{4}-\\d{2}-\\d{2}(?:[T ][0-9:.+\\-Z]+)?\\b/)?.[0];
  if (iso) {
    const parsed = Date.parse(iso);
    if (Number.isFinite(parsed)) return parsed;
  }

  const natural = label.match(new RegExp("\\b(\\d{1,2})\\s+" + MONTHS + "\\s+(\\d{4})\\b", "i"));
  if (!natural) return null;
  const parsed = Date.parse(natural[2] + " " + natural[1] + ", " + natural[3] + " 12:00:00 UTC");
  return Number.isFinite(parsed) ? parsed : null;
}

export function canonicalNextTestFromVersion(version: StoryThesisVersion | null | undefined): CanonicalNextTestLike | null {
  const reasoning = version?.snapshot?.canonicalStoryReasoning;
  if (!reasoning || typeof reasoning !== "object" || Array.isArray(reasoning)) return null;
  const nextTest = (reasoning as Record<string, unknown>).nextTest;
  return nextTest && typeof nextTest === "object" && !Array.isArray(nextTest)
    ? nextTest as CanonicalNextTestLike
    : null;
}

export function assessStoryCatalyst(input: {
  nextCatalyst: string | null | undefined;
  version?: StoryThesisVersion | null;
  now?: Date;
}): StoryCatalystAssessment {
  const nowMs = (input.now ?? new Date()).getTime();
  const canonical = canonicalNextTestFromVersion(input.version);
  const canonicalLabel = typeof canonical?.label === "string" && canonical.label.trim()
    ? canonical.label.trim()
    : null;
  const label = canonicalLabel || input.nextCatalyst?.trim() || null;

  if (!label) {
    return {
      status: "missing",
      label: null,
      dueAt: null,
      expiresAt: null,
      explicitDate: null,
      recalibrationRequired: false,
      source: "none",
    };
  }

  if (canonical) {
    const dueAt = validIso(canonical.dueAt);
    const expiresAt = validIso(canonical.expiresAt);
    const declared = typeof canonical.status === "string" ? canonical.status : null;

    if (declared === "resolved") {
      return {
        status: "resolved",
        label,
        dueAt,
        expiresAt,
        explicitDate: dueAt,
        recalibrationRequired: false,
        source: "canonical_next_test",
      };
    }

    if (declared === "expired" || (expiresAt && Date.parse(expiresAt) <= nowMs)) {
      return {
        status: "expired",
        label,
        dueAt,
        expiresAt,
        explicitDate: expiresAt || dueAt,
        recalibrationRequired: true,
        source: "canonical_next_test",
      };
    }

    if (dueAt) {
      const due = Date.parse(dueAt) <= nowMs;
      return {
        status: due ? "due" : "upcoming",
        label,
        dueAt,
        expiresAt,
        explicitDate: dueAt,
        recalibrationRequired: due,
        source: "canonical_next_test",
      };
    }

    if (declared === "due" || declared === "upcoming") {
      return {
        status: declared,
        label,
        dueAt,
        expiresAt,
        explicitDate: null,
        recalibrationRequired: declared === "due",
        source: "canonical_next_test",
      };
    }
  }

  const legacyMoment = catalystTimestamp(label);
  if (legacyMoment !== null) {
    const expired = legacyMoment <= nowMs;
    return {
      status: expired ? "expired" : "upcoming",
      label,
      dueAt: new Date(legacyMoment).toISOString(),
      expiresAt: expired ? new Date(legacyMoment).toISOString() : null,
      explicitDate: new Date(legacyMoment).toISOString(),
      recalibrationRequired: expired,
      source: "legacy_label",
    };
  }

  return {
    status: "ongoing",
    label,
    dueAt: null,
    expiresAt: null,
    explicitDate: null,
    recalibrationRequired: false,
    source: canonical ? "canonical_next_test" : "legacy_label",
  };
}

export function shouldRecalibrateExpiredCatalyst(input: {
  assessment: StoryCatalystAssessment;
  lastEvaluatedAt: string | null | undefined;
  now: Date;
  cooldownHours?: number;
}) {
  if (!input.assessment.recalibrationRequired || input.assessment.status !== "expired") return false;
  const lastEvaluatedMs = input.lastEvaluatedAt ? Date.parse(input.lastEvaluatedAt) : Number.NaN;
  if (!Number.isFinite(lastEvaluatedMs)) return true;
  const cooldownMs = (input.cooldownHours ?? 18) * 60 * 60 * 1_000;
  return input.now.getTime() - lastEvaluatedMs >= cooldownMs;
}

export function catalystDisplayLabel(assessment: StoryCatalystAssessment) {
  if (!assessment.label) return null;
  if (assessment.status === "expired") return "Expired · " + assessment.label;
  if (assessment.status === "due") return "Due now · " + assessment.label;
  if (assessment.status === "upcoming") return "Upcoming · " + assessment.label;
  if (assessment.status === "resolved") return "Resolved · " + assessment.label;
  return assessment.label;
}
