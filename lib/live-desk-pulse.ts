import type { MarketStateRecord, ResearchRunStatus } from "@/lib/data";

export type LiveDeskPulse = {
  available: boolean;
  score: number | null;
  label: "Constructive" | "Balanced" | "Fragile" | "Stressed" | "Unavailable";
  summary: string;
  risks: number;
  boons: number;
  mixed: number;
  dataGate: ResearchRunStatus["accuracy_gate"] | "unknown";
  asOf: string | null;
  drivers: Array<{
    id: string;
    sector: string;
    direction: string;
    score: number;
    explanation: string;
    observedAt: string | null;
  }>;
};

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function directionKind(value: string) {
  const normalized = value.toLowerCase();
  if (/boon|positive|bull|upside|constructive/.test(normalized)) return "boon";
  if (/risk|negative|bear|downside|stress/.test(normalized)) return "risk";
  return "mixed";
}

function rowWeight(row: MarketStateRecord) {
  const magnitude = Number.isFinite(Number(row.magnitude)) ? Number(row.magnitude) : 50;
  const probability = Number.isFinite(Number(row.probability)) ? Number(row.probability) : 50;
  return clamp((magnitude + probability) / 2);
}

function pulseLabel(score: number): LiveDeskPulse["label"] {
  if (score >= 68) return "Constructive";
  if (score >= 52) return "Balanced";
  if (score >= 38) return "Fragile";
  return "Stressed";
}

export function buildLiveDeskPulse(
  records: MarketStateRecord[],
  latestRun: ResearchRunStatus | null,
): LiveDeskPulse {
  const usable = records.filter((row) => row.owner_status !== "retired");
  if (!usable.length) {
    return {
      available: false,
      score: null,
      label: "Unavailable",
      summary: "Live has not published enough persisted market-state records to calculate the desk pulse.",
      risks: 0,
      boons: 0,
      mixed: 0,
      dataGate: latestRun?.accuracy_gate || "unknown",
      asOf: latestRun?.completed_at || null,
      drivers: [],
    };
  }

  const classified = usable.map((row) => ({ row, kind: directionKind(row.direction), weight: rowWeight(row) }));
  const directional = classified.filter((item) => item.kind !== "mixed");
  const net = directional.reduce((sum, item) => sum + (item.kind === "boon" ? item.weight : -item.weight), 0);
  const score = Math.round(clamp(50 + (directional.length ? net / (directional.length * 2) : 0)));
  const risks = classified.filter((item) => item.kind === "risk").length;
  const boons = classified.filter((item) => item.kind === "boon").length;
  const mixed = classified.length - risks - boons;
  const label = pulseLabel(score);
  const drivers = [...classified]
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 6)
    .map(({ row, weight }) => ({
      id: row.id,
      sector: row.sector,
      direction: row.direction,
      score: Math.round(weight),
      explanation: directionKind(row.direction) === "risk" ? row.risk : directionKind(row.direction) === "boon" ? row.boon : row.evidence_summary,
      observedAt: row.observed_at,
    }));
  const asOf = usable
    .map((row) => row.observed_at || row.updated_at)
    .filter(Boolean)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || latestRun?.completed_at || null;

  return {
    available: true,
    score,
    label,
    summary: `${label} Live Desk pulse: ${boons} boon signal${boons === 1 ? "" : "s"}, ${risks} risk signal${risks === 1 ? "" : "s"} and ${mixed} mixed or unscored.`,
    risks,
    boons,
    mixed,
    dataGate: latestRun?.accuracy_gate || "unknown",
    asOf,
    drivers,
  };
}
