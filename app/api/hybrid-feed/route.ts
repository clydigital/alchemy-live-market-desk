import { getCanonicalPublicationResponseWithDeskRead } from "@/lib/intelligence/desk-read-publication-route";
import { recordPublicationCaller } from "@/lib/intelligence/publication-caller-telemetry";

export const dynamic = "force-dynamic";

// Compatibility alias. It intentionally delegates to the same canonical,
// persisted feed as V2 so slow live providers cannot block Hybrid.
export async function GET(request: Request) {
  recordPublicationCaller(request, "/api/hybrid-feed");
  return getCanonicalPublicationResponseWithDeskRead(new URL(request.url).searchParams.get("edition"));
}
