import { handleAutomaticResearchGapHandoff } from "@/lib/research-gap-auto-handoff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleAutomaticResearchGapHandoff(request);
}
