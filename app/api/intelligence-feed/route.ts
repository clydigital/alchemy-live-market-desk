import { getCanonicalPublicationResponse } from "@/lib/intelligence/publication-feed-route";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET() {
  return getCanonicalPublicationResponse();
}
