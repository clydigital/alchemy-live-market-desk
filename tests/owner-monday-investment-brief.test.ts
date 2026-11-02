import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const owner=read("components/blue-desk/OwnerPortfolioHome.tsx");
const brief=read("components/blue-desk/OwnerMondayInvestmentBrief.tsx");
const css=read("components/blue-desk/OwnerPortfolioHome.module.css");
const portal=read("app/my-reports/page.tsx");

test("Monday decision edition stays inside authenticated owner-only portfolio",()=>{
 assert.match(owner,/supabase\.auth\.getUser\(\)/);
 assert.match(owner,/app_access_allowlist/);
 assert.match(owner,/\.eq\("owner_user_id",user.id\)/);
 assert.match(owner,/snapshot\?\.legacy_source_retired===true/);
 assert.ok(owner.indexOf("<OwnerMondayInvestmentBrief/>")>owner.indexOf("!ready?"));
 assert.ok(owner.indexOf("<OwnerMondayInvestmentBrief/>")<owner.indexOf("<OwnerPowerStackFullScan"));
 assert.match(portal,/view==="portfolio"\?<OwnerPortfolioHome/);
 assert.doesNotMatch(brief,/power_stack_owner_snapshots|createSupabaseAdminClient|service_role/);
});

test("Monday edition is source-dated, preserves original single table and has no trade action",()=>{
 assert.match(brief,/2 Nov 2026/);
 assert.match(brief,/30 Oct 2026 completed equity session/);
 for(const ticker of ["YTLPOWR","DAYANG","TSLA","TTWO","XOM","CF","MU","TSM","GRAB","VGIT"]){
  assert.ok(brief.includes(ticker),ticker+" decision missing");
 }
 assert.match(brief,/1D/);assert.match(brief,/3D/);assert.match(brief,/5D/);
 assert.match(brief,/No order, score change, portfolio position change/);
 assert.match(brief,/not broker-confirmed/);
 assert.match(owner,/<OwnerPowerStackFullScan/);
 assert.match(css,/\.mondayBrief\{/);
});

test("Source-backed investment brief does not rewrite Newsroom or Bluebelly Regime",()=>{
 assert.match(brief,/investor\.exxonmobil\.com/);
 assert.match(brief,/dayang\.listedcompany\.com/);
 assert.match(brief,/motir\.go\.kr/);
 assert.match(brief,/app\.notion\.com/);
 assert.doesNotMatch(brief,/update\(|insert\(|upsert\(|fetch\(/);
});
