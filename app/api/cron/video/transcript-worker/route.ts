import { handleTranscriptWorkerRequest } from "@/lib/transcript-worker-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  return handleTranscriptWorkerRequest(request);
}
