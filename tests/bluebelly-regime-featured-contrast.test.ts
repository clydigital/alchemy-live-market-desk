import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const css=readFileSync(new URL("../app/blue-desk/regime-watch/regime-watch.module.css",import.meta.url),"utf8");
const shared=readFileSync(new URL("../app/blue-desk/blue-desk.module.css",import.meta.url),"utf8");
test("featured yellow crash CTA overrides global link colours in all interaction states",()=>{
 assert.match(shared,/\.page a\s*\{\s*color:/);
 assert.match(css,/\.crashFeaturedLink,\s*\.crashFeaturedLink:visited,\s*\.crashFeaturedLink:hover,\s*\.crashFeaturedLink:focus-visible\s*\{[\s\S]*?color:#101010 !important;/);
 assert.match(css,/\.crashFeaturedLink span\{\s*color:#101010 !important;/);
 assert.match(css,/-webkit-text-fill-color:#101010/);
 assert.match(css,/\.crashFeaturedLink\{[^}]*background:var\(--bb-accent\)/);
});
