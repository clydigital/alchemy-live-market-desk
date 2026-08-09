export type HistoricalToneVersion = {
  story_id: string;
  version_number: number;
  title: string;
  thesis: string;
  best_explanation: string | null;
  strongest_contradiction: string | null;
  confidence: number;
  status: string;
  effective_at: string;
};

type ToneAxis = "rates" | "growth" | "geopolitics" | "ai" | "inflation";

type ToneVector = Record<ToneAxis, number>;

const AXES: ToneAxis[] = ["rates", "growth", "geopolitics", "ai", "inflation"];
const DAY = 24 * 60 * 60 * 1000;
const CURRENT_WINDOW_MS = 72 * 60 * 60 * 1000;
const COMPARISON_DAYS = 90;
const ESTABLISHED_BASELINE_DAYS = 14;

const patterns: Record<ToneAxis, { risk: RegExp[]; relief: RegExp[] }> = {
  rates: {
    risk: [
      /\bhike\b/i,
      /hawkish/i,
      /tighten/i,
      /front-end yields? (?:rose|higher|elevated)/i,
      /higher-for-longer/i,
      /inflation.*(?:hot|sticky|elevated)/i,
    ],
    relief: [
      /\bcut\b/i,
      /dovish/i,
      /weaken(?:ed|ing)? the .*hike case/i,
      /constraint on tightening/i,
      /yields? fell/i,
      /lower yields?/i,
      /easing/i,
    ],
  },
  growth: {
    risk: [
      /payroll losses?/i,
      /weaker[- ]demand/i,
      /slow(?:er|ing) wage/i,
      /lower participation/i,
      /stagnat/i,
      /recession/i,
      /consumption risk/i,
      /household demand/i,
      /weak labour/i,
    ],
    relief: [
      /productivity (?:rose|rising|gain)/i,
      /growth remains? resilient/i,
      /strong growth/i,
      /demand remains? strong/i,
      /margin support/i,
    ],
  },
  geopolitics: {
    risk: [
      /fresh .*attack/i,
      /tanker attack/i,
      /physical disruption.*active/i,
      /war risk/i,
      /strike risk/i,
      /hostilit/i,
      /impaired/i,
      /would not .*reopen/i,
      /continued lack of commercial transits/i,
    ],
    relief: [
      /ceasefire/i,
      /peace deal/i,
      /diplomatic progress/i,
      /negotiation/i,
      /reopen(?:ing)? the strait/i,
      /normalis(?:e|ation)/i,
      /remov(?:e|ing) .*war premium/i,
    ],
  },
  ai: {
    risk: [
      /capex scrutiny/i,
      /capital intensity/i,
      /cash conversion/i,
      /cash burn/i,
      /valuation expectations/i,
      /return threshold/i,
      /shares fell/i,
      /selloff/i,
      /pricing dependence/i,
    ],
    relief: [
      /demand remains? strong/i,
      /rebound/i,
      /not a durable rejection/i,
      /earnings support/i,
      /usage/i,
      /backlog/i,
      /free-cash-flow resilience/i,
    ],
  },
  inflation: {
    risk: [
      /inflation risk/i,
      /inflation stays? hot/i,
      /energy inflation/i,
      /crack spreads? .*elevated/i,
      /cracks? .*doubled/i,
      /product tightness/i,
      /pricing pressure/i,
      /sticky inflation/i,
    ],
    relief: [
      /less inflationary/i,
      /inflation cool/i,
      /disinflation/i,
      /unit labour costs? stayed contained/i,
      /lower unit labour costs?/i,
      /oil normalisation/i,
    ],
  },
};

const labels: Record<ToneAxis, string> = {
  rates: "Rates",
  growth: "Growth",
  geopolitics: "Geopolitics",
  ai: "AI / Tech",
  inflation: "Inflation",
};

function stamp(value: string | null | undefined) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min = -2, max = 2) {
  return Math.max(min, Math.min(max, value));
}

function scoreText(text: string, axis: ToneAxis) {
  const spec = patterns[axis];
  const risk = spec.risk.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0);
  const relief = spec.relief.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0);
  return clamp(risk - relief);
}

function vectorFor(version: HistoricalToneVersion): ToneVector {
  const text = [version.title, version.thesis, version.best_explanation, version.strongest_contradiction]
    .filter(Boolean)
    .join(" ");
  return AXES.reduce((result, axis) => {
    result[axis] = scoreText(text, axis);
    return result;
  }, {} as ToneVector);
}

function toneWord(axis: ToneAxis, score: number) {
  if (Math.abs(score) < 0.35) return "MIXED";
  const riskier = score > 0;
  if (axis === "rates") return riskier ? "MORE HAWKISH" : "MORE DOVISH";
  if (axis === "growth") return riskier ? "MORE CAUTIOUS" : "MORE CONSTRUCTIVE";
  if (axis === "geopolitics") return riskier ? "HIGHER RISK" : "EASING";
  if (axis === "ai") return riskier ? "MORE CONCERN" : "MORE CONSTRUCTIVE";
  return riskier ? "HOTTER RISK" : "COOLER";
}

function shiftSummary(axis: ToneAxis, delta: number) {
  const riskier = delta > 0;
  if (axis === "rates") return riskier
    ? "Rate expectations have turned more hawkish than the earlier Desk baseline."
    : "Rate expectations have shifted more dovish than the earlier Desk baseline.";
  if (axis === "growth") return riskier
    ? "The Desk has become more worried about weak demand and stagnation."
    : "The Desk has become more constructive on the growth backdrop.";
  if (axis === "geopolitics") return riskier
    ? "Geopolitical risk has intensified relative to the earlier Desk read."
    : "The Desk is carrying less geopolitical risk than it did previously.";
  if (axis === "ai") return riskier
    ? "AI capex, valuation and cash-conversion concerns have risen again."
    : "AI concern has eased as demand and price action held up better than feared.";
  return riskier
    ? "Inflation concern has risen, including risks outside the flat crude price."
    : "Inflation pressure has cooled relative to the earlier Desk baseline.";
}

