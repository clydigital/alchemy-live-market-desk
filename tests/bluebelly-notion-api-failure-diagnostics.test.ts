import test from "node:test";
import assert from "node:assert/strict";
import {notionResearchErrorHint} from "../lib/notion-market-research.ts";

test("Notion status hints are actionable and contain only fixed text",()=>{
  const cases=[
    {code:400,expected:"request/schema"},
    {code:401,expected:"rejected"},
    {code:403,expected:"permissions"},
    {code:404,expected:"not shared"},
    {code:429,expected:"rate limit"},
  ];
  for(const entry of cases){
    const hint=notionResearchErrorHint(Error("Notion read failed: "+entry.code));
    assert.ok(hint.includes(entry.expected));
    assert.equal(hint.includes("https://"),false);
  }
  assert.equal(notionResearchErrorHint(Error("unexpected provider detail")),"network error or timeout");
});
