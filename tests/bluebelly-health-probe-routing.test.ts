import test from "node:test";
import assert from "node:assert/strict";
import {blueDeskHostAccess,blueDeskPresentationTarget,BLUEBELLY_PRESENTATION_HOST} from "../lib/blue-desk-host.ts";
test("daily external database probe is reachable without opening adjacent APIs",()=>{
 const path="/api/health/supabase-keepalive";
 assert.equal(blueDeskHostAccess(path,BLUEBELLY_PRESENTATION_HOST),"public");
 assert.equal(blueDeskPresentationTarget(path,BLUEBELLY_PRESENTATION_HOST),null);
 assert.equal(blueDeskHostAccess(path+"/private",BLUEBELLY_PRESENTATION_HOST),"blocked");
 assert.equal(blueDeskHostAccess("/api/health",BLUEBELLY_PRESENTATION_HOST),"blocked");
 assert.equal(blueDeskHostAccess("/api/health/internal",BLUEBELLY_PRESENTATION_HOST),"blocked");
});
