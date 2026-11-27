import "server-only";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {projectTreasuryLedger} from "./treasury-ledger-reader-core";
import {NOMINAL_TREASURY_TENORS} from "./providers/treasury-nominal-curve";
import {unstable_cache} from "next/cache";
const read=unstable_cache(async()=>{
 const now=new Date(),start=new Date(+now-90*86400000).toISOString().slice(0,10);
 const {data,error}=await createSupabaseAdminClient().from("treasury_daily_closes").select("tenor_id,observation_date,yield_percent,source_updated_at,source_url,collected_at").in("tenor_id",Object.keys(NOMINAL_TREASURY_TENORS)).gte("observation_date",start).lte("observation_date",now.toISOString().slice(0,10)).order("observation_date",{ascending:false}).limit(700);
 if(error)throw Error("Treasury ledger unavailable");
 return projectTreasuryLedger(data??[],now);
},["bluebelly-treasury-ledger-reader-v1"],{revalidate:300});
export async function readTreasuryLedger(){try{return await read()}catch{return []}}
