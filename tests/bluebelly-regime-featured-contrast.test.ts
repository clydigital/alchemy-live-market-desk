import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const css=readFileSync(new URL("../app/blue-desk/regime-watch/regime-watch.module.css",import.meta.url),"utf8");
test("featured crash CTA keeps readable dark text in default yellow/black theme, including hover and icon",()=>{
 assert.match(css,/\.crashFeaturedLink,\s*\.crashFeaturedLink:visited,\s*\.crashFeaturedLink:hover,\s*\.crashFeaturedLink:focus-visible\s*\{\s*color:#101010;/);
 assert.match(css,/\.crashFeaturedLink span\{color:inherit\}/);
 assert.match(css,/\.crashFeaturedLink\{[^}]*background:var\(--bb-accent\)/);
});
