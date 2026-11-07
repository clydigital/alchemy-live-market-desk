import "server-only";
import {
  buildJobsPublicProjection,
  type JobsMetricRecord,
  type JobsPublicProjection,
  type JobsReleaseRecord,
} from "./macro/jobs-public-projection.ts";

/** Public BLS-only reader. Uses the already-public Supabase release/metric RLS,
 * never the service key, owner workspace, private Dossier or a new table. */
export async function readPublicUsJobs(): Promise<JobsPublicProjection> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anonKey) return buildJobsPublicProjection(null, []);
  const headers = {
    apikey: anonKey,
    Authorization: "Bearer " + anonKey,
    accept: "application/json",
  };
  async function getRows<T>(table: string, params: Record<string, string>): Promise<T[]> {
    const url = new URL(base.replace(/\/$/, "") + "/rest/v1/" + table);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await fetch(url, {
      headers, cache: "no-store", signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error("BLS public reader HTTP " + response.status);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error("BLS public reader unexpected response");
    return payload as T[];
  }
  try {
    const [release] = await getRows<JobsReleaseRecord>("macro_releases", {
      select: "id,release_name,reference_period,release_date,source_url,actual,status,consensus,consensus_source,consensus_captured_at",
      series_key: "eq.bls-employment-situation",
      agency: "eq.U.S. Bureau of Labor Statistics",
      status: "eq.completed",
      order: "release_date.desc",
      limit: "1",
    });
    if (!release) return buildJobsPublicProjection(null, []);
    const metrics = await getRows<JobsMetricRecord>("macro_release_metrics", {
      select: "metric_key,actual,previous,unit,source_url,retrieved_at,metadata",
      release_id: "eq." + release.id,
      order: "metric_key.asc",
      limit: "25",
    });
    return buildJobsPublicProjection(release, metrics);
  } catch {
    // A source outage cannot turn stale/partial data into a green market claim.
    return buildJobsPublicProjection(null, []);
  }
}
