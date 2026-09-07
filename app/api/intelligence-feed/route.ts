import { getCanonicalPublicationResponseWithDeskRead } from "@/lib/intelligence/desk-read-publication-route";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET(request: Request) {
  return getCanonicalPublicationResponseWithDeskRead(new URL(request.url).searchParams.get("edition"));
}
