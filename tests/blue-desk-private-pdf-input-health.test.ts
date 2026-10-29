import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("Bluebelly private PDF handoff panel only reads actual persisted research",()=>{
 const panel=read("components/blue-desk/OwnerPrivatePdfInputHealth.tsx");
 const page=read("app/my-reports/page.tsx");
 assert.ok(panel.includes("session.auth.getUser()"));
 assert.ok(panel.includes("app_access_allowlist"));
 assert.ok(panel.includes("getLatestEditorialSlate"));
 assert.ok(panel.includes("getOwnerDeliveredResearchBriefs"));
 assert.ok(panel.includes("lastSlate.dayMyt===today"));
 assert.ok(panel.includes("INVOCATIONS NOT AUDITABLE"));
 assert.ok(panel.includes("NO AUTOMATIC PDF HANDOFF"));
 assert.ok(panel.includes("data-private-report-handoff-health"));
 assert.ok(page.includes("<OwnerPrivatePdfInputHealth/>"));
 assert.ok(!read("app/blue-desk/daily-report/page.tsx").includes("OwnerPrivatePdfInputHealth"));
 assert.ok(read("components/blue-desk/BlueDeskHeader.tsx").includes('"My Desk", "/my-reports"'));
});
