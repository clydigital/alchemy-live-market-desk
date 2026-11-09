import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { trackedFromSnapshot } from "@/lib/power-stack-quote-routing";
import { readISahamQuote, readISahamUsage, type ISahamQuote } from "@/lib/providers/isaham";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
const BURSA_MAX_QUOTES_PER_RUN = 12; // Free plan: never send bulk requests.
const BURSA_FREE_CREDIT_RESERVE = 50; // Stop before the 500-credit allowance runs out.
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function GET(request: Request) {
  // Supabase pg_cron holds this separate token in Vault; public host blocks this route.
  const secret = process.env.POWER_STACK_REFRESH_TOKEN;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = createSupabaseAdminClient();
    const { data: snapshots, error } = await db.from("power_stack_owner_snapshots")
      .select("owner_user_id,snapshot,legacy_source_retired,snapshot_as_of")
      .eq("legacy_source_retired", true)
      .order("snapshot_as_of", { ascending: false }).limit(200);
    if (error) throw error;
    const latest = new Map<string, unknown>();
    for (const row of snapshots ?? []) {
      if (!latest.has(row.owner_user_id)) latest.set(row.owner_user_id, row.snapshot);
    }
    const ownerItems = [...latest.entries()].map(([owner,snapshot]) => ({
      owner, tracked: trackedFromSnapshot(snapshot)
    }));
    const bursa = [...new Set(ownerItems.flatMap(({tracked}) =>
      tracked.flatMap(item => item.bursaSymbol ? [item.bursaSymbol] : [])))];
    // Read today's already-ingested Bursa observations before spending free API credits.
    const todayMYT = new Date(Date.now() + 8 * 3600000).toISOString().slice(0,10);
    const todayStartUTC = new Date(todayMYT + "T00:00:00+08:00").toISOString();
    const { data: recent, error: recentError } = bursa.length
      ? await db.from("power_stack_quote_observations")
          .select("owner_user_id,ticker,price,currency,observed_on,source_name,source_url,source_recorded_at,timestamp_basis")
          .eq("source_name", "iSaham Data API")
          .gte("ingested_at", todayStartUTC)
          .limit(1000)
      : { data: [], error: null };
    if (recentError) throw recentError;
    const recentForOwner = new Set((recent??[]).map(row=>row.owner_user_id + "/" + row.ticker));
    const cachedBursa = new Map<string, ISahamQuote>();
    for (const row of recent??[]) {
      // Quote data is public-market data; replicate among approved owners without a second API charge.
      const code = row.ticker.replace(/\.(KL|MY)$/,"");
      if (bursa.includes(code) && row.currency==="MYR" && row.timestamp_basis==="upstream_batch" &&
        typeof row.source_recorded_at==="string" && Number(row.price)>0) {
        cachedBursa.set(code, {
          symbol:code,price:Number(row.price),currency:"MYR",
          observedOn:row.observed_on,batchStartedAt:row.source_recorded_at,
          sourceName:"iSaham Data API",sourceUrl:"https://api.isaham.my/docs",timestampBasis:"upstream_batch"
        });
      }
    }
    const uncached=bursa.filter(symbol=>!cachedBursa.has(symbol));
    const usage=uncached.length?await readISahamUsage():null;
    const available = usage?.status==="ready" ? Math.max(0,(usage.remaining??0) - BURSA_FREE_CREDIT_RESERVE):0;
    const allowance = Math.min(BURSA_MAX_QUOTES_PER_RUN,uncached.length,available);
    let fetched=0;
    // Usage inspection is also an API request; space it from the first paid quote call.
    if(allowance>0)await sleep(700);
    for (const symbol of uncached.slice(0,allowance)) {
      // 2 req/sec and 20 req/min on Free. Keep the loop bounded and serial.
      if (fetched>0) await sleep(650);
      const quote=await readISahamQuote(symbol);
      fetched++;
      if (quote) cachedBursa.set(symbol,quote);
    }
    const monitor = await getMarketMonitor();
    const indexed = new Map(monitor.rows
      .filter(row => row.last !== null && row.last > 0 && row.asOf
        && row.frequency === "daily" && row.sourceName && row.sourceUrl)
      .map(row => [row.symbol.toUpperCase(), row]));
    let written=0, missing=0, bursaSaved=0, bursaSkippedRecently=0;
    for (const {owner,tracked} of ownerItems) {
      const observations = tracked.flatMap(item => {
        if(item.bursaSymbol) {
          const quote=cachedBursa.get(item.bursaSymbol);
          if(!quote){ missing++; return []; }
          if(recentForOwner.has(owner+"/"+item.ticker)){bursaSkippedRecently++;return [];}
          bursaSaved++;
          return [{
            owner_user_id:owner,ticker:item.ticker,observed_on:quote.observedOn,
            price:quote.price,currency:"MYR",source_name:quote.sourceName,
            source_url:quote.sourceUrl,timestamp_basis:quote.timestampBasis,
            source_recorded_at:quote.batchStartedAt
          }];
        }
        const row=indexed.get(item.ticker);
        if(!row || row.last===null || !row.asOf){missing++;return [];}
        const observedOn=row.asOf.slice(0,10);
        if(!/^\d{4}-\d{2}-\d{2}$/.test(observedOn)){missing++;return [];}
        return [{
          owner_user_id:owner,ticker:item.ticker,observed_on:observedOn,
          price:row.last,currency:"USD",source_name:row.sourceName,
          source_url:row.sourceUrl,timestamp_basis:"source_observation",
          source_recorded_at:null
        }];
      });
      if(!observations.length)continue;
      const {error:writeError}=await db.from("power_stack_quote_observations")
        .upsert(observations,{onConflict:"owner_user_id,ticker,observed_on"});
      if(writeError)throw writeError;
      written+=observations.length;
    }
    return NextResponse.json({
      status:"ok",ownerCount:latest.size,observationsUpserted:written,
      bursaSymbolsEligible:bursa.length,bursaRequestsMade:fetched,
      bursaObservationsSaved:bursaSaved,bursaSkippedRecently,
      bursaProviderStatus:usage?.status??(bursa.length?"cached":"no_eligible_symbols"),
      symbolsWithoutSupportedQuotes:missing,providerSnapshotAt:monitor.updatedAt,
      note:"iSaham timestamps are upstream refresh batches, NOT last trade times. Free-tier quota is checked before calls."
    });
  } catch {
    // Never send provider error bodies or environment secrets to the client.
    return NextResponse.json({error:"Quote refresh failed"},{status:503});
  }
}
