import { handleVerifiedIssuerResults } from "@/lib/dossier-v2/verified-issuer-results";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleVerifiedIssuerResults(request);
}
