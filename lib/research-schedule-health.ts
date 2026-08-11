export const CANONICAL_RESEARCH_SLOTS = [
  { key: "morning", label: "09:15 full desk update", hour: 9, minute: 15 },
  { key: "evening", label: "21:15 evening delta", hour: 21, minute: 15 },
] as const;

export type CanonicalResearchSlot = typeof CANONICAL_RESEARCH_SLOTS[number]["key"];

export type ResearchRunLike = {
  schedule_slot: string;
  scheduled_for: string;
  completed_at: string | null;
  status: "running" | "completed" | "blocked" | "failed";
  warnings?: string[];
  updates_published?: number;
};

export type ResearchSlotHealth = {
  key: CanonicalResearchSlot;
  label: string;
  expectedAt: string;
  nextAt: string;
  status: "complete" | "running" | "blocked" | "failed" | "missed" | "disabled";
  completedAt: string | null;
  updatesPublished: number;
  warningCount: number;
};

export type FourSlotResearchHealth = {
  state: "healthy" | "attention" | "not_configured" | "disabled";
  slots: ResearchSlotHealth[];
  completedCount: number;
  warningCount: number;
  latestCompletedAt: string | null;
};

function malaysiaDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return Object.fromEntries(parts.map((part) => [part.type, part.value])) as Record<string, string>;
}

function malaysiaSlotIso(dateKey: string, hour: number, minute: number) {
  return new Date(`${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`).toISOString();
}

function shiftDateKey(dateKey: string, days: number) {
  const shifted = new Date(`${dateKey}T00:00:00+08:00`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

function closestRun(runs: ResearchRunLike[], slot: CanonicalResearchSlot, expectedAt: string) {
  const target = Date.parse(expectedAt);
  const windowMs = 2 * 60 * 60_000;
  return runs
    .filter((run) => run.schedule_slot === slot)
    .map((run) => ({ run, distance: Math.abs(Date.parse(run.scheduled_for) - target) }))
    .filter((item) => Number.isFinite(item.distance) && item.distance <= windowMs)
    .sort((a, b) => a.distance - b.distance)[0]?.run || null;
}

function slotStatus(run: ResearchRunLike | null): ResearchSlotHealth["status"] {
  if (!run) return "missed";
  if (run.status === "completed") return "complete";
  return run.status;
}

export function getFourSlotResearchHealth(runs: ResearchRunLike[], now = new Date(), enabled = true): FourSlotResearchHealth {
  const parts = malaysiaDateParts(now);
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const yesterday = shiftDateKey(today, -1);
  const tomorrow = shiftDateKey(today, 1);

  const slots = CANONICAL_RESEARCH_SLOTS.map((slot) => {
    const todayAt = malaysiaSlotIso(today, slot.hour, slot.minute);
    const todayTime = Date.parse(todayAt);
    const expectedAt = todayTime <= now.getTime()
      ? todayAt
      : malaysiaSlotIso(yesterday, slot.hour, slot.minute);
    const nextAt = todayTime > now.getTime()
      ? todayAt
      : malaysiaSlotIso(tomorrow, slot.hour, slot.minute);
    const run = closestRun(runs, slot.key, expectedAt);

    return {
      key: slot.key,
      label: slot.label,
      expectedAt,
      nextAt,
      status: slotStatus(run),
      completedAt: run?.completed_at || null,
      updatesPublished: run?.updates_published || 0,
      warningCount: run?.warnings?.length || 0,
    } satisfies ResearchSlotHealth;
  });

  const completedRuns = runs
    .filter((run) => run.status === "completed" && run.completed_at)
    .sort((a, b) => Date.parse(b.completed_at!) - Date.parse(a.completed_at!));
  const completedCount = slots.filter((slot) => slot.status === "complete").length;

  const health: FourSlotResearchHealth = {
    state: !runs.length ? "not_configured" : completedCount === slots.length ? "healthy" : "attention",
    slots,
    completedCount,
    warningCount: slots.reduce((sum, slot) => sum + slot.warningCount, 0),
    latestCompletedAt: completedRuns[0]?.completed_at || null,
  };
  if (enabled) return health;
  return {
    ...health,
    state: "disabled",
    slots: health.slots.map((slot) => ({ ...slot, status: "disabled" })),
  };
}
