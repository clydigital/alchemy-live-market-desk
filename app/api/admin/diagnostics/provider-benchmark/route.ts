import { runProviderBenchmark } from "@/lib/provider-benchmark-poc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ error: "Provider benchmark is preview-only." }, { status: 404 });
  }

  try {
    const result = await runProviderBenchmark(process.env);
    return Response.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  } catch (error) {
    return Response.json({
      error: "Provider benchmark failed before completion.",
      detail: error instanceof Error ? error.message : String(error),
      persistence: "none",
      reasoning: "none",
    }, { status: 502, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
}
