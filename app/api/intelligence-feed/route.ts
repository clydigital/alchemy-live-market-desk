import { getCanonicalPublicationResponseWithDeskRead } from "@/lib/intelligence/desk-read-publication-route";
import { recordPublicationCaller } from "@/lib/intelligence/publication-caller-telemetry";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET(request: Request) {
  recordPublicationCaller(request, "/api/intelligence-feed");
  return getCanonicalPublicationResponseWithDeskRead(new URL(request.url).searchParams.get("edition"));
}
