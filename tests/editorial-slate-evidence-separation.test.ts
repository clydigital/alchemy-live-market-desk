import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("selecting a new editorial slate cannot inherit an unrelated market tape",()=>{
  const ui=readFileSync(new URL("../components/blue-desk/EditorialWorkbench.tsx",import.meta.url),"utf8");
  assert.match(ui,/\.\.\.EMPTY,kind:format,assetId:""/);
  assert.match(ui,/invalidation:"",missingProof:idea\.missingProof/);
  assert.match(ui,/Unresolved source and price evidence/);
  assert.match(ui,/Missing evidence · UNKNOWN comparisons and unverified claims/);
});
