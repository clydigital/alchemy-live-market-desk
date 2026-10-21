import { handleScheduledPostResearchDossier } from "@/lib/dossier-post-research-trigger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  return handleScheduledPostResearchDossier(request, "morning");
}
