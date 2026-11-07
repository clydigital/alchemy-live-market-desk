import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const route=readFileSync("app/blue-desk/key-stories/page.tsx","utf8");
const lean=readFileSync("components/blue-desk/LeanWatch.tsx","utf8");
const header=readFileSync("components/blue-desk/BlueDeskHeader.tsx","utf8");

test("Watch's default branch is a bounded read-only thesis projection before heavyweight news aggregation",()=>{
  const cut=route.indexOf("data-bluebelly-watch"); // Component marker stays in component, not duplicated route.
  assert.equal(cut,-1);
  assert.match(route,/const isFocusedStoryReader=/);
  assert.match(route,/if\(!isFocusedStoryReader\)/);
  assert.match(route,/getPublicThesisLedger\(now,24\)/);
  assert.match(route,/orderStoriesByLatestMotion\(tracked,linkedMotion,now\)\.slice\(0,8\)/);
  assert.ok(route.indexOf("if(!isFocusedStoryReader)") < route.indexOf("const \[raw, theses, observations"));
});
test("Existing deep-linked Story feature/news/brief and category routes remain supported",()=>{
  for(const name of ["story","category","feature","news","brief","catalyst","policy","reported","postEvent","page"]){
    assert.ok(route.includes('"'+name+'"'),"Preserved exact selector: "+name);
  }
  assert.match(lean,/\?story=/);
  assert.match(lean,/\?category=All#persistent-theses/);
});
test("Watch stays historical and source-aware; no new price signal is generated",()=>{
  assert.match(lean,/dated research snapshots, not live trading signals/i);
  assert.match(lean,/Linked \{story\.latestMotionVerification==="VERIFIED"/);
  assert.match(lean,/No new linked event displayed/);
  assert.match(lean,/story\.invalidation/);
  assert.doesNotMatch(lean,/createSupabaseAdminClient|\.insert\(|\.upsert\(|\.update\(/);
});
test("Market-first global navigation remains Markets, Calendar, Watch",()=>{
  assert.match(header,/const PUBLIC_NAV = \[\s*\["Markets"[\s\S]*\["Calendar"[\s\S]*\["Watch"/);
  assert.match(header,/const PUBLIC_MORE/);
});
