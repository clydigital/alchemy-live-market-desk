import { malaysiaDateKey } from "./scheduled-research-identity.ts";

export type ScheduledVideoSlot = "video_midnight" | "video_late_morning";

const VIDEO_SLOT_TIME_MY: Record<ScheduledVideoSlot, string> = {
  video_midnight: "09:00:00",
  video_late_morning: "21:00:00",
};

/** Vercel cron expressions are UTC; the video pipeline uses Asia/Kuala_Lumpur. */
export const SCHEDULED_VIDEO_CRON_UTC: Record<ScheduledVideoSlot, string> = {
  // Discovery leads the 09:30 / 21:30 MYT desk windows so the leased
  // transcript worker has time to complete creator intake before Live reads
  // the dedicated checkpoint. scheduledFor remains the canonical 09:00/21:00
  // slot identity; this only changes trigger lead time.
  video_midnight: "0 0 * * *",
  video_late_morning: "20 12 * * *",
};

export function scheduledVideoRunIdentity(slot: ScheduledVideoSlot, now = new Date()) {
  const date = malaysiaDateKey(now);
  return {
    runKey: `${slot}-${date}`,
    scheduledFor: `${date}T${VIDEO_SLOT_TIME_MY[slot]}+08:00`,
  };
}

export function scheduledVideoSlotForDesk(slot: "morning" | "evening"): ScheduledVideoSlot {
  return slot === "morning" ? "video_midnight" : "video_late_morning";
}
