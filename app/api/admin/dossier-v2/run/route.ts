import { handleDossierV2PersistRunWithDependencies } from "@/lib/dossier-v2/manual-persist-trigger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleDossierV2PersistRunWithDependencies(request);
}
