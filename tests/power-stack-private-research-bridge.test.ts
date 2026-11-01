import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("Power Stack research cache is server-only and single-owner bounded",()=>{
 const c=source("lib/power-stack-private-research-server.ts");
 assert.match(c,/import "server-only"/);
 assert.match(c,/createSupabaseAdminClient/);
 assert.match(c,/\.limit\(2\)/);
 assert.match(c,/data\.length !== 1/);
 assert.match(c,/field: "developingThemes" \| "fundamentalsSnapshot"/);
 assert.doesNotMatch(c,/NEXT_PUBLIC_|\.rpc\(|insert\(|update\(|delete\(/);
});
test("private research archives preserve existing fact gates and frozen imports",()=>{
 const t=source("lib/power-stack-themes.ts");
 const f=source("lib/power-stack-ratings.ts");
 assert.match(t,/getPrivatePowerStackArchiveField\("developingThemes"\)/);
 assert.match(t,/recommendedAction: "ignore"/);
 assert.match(t,/evidence: \[\]/);
 assert.match(f,/getPrivatePowerStackArchiveField\("fundamentalsSnapshot"\)/);
 assert.match(f,/parsePowerStackFundamentalsSnapshot\(privateValue\)/);
 assert.match(f,/sourceUrl: "private:power-stack-owner-snapshot"/);
 assert.match(f,/if \(!imported\) return init/);
});
test("owner advisor view is withheld until both owner approval and source retirement",()=>{
 const page=source("app/power-stack/page.tsx");
 assert.match(page,/app_access_allowlist/);
 assert.match(page,/legacy_source_retired === true/);
 assert.match(page,/ready && row \? parseOwnerAdvisor\(row.snapshot\) : null/);
 assert.match(page,/data-power-stack-advisor="private"/);
 assert.match(page,/data-power-stack-watchlist="private"/);
 assert.doesNotMatch(page,/clydigital\.github\.io|raw\.githubusercontent\.com/);
});
