import assert from "node:assert/strict";
import test from "node:test";
import { classifyAlphaDailyPayload,readAlphaVantageDailyPilot } from "../lib/providers/alpha-vantage-daily-pilot.ts";

const stamp="2026-10-28T10:00:00.000Z";
test("valid Alpha compact daily time series proves a dated source response",()=>{
 const p=classifyAlphaDailyPayload({"Meta Data":{"2. Symbol":"SPY"},"Time Series (Daily)":{
  "2026-10-27":{"4. close":"685.30"},
  "2026-10-26":{"4. close":"684.20"},
  "2026-10-25":{"4. close":"N/A"},
 }},stamp);
 assert.deepEqual(p,{state:"ready",asOf:"2026-10-27",sampleCount:2,retrievedAt:stamp,note:"OK"});
});
test("rate limit or premium entitlement is not silently reported as key failure",()=>{
 assert.equal(classifyAlphaDailyPayload({Information:"API call frequency limit"},stamp).state,"limited");
 assert.equal(classifyAlphaDailyPayload({Note:"Quota reached"},stamp).note,"RATE_LIMIT_OR_ENTITLEMENT");
});
test("empty, corrupt and invalid numeric responses fail closed",()=>{
 assert.equal(classifyAlphaDailyPayload({"Time Series (Daily)":{"2026-10-27":{"4. close":"NaN"}}},stamp).state,"unavailable");
 assert.equal(classifyAlphaDailyPayload({error:"missing"},stamp).asOf,null);
});
test("missing Alpha key never starts provider fetch",async()=>{
 let called=false;
 const output=await readAlphaVantageDailyPilot({apiKey:" ",fetchImpl:(async()=>{called=true;throw new Error("should not call");}) as typeof fetch});
 assert.equal(output.state,"unconfigured");
 assert.equal(called,false);
});
test("only bounded SPY daily compact request is used and the API key never appears in returned result",async()=>{
 let calls=0;
 const key="secret_fixture_value";
 const result=await readAlphaVantageDailyPilot({apiKey:key,fetchImpl:(async(input:RequestInfo|URL)=>{
  calls++;
  const url=new URL(String(input));
  assert.equal(url.origin,"https://www.alphavantage.co");
  assert.equal(url.searchParams.get("symbol"),"SPY");
  assert.equal(url.searchParams.get("function"),"TIME_SERIES_DAILY");
  assert.equal(url.searchParams.get("outputsize"),"compact");
  assert.equal(url.searchParams.get("apikey"),key);
  return new Response(JSON.stringify({"Time Series (Daily)":{"2026-10-27":{"4. close":"680.10"}}}),{status:200});
 }) as typeof fetch});
 assert.equal(calls,1);
 assert.equal(result.state,"ready");
 assert.equal(JSON.stringify(result).includes(key),false);
});
