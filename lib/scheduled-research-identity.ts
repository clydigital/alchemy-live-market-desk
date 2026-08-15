import { type CanonicalResearchSlot } from "./research-schedule-health.ts";

export type ClaimedRun = {
  id: string;
  status: "running" | "completed" | "blocked" | "failed";
  completed_at: string | null;
  updated_at: string;
};

export type ClaimResult =
  | { state: "claimed"; run: ClaimedRun }
  | { state: "completed" | "running" | "terminal"; run: ClaimedRun };

export type ClaimInsertInput = {
  runKey: string;
  slot: CanonicalResearchSlot;
  scheduledFor: string;
  startedAt: string;
  updatedAt: string;
};

export type ClaimRunDependencies = {
  readRun: (runKey: string) => Promise<ClaimedRun | null>;
  insertRun: (input: ClaimInsertInput) => Promise<ClaimedRun>;
  now?: () => string;
};

export type ScheduledResearchLogEvent = {
  event: string;
  cronReceivedAt: string;
  slot: CanonicalResearchSlot;
  scheduledFor?: string;
  runKey?: string;
  authStatus?: "authorized" | "unauthorized";
  claimOutcome?: ClaimResult["state"] | "failed";
  runId?: string;
  publisherStatus?: number;
  acquisitionSourceCount?: number;
  retainedItems?: number;
  vercelRequestId?: string;
  vercelDeploymentUrl?: string;
  vercelCronSchedule?: string;
  message?: string;
};

export function malaysiaDateKey(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function scheduledForMalaysiaSlot(slot: CanonicalResearchSlot, now = new Date()) {
  const date = malaysiaDateKey(now);
  const time = slot === "morning" ? "09:15:00" : "21:15:00";
  return `${date}T${time}+08:00`;
}

export function scheduledRunKey(slot: CanonicalResearchSlot, now = new Date()) {
  return `cron-v1:${slot}:${malaysiaDateKey(now)}`;
}

function explicitRetryKey(request: Request, baseRunKey: string) {
  const retry = new URL(request.url).searchParams.get("retry")?.trim();
  if (!retry) return baseRunKey;
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/i.test(retry)) {
    throw new Error("The retry key must contain only letters, numbers, and hyphens and be at most 41 characters.");
  }
  return `${baseRunKey}:retry:${retry}`;
}

function claimState(existing: ClaimedRun): Exclude<ClaimResult, { state: "claimed" }> {
  if (existing.status === "completed") return { state: "completed", run: existing };
  if (existing.status === "running") return { state: "running", run: existing };
  return { state: "terminal", run: existing };
}

export async function claimRunWithDependencies(
  slot: CanonicalResearchSlot,
  runKey: string,
  scheduledFor: string,
  dependencies: ClaimRunDependencies,
): Promise<ClaimResult> {
  const existing = await dependencies.readRun(runKey);
  if (existing) return claimState(existing);

  const now = dependencies.now?.() ?? new Date().toISOString();
  try {
    const created = await dependencies.insertRun({
      runKey,
      slot,
      scheduledFor,
      startedAt: now,
      updatedAt: now,
    });
    return { state: "claimed", run: created };
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "23505") {
      const raced = await dependencies.readRun(runKey);
      if (!raced) throw new Error("A concurrent scheduled research claim could not be recovered.");
      return claimState(raced);
    }
    throw error;
  }
}

export function resolveScheduledResearchIdentity(request: Request, slot: CanonicalResearchSlot, now = new Date()) {
  return {
    runKey: explicitRetryKey(request, scheduledRunKey(slot, now)),
    scheduledFor: scheduledForMalaysiaSlot(slot, now),
  };
}

export function buildScheduledResearchLogEvent(input: {
  event: string;
  request: Request;
  slot: CanonicalResearchSlot;
  now: Date;
  extra?: Omit<Partial<ScheduledResearchLogEvent>, "event" | "slot" | "cronReceivedAt">;
}) {
  const vercelRequestId = input.request.headers.get("x-vercel-id")?.trim() || undefined;
  const vercelDeploymentUrl = input.request.headers.get("x-vercel-deployment-url")?.trim() || undefined;
  const vercelCronSchedule = input.request.headers.get("x-vercel-cron-schedule")?.trim() || undefined;
  return {
    event: input.event,
    slot: input.slot,
    cronReceivedAt: input.now.toISOString(),
    ...(vercelRequestId ? { vercelRequestId } : {}),
    ...(vercelDeploymentUrl ? { vercelDeploymentUrl } : {}),
    ...(vercelCronSchedule ? { vercelCronSchedule } : {}),
    ...(input.extra || {}),
  } satisfies ScheduledResearchLogEvent;
}
