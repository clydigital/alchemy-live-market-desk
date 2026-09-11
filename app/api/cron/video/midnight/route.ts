import { handleVideoIntakeRequest } from "@/lib/video-intake-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  return handleVideoIntakeRequest(request, "video_midnight");
}
