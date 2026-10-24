import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseBluebellyExactPrepQuery } from "../lib/bluebelly-exact-prep-query.ts";

const UUID="fcea17ef-f575-4283-a363-7d5fa9c918c7";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("bare Presenter history URL is a picker, never a latest-edition selection",()=>{
  assert.deepEqual(parseBluebellyExactPrepQuery({}),{state:"picker"});
  for (const params of [
    {story:"ai"}, {motion:"motion-1"}, {regime:"rates"},
    {event:"cpi"}, {story:"ai",regime:"rates"},
  ]) assert.deepEqual(parseBluebellyExactPrepQuery(params),{state:"invalid"});
});

test("invalid, duplicated, empty or unrecognised pinned params are rejected before source reads",()=>{
  const bad=[
    {edition:""},{edition:" "},{edition:"current"},
    {edition:["old",UUID]},{edition:UUID,story:["x","x"]},
    {edition:UUID,event:"\ncontrol"},
    {edition:UUID,regime:"a".repeat(181)},
    {edition:UUID,regime:"  "},
    {edition:UUID,unknown:"yes"},
    {edition:UUID,["__proto__"]:"test"},
  ];
  for (const query of bad) assert.equal(parseBluebellyExactPrepQuery(query).state,"invalid",JSON.stringify(query));
});

test("valid exact edition and all four bounded focus selectors preserve frozen identity",()=>{
  assert.deepEqual(parseBluebellyExactPrepQuery({
    edition:UUID.toUpperCase(),
    story:" ai-energy ",motion:"motion-1",
    regime:"rates",event:"fed-policy",
  }),{
    state:"exact",editionId:UUID,
    focus:{story:"ai-energy",motion:"motion-1",regime:"rates",event:"fed-policy"},
  });
  assert.deepEqual(parseBluebellyExactPrepQuery({edition:UUID}),{
    state:"exact",editionId:UUID,focus:{},
  });
});

test("actual Bluebelly route handles invalid and unpinned states before archival reads",()=>{
  const route=read("app/blue-desk/presenter/full-prep/page.tsx");
  const current=read("app/blue-desk/presenter/page.tsx");
  const invalid=route.indexOf('if (parsed.state === "invalid") notFound()');
  const picker=route.indexOf('if (parsed.state === "picker")');
  const source=route.indexOf("getHybridExactDailyBriefEdition(requested)");
  const superseder=route.indexOf("getHybridDirectDailyBriefSuperseders(requested)");
  assert.ok(invalid>=0 && picker>invalid && source>picker && superseder>picker);
  assert.match(route,/parseBluebellyExactPrepQuery\(await searchParams\)/);
  assert.match(route,/buildPresenterPrepEditionIndex\(/);
  assert.match(route,/encodeURIComponent\(row\.snapshotId\)/);
  assert.match(route,/const requested = parsed\.editionId/);
  assert.doesNotMatch(route,/readQuery\(query, "edition"\)/);
  assert.match(current,/redirect\(bluebellyOwnerPresenterHref\("history",host\) \+ "\?" \+ params\.toString\(\)\)/);
  assert.match(current,/href=\{bluebellyOwnerPresenterHref\("history",host\)\}/);
  assert.doesNotMatch(route,/<EditorialWorkbench|generateContent|createSupabaseAdminClient/);
});