function groupVersions(versions: HistoricalToneVersion[]) {
  const grouped = new Map<string, HistoricalToneVersion[]>();
  for (const version of versions) {
    const bucket = grouped.get(version.story_id) || [];
    bucket.push(version);
    grouped.set(version.story_id, bucket);
  }
  for (const bucket of grouped.values()) {
    bucket.sort((a, b) => (stamp(a.effective_at) || 0) - (stamp(b.effective_at) || 0));
  }
  return grouped;
}

export function buildDeskMemory(versions: HistoricalToneVersion[], generatedAt: string) {
  const now = stamp(generatedAt) || Date.now();
  const historyCutoff = now - COMPARISON_DAYS * DAY;
  const currentStart = now - CURRENT_WINDOW_MS;
  const usable = (versions || []).filter((version) => {
    const at = stamp(version.effective_at);
    return at != null && at >= historyCutoff && at <= now;
  });
  const oldest = usable.reduce<number | null>((min, version) => {
    const at = stamp(version.effective_at);
    if (at == null) return min;
    return min == null || at < min ? at : min;
  }, null);
  const observedHistoryDays = oldest == null ? 0 : Math.max(0, Math.floor((now - oldest) / DAY));
  const grouped = groupVersions(usable);

  const aggregates = new Map<ToneAxis, { weightedDelta: number; current: number; baseline: number; weight: number; pairedWeight: number; newThemeWeight: number }>();
  for (const axis of AXES) aggregates.set(axis, { weightedDelta: 0, current: 0, baseline: 0, weight: 0, pairedWeight: 0, newThemeWeight: 0 });

  for (const bucket of grouped.values()) {
    const currentVersion = [...bucket].reverse().find((version) => (stamp(version.effective_at) || 0) <= now);
    if (!currentVersion) continue;
    const baselineVersion = [...bucket].reverse().find((version) => (stamp(version.effective_at) || 0) < currentStart) || null;
    const currentVector = vectorFor(currentVersion);
    const baselineVector = baselineVersion ? vectorFor(baselineVersion) : null;
    const baseWeight = Math.max(0.55, Math.min(1, (currentVersion.confidence || 60) / 100));

    for (const axis of AXES) {
      const currentScore = currentVector[axis];
      const baselineScore = baselineVector?.[axis] || 0;
      if (!currentScore && !baselineScore) continue;
      const aggregate = aggregates.get(axis)!;
      const weight = baselineVersion ? baseWeight : baseWeight * 0.6;
      aggregate.weightedDelta += (currentScore - baselineScore) * weight;
      aggregate.current += currentScore * weight;
      aggregate.baseline += baselineScore * weight;
      aggregate.weight += weight;
      if (baselineVersion) aggregate.pairedWeight += weight;
      else aggregate.newThemeWeight += weight;
    }
  }

  const shifts = AXES.map((axis) => {
    const aggregate = aggregates.get(axis)!;
    if (!aggregate.weight) return null;
    const delta = aggregate.weightedDelta / aggregate.weight;
    const currentScore = aggregate.current / aggregate.weight;
    const baselineScore = aggregate.baseline / aggregate.weight;
    const isNewTheme = aggregate.pairedWeight === 0 && aggregate.newThemeWeight > 0;
    if (Math.abs(delta) < 0.45 && !isNewTheme) return null;
    return {
      key: axis,
      label: labels[axis],
      delta: Number(delta.toFixed(2)),
      currentScore: Number(currentScore.toFixed(2)),
      baselineScore: Number(baselineScore.toFixed(2)),
      currentTone: toneWord(axis, currentScore),
      baselineTone: isNewTheme ? "NOT PROMINENT" : toneWord(axis, baselineScore),
      direction: delta > 0 ? "riskier" : "easier",
      isNewTheme,
      summary: isNewTheme
        ? `${labels[axis]} has become a newly prominent Desk theme relative to the earlier baseline.`
        : shiftSummary(axis, delta),
    };
  }).filter(Boolean)
    .sort((a, b) => Math.abs((b as { delta: number }).delta) - Math.abs((a as { delta: number }).delta)) as Array<{
      key: ToneAxis;
      label: string;
      delta: number;
      currentScore: number;
      baselineScore: number;
      currentTone: string;
      baselineTone: string;
      direction: "riskier" | "easier";
      isNewTheme: boolean;
      summary: string;
    }>;

  const maxShift = shifts.reduce((max, shift) => Math.max(max, Math.abs(shift.delta)), 0);
  const severity = maxShift >= 1 ? "large" : maxShift >= 0.55 ? "meaningful" : "none";

  return {
    archivePolicy: "no_expiry",
    comparisonWindowDays: COMPARISON_DAYS,
    currentWindowHours: 72,
    observedHistoryDays,
    baselineStatus: observedHistoryDays >= ESTABLISHED_BASELINE_DAYS ? "established" : "building",
    historyStartAt: oldest ? new Date(oldest).toISOString() : null,
    currentWindowStartAt: new Date(currentStart).toISOString(),
    toneShift: {
      detected: severity !== "none" && shifts.length > 0,
      severity,
      shifts: shifts.slice(0, 5),
    },
  };
}
