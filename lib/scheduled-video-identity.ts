import { malaysiaDateKey } from "./scheduled-research-identity.ts";

export type ScheduledVideoSlot = "video_midnight" | "video_late_morning";

const VIDEO_SLOT_TIME_MY: Record<ScheduledVideoSlot, string> = {
  video_midnight: "09:00:00",
  video_late_morning: "21:00:00",
};

/** Vercel cron expressions are UTC; the video pipeline uses Asia/Kuala_Lumpur. */
export const SCHEDULED_VIDEO_CRON_UTC: Record<ScheduledVideoSlot, string> = {
  video_midnight: "0 1 * * *",
  video_late_morning: "0 13 * * *",
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
