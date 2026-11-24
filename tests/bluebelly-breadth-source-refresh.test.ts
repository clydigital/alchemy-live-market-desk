import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {parsePublishedSp500Breadth,calculateBreadthRow,parseCurrentBreadthTable,parseBreadthHistoricalTable,REVIEWED_BREADTH_PROXY_SNAPSHOT} from "../lib/bluebelly-breadth-dated.ts";

const now=new Date("2026-11-04T10:00:00Z");
const fixture=(date="Nov 03, 2026",short="65.9% +5.5 / 5d",long="61.5% +2.4 / 5d")=>
  "<main><h2>All US Stocks: % Above Moving Averages</h2><div>50d · Swing 40.0% +4.2 / 5d</div><h2>S&amp;P 500 Members: % Above the 50 &amp; 200-Day Averages vs SPY</h2><div>10d · Timing 64.5% +0.8 / 5d</div><div>50d · Swing @SHORT@</div><div>100d · Trend 60.0% +6.1 / 5d</div><div>200d · Regime @LONG@</div><p>Latest · @DATE@ · SPY $754.35</p><h2>Nasdaq-100 Members: % Above the 50 &amp; 200-Day Averages vs QQQ</h2><div>50d · Swing 49.0% -4.0 / 5d</div></main>".replace("@DATE@",date).replace("@SHORT@",short).replace("@LONG@",long);

test("reads current-member S&P series, not the all-US or Nasdaq figures",()=>{
  const rows=parsePublishedSp500Breadth(fixture(),now);
  assert.deepEqual(rows?.map(r=>[r.symbol,r.points[0].value,r.reportedChange5d]),
    [["S5FI",65.9,5.5],["S5TH",61.5,2.4]]);
  const row=calculateBreadthRow("S5FI","50D",rows?.[0],now);
  assert.equal(row.last,65.9);
  assert.equal(row.change5d,5.5);
  assert.equal(row.change,null);
  assert.equal(row.change3d,null);
  assert.match(row.sourceName,/proxy/);
});
test("rejects stale, future, impossible and unscoped source observations",()=>{
  assert.equal(parsePublishedSp500Breadth(fixture("Oct 30, 2026"),new Date("2026-11-05T12:00:00Z")),null);
  assert.equal(parsePublishedSp500Breadth(fixture("Nov 09, 2026"),now),null);
  assert.equal(parsePublishedSp500Breadth(fixture("Nov 03, 2026","101.0% +5.5 / 5d"),now),null);
  assert.equal(parsePublishedSp500Breadth(fixture("Nov 03, 2026","65.9% +90.0 / 5d"),now),null);
  assert.equal(parsePublishedSp500Breadth(fixture().replace("S&amp;P 500 Members:","All Stocks:"),now),null);
  assert.equal(parsePublishedSp500Breadth(fixture("Nov 03, 2026","65.9% +5.5 / 5d","61.5%"),now),null);
});
test("uses bounded 2-hour refresh with explicit unavailable fallback",()=>{
  const reader=readFileSync(new URL("../lib/bluebelly-breadth-reader.ts",import.meta.url),"utf8");
  assert.match(reader,/thetrading\.tools\/stocks-above-moving-average/);
  assert.match(reader,/investing\.com/);
  assert.match(reader,/retrievalStatus:"fallback"/);
  assert.match(reader,/revalidate:7200/);
});

test("new upstream table maps the exact named universes and rejects stale data",()=>{
 const date=new Date("2026-11-24T08:00:00Z");
 const html='<p>Updated daily after close · as of 2026-11-23</p><table><tr><th>% above their</th><th>All US Stocks</th><th>S&amp;P 500 Members</th><th>Nasdaq-100 Members</th><th>Russell 2000-Style Stocks</th></tr><tr><td>50-Day average · Swing</td><td>28.6%</td><td>52.3%</td><td>42.0%</td><td>29.4%</td></tr><tr><td>100-Day average · Trend</td><td>25.1%</td><td>46.3%</td><td>40%</td><td>25.4%</td></tr><tr><td>200-Day average · Regime</td><td>31.2%</td><td>52.8%</td><td>43.4%</td><td>34.0%</td></tr></table>';
 const rows=parseCurrentBreadthTable(html,date)!;
 assert.equal(rows.length,7);
 assert.equal(rows.find(r=>r.symbol==="S5FI")?.points[0].value,52.3);
 assert.equal(rows.find(r=>r.symbol==="NDFI")?.points[0].value,42);
 assert.match(rows.find(r=>r.symbol==="R2FI")!.sourceName,/proxy/);
 assert.equal(parseCurrentBreadthTable(html,new Date("2026-12-01")),null);
 assert.equal(calculateBreadthRow("S5FI","breadth",REVIEWED_BREADTH_PROXY_SNAPSHOT[0],date).last,52.3);
});
test("historical fallback uses daily closing levels, never relative percentage returns",()=>{
 const html='<table><tr><th>Date</th><th>Price</th><th>Open</th><th>Change %</th></tr><tr><td>Nov 23, 2026</td><td>52.28</td><td>49.70</td><td>+22.32%</td></tr><tr><td>Nov 20, 2026</td><td>42.74</td><td>50.00</td><td>-10%</td></tr></table>';
 const date=new Date("2026-11-24T08:00:00Z");
 const s=parseBreadthHistoricalTable(html,"S5FI","https://www.investing.com/indices/s-p-500-stocks-above-50-day-average-historical-data",date)!;
 assert.equal(s.points.length,2);
 assert.equal(calculateBreadthRow("S5FI","breadth",s,date).change,9.54);
});
