import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const route=readFileSync("app/blue-desk/key-stories/page.tsx","utf8");
const lean=readFileSync("components/blue-desk/LeanWatch.tsx","utf8");
const header=readFileSync("components/blue-desk/BlueDeskHeader.tsx","utf8");

test("Bare Key Stories redirects to Newsroom before source aggregation",()=>{
  assert.match(route,/const isFocusedStoryReader=/);
  assert.match(route,/if\(!isFocusedStoryReader\) redirect\(blueDeskPublicHref\("\/blue-desk\/newsroom",host\)\)/);
  assert.ok(route.indexOf("if(!isFocusedStoryReader)") < route.indexOf("const [raw, theses, observations"));
  assert.doesNotMatch(route,/<LeanWatch/);
  assert.match(route,/getPublicThesisLedger\(now,24\)/);
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
test("Sidebar removes Watch while Newsroom and research remain",()=>{
  for(const section of ["PUBLIC_NAV","PRIVATE_NAV"]){
    const nav=header.split("const "+section+" = [")[1]?.split("] as const;")[0]||"";
    assert.doesNotMatch(nav,/Watch|key-stories/);
  }
  assert.match(header,/\["Newsroom", "\/newsroom"\]/);
  assert.match(route,/\?category=All#persistent-theses/);
});
