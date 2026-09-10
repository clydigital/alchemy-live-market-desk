import { getCanonicalPublicationResponseWithDeskRead } from "@/lib/intelligence/desk-read-publication-route";
import { recordPublicationCaller } from "@/lib/intelligence/publication-caller-telemetry";

export const revalidate = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  recordPublicationCaller(request, "/api/hybrid-feed-v2");
  return getCanonicalPublicationResponseWithDeskRead(new URL(request.url).searchParams.get("edition"));
}
