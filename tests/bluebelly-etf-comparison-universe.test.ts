import test from "node:test";
import assert from "node:assert/strict";
import {buildEtfComparisonUniverse,ETF_COMPARISON_SYMBOLS,XL_COMPARISON_SYMBOLS} from "../lib/bluebelly-etf-comparison-universe.ts";
import {readFileSync} from "node:fs";
test("ETF comparison stays usable even with an empty provider response",()=>{
 const rows=buildEtfComparisonUniverse([]);
 assert.equal(rows.length,16);assert.equal(XL_COMPARISON_SYMBOLS.length,11);
 assert.deepEqual(rows.map(r=>r.symbol),[...ETF_COMPARISON_SYMBOLS]);
 assert.ok(rows.every(r=>r.last===null&&r.change===null&&r.asOf===null));
 const x={...rows[0],dataStatus:"SOURCE_DATED_SECONDARY" as const,asOf:"2026-11-23",change:2,last:100};
 const merged=buildEtfComparisonUniverse([{...x,asOf:"2026-11-20",change:10},x]);
 assert.equal(merged[0].change,2);
 assert.equal(merged[0].asOf,"2026-11-23");
});
test("Screener is first on both navigation surfaces, and standalone charts are removed",()=>{
 const native=readFileSync("app/blue-desk/markets/page.tsx","utf8");
 const scanner=readFileSync("app/blue-desk/markets/scanner/page.tsx","utf8");
 const widgets=readFileSync("components/blue-desk/MarketsScannerWidgets.tsx","utf8");
 for(const p of [native,scanner])assert.ok(p.indexOf(">Screener</Link>")<p.indexOf(">All Assets</Link>"));
 assert.ok(scanner.indexOf("<MarketsScannerWidgets/>")<scanner.indexOf("<NativeMarketsDiscovery"));
 assert.match(widgets,/useState<Tool\["id"\]>\("screener"\)/);
 assert.doesNotMatch(native,/advanced-market-charts|<TradingViewChart/);
 assert.match(native,/Object.keys\(query\).length===0/);
});
