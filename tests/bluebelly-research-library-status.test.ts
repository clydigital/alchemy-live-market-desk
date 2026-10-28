import test from "node:test";
import assert from "node:assert/strict";
import {researchIntakeDisplay} from "../lib/blue-desk/research-intake-display.ts";
import {readFileSync} from "node:fs";

const statuses=["NOT_CONFIGURED","UNAVAILABLE","PARTIAL","READY_FOR_REVIEW"] as const;

test("server Notion retrieval failure is never interpreted as an empty research archive",()=>{
  for(const status of statuses.slice(0,2)){
    const info=researchIntakeDisplay({status,sources:[]});
    assert.equal(info.connected,false);
    assert.match(info.label,/server-side/i);
    assert.match(info.detail,/Notion/i);
    assert.doesNotMatch(info.detail,/no research (?:exists|was published)/i);
  }
});

test("connected states distinguish bounded previews from full archive completeness",()=>{
  for(const status of statuses.slice(2)){
    const info=researchIntakeDisplay({status,sources:[]});
    assert.equal(info.connected,true);
    assert.match(info.detail,/(research inputs|additional Notion records)/i);
  }
});

test("Research Library keeps original archive access and no longer claims 26 Oct is the latest",()=>{
  const ui=readFileSync(new URL("../components/blue-desk/ResearchLibraryExplorer.tsx",import.meta.url),"utf8");
  assert.match(ui,/latestPulse\?\.url/);
  assert.match(ui,/researchIntakeDisplay\(intake\)/);
  assert.match(ui,/Browse MacroPulse archives/);
  assert.doesNotMatch(ui,/Open 26 October market map/);
  assert.match(ui,/open=\{!connection.connected\}/);
});
