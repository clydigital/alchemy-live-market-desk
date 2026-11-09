import assert from "node:assert/strict";
import test from "node:test";
import {bursaSymbolForRow,trackedFromSnapshot} from "../lib/power-stack-quote-routing.ts";
import {parseISahamQuote,readISahamQuote,readISahamUsage} from "../lib/providers/isaham.ts";

const fixture={
  status:"success",data:{symbol:"DAYANG",last_price:1.88,
    last_updated_timestamp:"2026-11-09T16:00:00+08:00"},
  metadata:{timestamp:"2026-11-10T07:12:11+08:00"}
};
test("MYR or explicit KL flags permit Bursa queries, not ambiguous US/HK names",()=>{
  assert.equal(bursaSymbolForRow({ticker:"DAYANG",position:{currency:"MYR"}}),"DAYANG");
  assert.equal(bursaSymbolForRow({ticker:"5347.KL"}),"5347");
  assert.equal(bursaSymbolForRow({ticker:"TENAGA",market:"MYX"}),"TENAGA");
  assert.equal(bursaSymbolForRow({ticker:"700.HK"}),null);
  assert.equal(bursaSymbolForRow({ticker:"CVX",position:{currency:"USD"}}),null);
  assert.equal(bursaSymbolForRow({ticker:"DAYANG"}),null);
});
test("tracked assets deduplicate by original ticker and preserve exchange source",()=>{
  const r=trackedFromSnapshot({holdings:[{ticker:"DAYANG",position:{currency:"MYR"}},
    {ticker:"CVX",position:{currency:"USD"}}],
    watchlist:[{ticker:"DAYANG"},{ticker:"5347.KL"},{ticker:"700.HK"}]});
  assert.deepEqual(r,[
    {ticker:"DAYANG",bursaSymbol:"DAYANG"},
    {ticker:"CVX",bursaSymbol:null},
    {ticker:"5347.KL",bursaSymbol:"5347"},
    {ticker:"700.HK",bursaSymbol:null}
  ]);
});
test("iSaham quote uses upstream batch time, never API response time",()=>{
  const r=parseISahamQuote(fixture,"DAYANG");
  assert.equal(r?.price,1.88);
  assert.equal(r?.currency,"MYR");
  assert.equal(r?.observedOn,"2026-11-09");
  assert.equal(r?.timestampBasis,"upstream_batch");
  assert.equal(r?.batchStartedAt,"2026-11-09T16:00:00+08:00");
  assert.ok(!r?.sourceUrl.includes("TEST_PRIVATE_TOKEN"));
  assert.equal(parseISahamQuote({...fixture,data:{...fixture.data,last_updated_timestamp:null}},"DAYANG"),null);
  assert.equal(parseISahamQuote({...fixture,data:{...fixture.data,symbol:"MISC"}},"DAYANG"),null);
  assert.equal(parseISahamQuote({...fixture,data:{...fixture.data,last_price:0}},"DAYANG"),null);
});
test("iSaham validates usage quota and sends a server-side bearer, not a URL key",async()=>{
  const seen:string[]=[];
  const fetcher=(async(url:string|URL|Request,options?:RequestInit)=>{
    seen.push(String(url));
    assert.equal(options?.headers && (options.headers as Record<string,string>).Authorization,"Bearer TEST_PRIVATE_TOKEN");
    if(String(url).endsWith("/v1/account/usage"))
      return new Response(JSON.stringify({status:"success",data:{tier:"free",credits_remaining:400}}),{status:200});
    return new Response(JSON.stringify(fixture),{status:200});
  }) as typeof fetch;
  const env={iSaham_API_KEY:"TEST_PRIVATE_TOKEN"};
  const usage=await readISahamUsage({env,fetchImpl:fetcher});
  assert.equal(usage.status,"ready");
  assert.equal(usage.remaining,400);
  const quote=await readISahamQuote("DAYANG",{env,fetchImpl:fetcher});
  assert.equal(quote?.price,1.88);
  assert.equal(seen.length,2);
  assert.ok(seen.every(url=>!url.includes("TEST_PRIVATE_TOKEN")));
});
test("no key, exhausted budget or invalid response never manufactures prices",async()=>{
  assert.equal((await readISahamUsage({env:{}})).status,"unconfigured");
  assert.equal(await readISahamQuote("MISC",{env:{}}),null);
  const fail=(async()=>new Response(JSON.stringify({status:"error",error:{code:"QUOTA_EXCEEDED"}}),{status:403})) as typeof fetch;
  assert.equal((await readISahamUsage({env:{iSaham_API_KEY:"T"},fetchImpl:fail})).status,"unavailable");
  assert.equal(await readISahamQuote("../etc",{env:{iSaham_API_KEY:"T"},fetchImpl:fail}),null);
});
