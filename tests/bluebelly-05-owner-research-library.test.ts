import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { blueDeskHostAccess, blueDeskPresentationTarget } from "../lib/blue-desk-host.ts";

const read = (path:string) => readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Owner Research Library stays private while separately approved editorial Research is public",()=>{
  assert.equal(blueDeskHostAccess("/owner/research","bluebelly-desk.vercel.app"),"private");
  assert.notEqual(blueDeskHostAccess("/owner/research","alchemy-live-market-desk.vercel.app"),"public");
  assert.equal(blueDeskPresentationTarget("/owner/research","bluebelly-desk.vercel.app"),null);
  for (const path of ["/owner/research/foo","/api/owner/research","/api/notion","/owner/research/"]) {
    assert.notEqual(blueDeskHostAccess(path,"bluebelly-desk.vercel.app"),"public");
    assert.notEqual(blueDeskHostAccess(path,"bluebelly-desk.vercel.app"),"private");
  }
  assert.equal(blueDeskHostAccess("/research","bluebelly-desk.vercel.app"),"public");
  assert.equal(blueDeskHostAccess("/blue-desk/research","bluebelly-desk.vercel.app"),"public");
  assert.equal(blueDeskPresentationTarget("/research","bluebelly-desk.vercel.app"),"/blue-desk/research");
  const middleware=read("middleware.ts");
  assert.match(middleware,/supabase\.auth\.getClaims\(\)/);
  assert.match(middleware,/app_access_allowlist/);
});
test("private and public research have visibly different navigation destinations",()=>{
  const nav=read("components/blue-desk/BlueDeskHeader.tsx");
  assert.doesNotMatch(nav.split("const PRIVATE_NAV = [")[1]?.split("] as const;")[0]||"",/\["Research Library", "\/owner\/research"\]/);
  assert.match(read("app/my-reports/page.tsx"),/href="\/owner\/research"/);
  assert.match(nav,/activePath === "\/owner\/research"/);
  const pub=nav.split("const PUBLIC_NAV = [")[1]?.split("] as const;")[0] || "";
  assert.doesNotMatch(pub,/\["Research Library", "\/owner\/research"\]/);
  const more=nav.split("const PUBLIC_MORE = [")[1]?.split("] as const;")[0] || "";
  assert.match(more,/\["Research Archive", "\/research"\]/);
  assert.doesNotMatch(more,/\["Research Library", "\/owner\/research"\]/);
  const priv=nav.split("const PRIVATE_NAV = [")[1]?.split("] as const;")[0] || "";
  assert.doesNotMatch(priv,/\["Research Library", "\/owner\/research"\]/);
  assert.match(read("app/my-reports/page.tsx"),/href="\/owner\/research"/);
  assert.equal(blueDeskHostAccess("/owner/research","bluebelly-desk.vercel.app"),"private");
});
test("Research Library uses preexisting private read-only Notion intake and exposes provenance",()=>{
  const page=read("app/owner/research/page.tsx");
  const explorer=read("components/blue-desk/ResearchLibraryExplorer.tsx");
  assert.match(page,/fetchTodayNotionResearch/);
  assert.match(page,/data-owner-research-library="private-read-only"/);
  assert.match(explorer,/Research is not a Dossier decision/);
  assert.match(explorer,/recent source-page previews retrieved/);
  assert.match(explorer,/Browse MacroPulse archives/);
  assert.match(explorer,/latestPulse\?\.url/);
  assert.doesNotMatch(explorer,/Open 26 October market map/);
  assert.doesNotMatch(page+explorer,/service_role|createSupabaseClient|insert\(|update\(|delete\(|upsert\(/);
  assert.doesNotMatch(page+explorer,/process\.env|NOTION_TOKEN|NEXT_PUBLIC_NOTION/);
});
