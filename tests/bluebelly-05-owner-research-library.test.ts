import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { blueDeskHostAccess, blueDeskPresentationTarget } from "../lib/blue-desk-host.ts";

const read = (path:string) => readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Research Library is an exact private Bluebelly enclave, never an anonymous public page",()=>{
  assert.equal(blueDeskHostAccess("/owner/research","bluebelly-desk.vercel.app"),"private");
  assert.notEqual(blueDeskHostAccess("/owner/research","alchemy-live-market-desk.vercel.app"),"public");
  assert.equal(blueDeskPresentationTarget("/owner/research","bluebelly-desk.vercel.app"),null);
  for (const path of ["/owner/research/foo","/api/owner/research","/research","/api/notion","/owner/research/"]) {
    assert.notEqual(blueDeskHostAccess(path,"bluebelly-desk.vercel.app"),"public");
    assert.notEqual(blueDeskHostAccess(path,"bluebelly-desk.vercel.app"),"private");
  }
  const middleware=read("middleware.ts");
  assert.match(middleware,/supabase\.auth\.getClaims\(\)/);
  assert.match(middleware,/app_access_allowlist/);
});
test("research link is visible in both menus but remains owner-only",()=>{
  const nav=read("components/blue-desk/BlueDeskHeader.tsx");
  assert.match(nav,/\["Research Library", "\/owner\/research"\]/);
  assert.match(nav,/activePath === "\/owner\/research"/);
  const pub=nav.split("const PUBLIC_NAV = [")[1]?.split("] as const;")[0] || "";
  assert.match(pub,/\["Research Library", "\/owner\/research"\]/);
  assert.equal(blueDeskHostAccess("/owner/research","bluebelly-desk.vercel.app"),"private");
});
test("Research Library uses preexisting private read-only Notion intake and exposes provenance",()=>{
  const page=read("app/owner/research/page.tsx");
  const explorer=read("components/blue-desk/ResearchLibraryExplorer.tsx");
  assert.match(page,/fetchTodayNotionResearch/);
  assert.match(page,/data-owner-research-library="private-read-only"/);
  assert.match(explorer,/Research is not a Dossier decision/);
  assert.match(explorer,/The search covers the visible index and recent retrieved page previews/);
  assert.match(explorer,/Open 26 October market map/);
  assert.doesNotMatch(page+explorer,/service_role|createSupabaseClient|insert\(|update\(|delete\(|upsert\(/);
  assert.doesNotMatch(page+explorer,/process\.env|NOTION_TOKEN|NEXT_PUBLIC_NOTION/);
});
