import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("My Desk owner hub exposes only aggregates and links to existing authenticated tools",()=>{
 const page=read("app/my-reports/page.tsx");
 assert.match(page,/data-private-desk="source-first-market-workspace"/);
 assert.match(page,/data-v7-private-command="owner-operations-hub"/);
 assert.match(page,/data-my-desk-ingestion="aggregate-private-only"/);
 assert.match(page,/getBluebellyAbsorptionHealth\(\)/);
 assert.match(page,/<AbsorptionHealth health=\{absorption\}\/>/);
 assert.match(page,/data-my-desk-portfolio-status="not-verified"/);
 assert.match(page,/data-my-desk-primary="market-research-shortcuts"/);
 for(const path of ["/power-stack","/owner/research","/owner/x-wire","/market-tools","/markets"])
   assert.ok(page.includes('href="'+path+'"'),"Expected owner shortcut "+path);
 assert.match(page,/redirect\("\/my-reports"\)/);
 assert.match(page,/No new research schedule is started here/);
 assert.doesNotMatch(page,/createSupabaseAdminClient|\bfetch\(|setInterval|cron\.schedule|new Job\(/);
});

test("Owner intake meter is sourced, nonsemantic, null-safe and accessible",()=>{
 const health=read("components/blue-desk/AbsorptionHealth.tsx");
 const source=read("lib/bluebelly-absorption-health.ts");
 const styles=read("components/blue-desk/AbsorptionHealth.module.css");
 assert.match(health,/data-bluebelly-absorption-health="aggregate"/);
 assert.match(health,/!health\?<p className=\{s\.missing\}>/);
 assert.match(health,/data-absorption-meter="sourced-account-health"/);
 assert.match(health,/role="meter"/);
 assert.match(health,/aria-valuetext=/);
 assert.match(health,/health\.healthy\/Math\.max\(1,health\.monitored\)/);
 assert.match(health,/No green status is inferred/);
 assert.match(health,/not proof that every post or claim is independently verified/);
 assert.match(source,/createSupabaseAdminClient/);
 assert.match(source,/return null/);
 assert.match(source,/rows\.filter\(/);
 assert.match(styles,/\.healthTrack\{/);
 assert.match(styles,/prefers-reduced-motion:reduce/);
});

test("Power Stack visual rewrite retains owner verification, migration gate and exact private records",()=>{
 const page=read("app/power-stack/page.tsx");
 const css=read("app/power-stack/private-power-stack.module.css");
 assert.match(page,/import "server-only"/);
 assert.match(page,/createSupabaseServerClient/);
 assert.match(page,/supabase\.auth\.getUser\(\)/);
 assert.match(page,/from\("app_access_allowlist"\)/);
 assert.match(page,/\.eq\("active", true\)/);
 assert.match(page,/from\("power_stack_owner_snapshots"\)/);
 assert.match(page,/\.eq\("owner_user_id", identity\.user\.id\)/);
 assert.match(page,/const ready = row\?\.legacy_source_retired === true && snapshotIsDated/);
 assert.match(page,/data-private-data-ready=\{ready \? "yes" : "no"\}/);
 assert.match(page,/data-power-stack-migration="pending"/);
 assert.match(page,/data-power-stack-source-date="historical-only"/);
 assert.match(page,/data-power-stack-holdings="private"/);
 assert.match(page,/data-power-stack-watchlist="private"/);
 assert.match(page,/data-v7-power-stack="dated-private-portfolio"/);
 assert.match(page,/portfolio\.holdingsTable/);
 assert.match(page,/portfolio\.watchGrid/);
 assert.match(css,/\.holdingsTable th\{/);
 assert.match(css,/\.assetDetails summary:focus-visible/);
 assert.doesNotMatch(page,/setInterval|fetch\(/);
});

test("X Wire retains server pagination, filters and source-state while improving navigation",()=>{
 const page=read("app/owner/x-wire/page.tsx");
 const css=read("app/owner/x-wire/x-wire.module.css");
 assert.match(page,/data-x-wire="owner-paginated-ledger"/);
 assert.match(page,/data-v7-x-wire="private-source-operations"/);
 assert.match(page,/getXWireOwnerView\(params\)/);
 assert.match(page,/getBluebellyAbsorptionHealth\(\)/);
 assert.match(page,/X_WIRE_THEMES\.map/);
 for(const key of ["theme","handle","status","period","q"])
   assert.ok(page.includes('name="'+key+'"'),"X Wire filter "+key);
 assert.match(page,/name="q" maxLength=\{100\}/);
 assert.match(page,/wire\.pageCount>1/);
 assert.match(page,/xWireOwnerHref\(f,\{page:f\.page-1\}\)/);
 assert.match(page,/xWireOwnerHref\(f,\{page:f\.page\+1\}\)/);
 assert.match(page,/data-health=\{a\.status\}/);
 assert.match(page,/p\.text/);
 assert.match(page,/No stored posts match these filters/);
 assert.match(page,/data-v7-x-wire="private-source-operations"/);
 assert.match(css,/\.filterForm select,\.filterForm input\{/);
 assert.match(css,/\.pagination\{/);
 assert.match(css,/\.grid\{/);
 assert.doesNotMatch(page,/startSweep|triggerSweep|refreshSource\(/);
});

test("Protected owner paths remain protected by middleware, not CSS or anonymous routes",()=>{
 const middleware=read("middleware.ts");
 const smoke=read("scripts/bluebelly-regime-ui-smoke.mjs");
 assert.match(middleware,/supabase\.auth\.getClaims\(\)/);
 assert.match(middleware,/from\("app_access_allowlist"\)/);
 assert.match(middleware,/\.eq\("active", true\)/);
 assert.match(middleware,/Cache-Control", "private, no-store"/);
 assert.match(smoke,/\/owner\/x-wire/);
 assert.match(smoke,/\/my-reports/);
 assert.match(smoke,/\/power-stack/);
 assert.match(smoke,/data-power-stack=/);
});
