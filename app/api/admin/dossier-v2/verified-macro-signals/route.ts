import { handleVerifiedMacroSignalsWithDependencies } from "@/lib/dossier-v2/verified-macro-signals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleVerifiedMacroSignalsWithDependencies(request);
}
