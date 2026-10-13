import { acceptsResearchAuthorization } from "@/lib/research-auth";
import { fetchBeaSnapshot } from "@/lib/providers/bea";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!acceptsResearchAuthorization(request.headers.get("authorization"), [
    process.env.CRON_SECRET,
    process.env.RESEARCH_API_KEY,
  ])) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await fetchBeaSnapshot(process.env.BEA_API_KEY);
  const status = snapshot.state === "unavailable" ? 502 : 200;
  return Response.json(snapshot, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
