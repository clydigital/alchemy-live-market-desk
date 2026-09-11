import { handleVideoIntakeRequest } from "@/lib/video-intake-handler";
import { runScheduledVideoIntake } from "@/lib/video-intake-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const runDiscoveryQueueOnly: typeof runScheduledVideoIntake = (input) => (
  runScheduledVideoIntake(input, {
    browserTranscriptConfigured: () => false,
  })
);

export async function GET(request: Request) {
  return handleVideoIntakeRequest(request, "video_midnight", {
    runScheduled: runDiscoveryQueueOnly,
  });
}
