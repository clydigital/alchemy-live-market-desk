export type LiveResearchCronStage = "acquisition" | "intelligence";
export type LiveResearchCronSlot = "morning" | "evening";

export type LiveResearchCronDecision =
  | { action: "run"; slot: LiveResearchCronSlot; stage: LiveResearchCronStage }
  | { action: "skip"; reason: string };

export const LIVE_RESEARCH_CRON_SCHEDULES = {
  morningAcquisition: "30 1 * * *",
  morningContinuation: "*/5 1-2 * * *",
  eveningAcquisition: "30 13 * * *",
  eveningContinuation: "*/5 13-14 * * *",
} as const;

function minuteOfDayUtc(now: Date) {
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

function within(value: number, start: number, end: number) {
  return value >= start && value <= end;
}

export function resolveLiveResearchCronDecision(
  schedule: string | null,
  now = new Date(),
): LiveResearchCronDecision {
  const minute = minuteOfDayUtc(now);

  if (schedule === LIVE_RESEARCH_CRON_SCHEDULES.morningAcquisition) {
    return within(minute, 90, 100)
      ? { action: "run", slot: "morning", stage: "acquisition" }
      : { action: "skip", reason: "Morning acquisition arrived outside the bounded 09:30-09:40 MYT start window." };
  }

  if (schedule === LIVE_RESEARCH_CRON_SCHEDULES.eveningAcquisition) {
    return within(minute, 810, 820)
      ? { action: "run", slot: "evening", stage: "acquisition" }
      : { action: "skip", reason: "Evening acquisition arrived outside the bounded 21:30-21:40 MYT start window." };
  }

  if (schedule === LIVE_RESEARCH_CRON_SCHEDULES.morningContinuation) {
    return within(minute, 95, 135)
      ? { action: "run", slot: "morning", stage: "intelligence" }
      : { action: "skip", reason: "Morning continuation tick is outside the bounded 09:35-10:15 MYT window." };
  }

  if (schedule === LIVE_RESEARCH_CRON_SCHEDULES.eveningContinuation) {
    return within(minute, 815, 855)
      ? { action: "run", slot: "evening", stage: "intelligence" }
      : { action: "skip", reason: "Evening continuation tick is outside the bounded 21:35-22:15 MYT window." };
  }

  return { action: "skip", reason: "Unknown Live research cron schedule." };
}
