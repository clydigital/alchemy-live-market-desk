import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {parsePublishedSp500Breadth,calculateBreadthRow} from "../lib/bluebelly-breadth-dated.ts";

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
  assert.equal(parsePublishedSp500Breadth(fixture().replace("S&amp;P 500 Members:","All Stocks:")),now),null);
  assert.equal(parsePublishedSp500Breadth(fixture("Nov 03, 2026","65.9% +5.5 / 5d","61.5%"),now),null);
});
test("uses bounded 2-hour refresh with explicit unavailable fallback",()=>{
  const reader=readFileSync(new URL("../lib/bluebelly-breadth-reader.ts",import.meta.url),"utf8");
  assert.match(reader,/thetrading\.tools\/stocks-above-moving-average/);
  assert.doesNotMatch(reader,/investing\.com/);
  assert.match(reader,/retrievalStatus:"fallback"/);
  assert.match(reader,/revalidate:7200/);
});
