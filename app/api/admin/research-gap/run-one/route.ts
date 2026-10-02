import { handleManualResearchGapWebRun } from "@/lib/research-gap-manual-web-run";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleManualResearchGapWebRun(request);
}
