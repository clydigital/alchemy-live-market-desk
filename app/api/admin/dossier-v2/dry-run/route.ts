import { handleDossierV2DryRunWithDependencies } from "@/lib/dossier-v2/manual-dry-run-trigger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleDossierV2DryRunWithDependencies(request);
}
