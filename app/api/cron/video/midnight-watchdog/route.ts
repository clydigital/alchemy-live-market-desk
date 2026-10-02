import { handleScheduledVideoRecoveryRequest } from "@/lib/video-intake-recovery-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  return handleScheduledVideoRecoveryRequest(request, "video_midnight");
}
