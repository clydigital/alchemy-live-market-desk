import { getCanonicalPublicationResponse } from "@/lib/intelligence/publication-feed-route";

export const revalidate = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return getCanonicalPublicationResponse(new URL(request.url).searchParams.get("edition"));
}
