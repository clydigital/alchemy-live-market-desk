import assert from "node:assert/strict";
import test from "node:test";
import { readFredSeries } from "../lib/providers/fred-api-v1.ts";
import { readFmpRecords } from "../lib/providers/fmp-rest.ts";

test("FRED shared env alias works and ALFRED vintage provenance is preserved", async () => {
  let inspected = 0;
  const out = await readFredSeries("DGS10", {
    env: { FRED_API: "fred-secret" },
    vintageDate: "2026-10-09",
    fetchImpl: (async (url: string | URL | Request) => {
      const parsed = new URL(String(url));
      assert.equal(parsed.origin, "https://api.stlouisfed.org");
      assert.equal(parsed.searchParams.get("api_key"), "fred-secret");
      assert.equal(parsed.searchParams.get("vintage_dates"), "2026-10-09");
      assert.equal(parsed.searchParams.get("observation_end"), "2026-10-09");
      inspected++;
      return new Response(JSON.stringify({
        observations: [
          { date:"2026-10-08", value:"4.14", realtime_start:"2026-10-09", realtime_end:"2026-10-09" },
          { date:"2026-10-07", value:".", realtime_start:"2026-10-09", realtime_end:"2026-10-09" },
          { date:"2026-10-12", value:"4.20", realtime_start:"2026-10-09", realtime_end:"2026-10-09" },
        ],
      }), { status: 200 });
    }) as typeof fetch,
  });
  assert.equal(inspected,1);
  assert.equal(out.state,"ready");
  assert.equal(out.observations.length,1);
  assert.equal(out.observations[0].value,4.14);
  assert.deepEqual([out.observations[0].realtimeStart,out.observations[0].realtimeEnd],["2026-10-09","2026-10-09"]);
  assert.equal(out.sourceUrl,"https://fred.stlouisfed.org/series/DGS10");
  assert.ok(!JSON.stringify(out).includes("fred-secret"));
});

test("FRED fails closed for missing keys, invalid series and rate-limit errors", async () => {
  let requests=0;
  const fetchImpl = (async () => { requests++; return new Response("", {status:429}); }) as typeof fetch;
  const noKey=await readFredSeries("DGS2",{env:{},fetchImpl});
  const invalid=await readFredSeries("../BAD",{env:{FRED_API:"secret"},fetchImpl});
  assert.equal(noKey.state,"unconfigured");
  assert.equal(invalid.state,"unavailable");
  assert.equal(requests,0);
  const rateLimited=await readFredSeries("DGS2",{env:{FRED_API:"secret"},fetchImpl});
  assert.equal(rateLimited.state,"unavailable");
  assert.equal(rateLimited.note,"FRED_HTTP_429");
});

test("FMP shared env alias fetches quarter records without exposing secret", async () => {
  let requested=0;
  const out=await readFmpRecords({
    endpoint:"cash-flow-statement",symbol:"AMZN",period:"quarter",limit:2,
    env:{FMP_API:"fmp-secret"},
    fetchImpl:(async (url:string|URL|Request)=>{
      const parsed=new URL(String(url));
      assert.equal(parsed.origin,"https://financialmodelingprep.com");
      assert.equal(parsed.pathname,"/stable/cash-flow-statement");
      assert.equal(parsed.searchParams.get("apikey"),"fmp-secret");
      assert.equal(parsed.searchParams.get("symbol"),"AMZN");
      assert.equal(parsed.searchParams.get("period"),"quarter");
      requested++;
      return new Response(JSON.stringify([{date:"2026-06-30",symbol:"AMZN",operatingCashFlow:45387000000,capitalExpenditure:-54208000000}]), {status:200});
    }) as typeof fetch,
  });
  assert.equal(requested,1);
  assert.equal(out.state,"ready");
  assert.equal(out.records.length,1);
  assert.equal(out.records[0].capitalExpenditure,-54208000000);
  assert.ok(!JSON.stringify(out).includes("fmp-secret"));
});

test("FMP Basic denied and malformed responses never become canonical records", async () => {
  const missing=await readFmpRecords({endpoint:"cash-flow-statement",symbol:"MSFT",env:{}});
  assert.equal(missing.state,"unconfigured");
  const denied=await readFmpRecords({
    endpoint:"analyst-estimates",symbol:"MSFT",env:{FMP_API:"secret"},
    fetchImpl:(async()=>new Response(JSON.stringify({error:"restricted",token:"secret"}),{status:403})) as typeof fetch,
  });
  assert.equal(denied.state,"restricted");
  assert.equal(denied.records.length,0);
  assert.ok(!JSON.stringify(denied).includes("secret"));
  const malformed=await readFmpRecords({
    endpoint:"cash-flow-statement",symbol:"MSFT",env:{FMP_API:"secret"},
    fetchImpl:(async()=>new Response(JSON.stringify({error:"API key invalid"}),{status:200})) as typeof fetch,
  });
  assert.equal(malformed.state,"unavailable");
  assert.equal(malformed.records.length,0);
});

test("FMP calendar range and symbol guard reject invalid requests without spending credits", async () => {
  let requested=0;
  const fetchImpl=(async()=>{requested++;return new Response("[]",{status:200});}) as typeof fetch;
  const calendar=await readFmpRecords({
    endpoint:"earnings-calendar",from:"2026-01-01",to:"2026-08-01",
    env:{FMP_API:"secret"},fetchImpl,
  });
  const symbol=await readFmpRecords({
    endpoint:"cash-flow-statement",symbol:"AAPL?apikey=exfiltrate",
    env:{FMP_API:"secret"},fetchImpl,
  });
  assert.equal(calendar.note,"FMP_DATE_RANGE_OUT_OF_BOUNDS");
  assert.equal(symbol.note,"FMP_INVALID_SYMBOL");
  assert.equal(requested,0);
});

test("FMP 200 error-array and cross-issuer data fail closed", async () => {
  const errorArray=await readFmpRecords({
    endpoint:"cash-flow-statement",symbol:"AMZN",env:{FMP_API:"secret"},
    fetchImpl:(async()=>new Response(JSON.stringify([{"Error Message":"Upgrade required"}]),{status:200})) as typeof fetch,
  });
  assert.equal(errorArray.state,"restricted");
  assert.equal(errorArray.records.length,0);
  const wrongSymbol=await readFmpRecords({
    endpoint:"cash-flow-statement",symbol:"AMZN",env:{FMP_API:"secret"},
    fetchImpl:(async()=>new Response(JSON.stringify([{symbol:"MSFT",date:"2026-06-30"}]),{status:200})) as typeof fetch,
  });
  assert.equal(wrongSymbol.state,"unavailable");
  assert.equal(wrongSymbol.note,"FMP_SYMBOL_MISMATCH_OR_MISSING");
});
