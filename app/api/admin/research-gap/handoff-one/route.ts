import { handleManualResearchGapSnapshotHandoff } from "@/lib/research-gap-manual-handoff-run";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleManualResearchGapSnapshotHandoff(request);
}
