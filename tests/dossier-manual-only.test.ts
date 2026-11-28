import test from "node:test";
import assert from "node:assert/strict";
import {manualOnlyDossierResponse} from "../lib/dossier-manual-only.ts";
test("scheduled Dossier skips without confusing authentication or schedule state",async()=>{
 const denied=manualOnlyDossierResponse(false,true);assert.equal(denied.status,401);
 assert.equal((await manualOnlyDossierResponse(true,false).json()).status,"disabled");
 const result=manualOnlyDossierResponse(true,true);assert.equal(result.status,200);assert.equal(result.headers.get("cache-control"),"private, no-store");
 assert.deepEqual(await result.json(),{status:"not_required",mode:"MANUAL_ONLY",reason:"Dossier is owner-requested reference material"});
});
