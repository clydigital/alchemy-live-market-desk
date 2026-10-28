import assert from "node:assert/strict";
import {readdirSync,readFileSync} from "node:fs";
import {join,relative} from "node:path";
import test from "node:test";
import {blueDeskHostAccess,blueDeskPresentationTarget} from "../lib/blue-desk-host.ts";

const base=process.cwd();
function walk(dir:string):string[]{
 return readdirSync(join(base,dir),{withFileTypes:true}).flatMap(entry=>{
  const file=join(dir,entry.name);
  return entry.isDirectory()?walk(file):entry.name.endsWith(".css")?[file]:[];
 });
}
const cssFiles=[...walk("app"),...walk("components")];

test("Figtree is one self-hosted site font across all CSS including print views",()=>{
 const layout=readFileSync(join(base,"app/layout.tsx"),"utf8");
 const globals=readFileSync(join(base,"app/globals.css"),"utf8");
 assert.match(layout,/Figtree\(\{ subsets: \["latin"\]/);
 assert.match(layout,/className=\{figtree.variable\}/);
 assert.match(globals,/--bluebelly-font:\s*var\(--font-figtree\)/);
 for(const path of cssFiles){
  const source=readFileSync(join(base,path),"utf8");
  // No accidental editorial serif, Arial, Inter or monospace stack overrides.
  assert.doesNotMatch(source,/\bGeorgia\b|\bTimes New Roman\b|\bJetBrains Mono\b|font-family\s*:\s*(?:Arial|Helvetica|Inter|monospace|system-ui|ui-monospace)|\bfont\s*:\s*[^;{}]*\b(?:Arial|Georgia|Inter|monospace)\b/i,path);
 }
 const display=readFileSync(join(base,"components/live-desk/DisplaySettings.tsx"),"utf8");
 assert.match(display,/Typeface: Figtree/);
 assert.doesNotMatch(display,/font\.stack|"Serif", stack|"Mono", stack/);
 const art=readFileSync(join(base,"components/blue-desk/EditorialStoryArt.tsx"),"utf8");
 assert.doesNotMatch(art,/fontFamily="Arial/);
});

test("plugin handoff destinations are real and visibility is not inferred from their labels",()=>{
 for(const path of ["/","/newsroom","/regime-watch","/markets","/calendar","/daily-report","/key-stories"]){
  assert.equal(blueDeskHostAccess(path,"bluebelly-desk.vercel.app"),"public",path);
 }
 for(const path of ["/owner/presenter","/owner/research","/owner/x-wire","/my-reports","/owner/editorial","/owner/daily-report"]){
  assert.equal(blueDeskHostAccess(path,"bluebelly-desk.vercel.app"),"private",path);
  assert.equal(blueDeskPresentationTarget(path,"bluebelly-desk.vercel.app"),null,path);
 }
 for(const path of ["/hybrid-output/prepare","/owner/publications","/api/internal/canonical-feed","/api/cron/research/morning","/newsroom/private"]){
  assert.equal(blueDeskHostAccess(path,"bluebelly-desk.vercel.app"),"blocked",path);
 }
 assert.equal(blueDeskPresentationTarget("/newsroom","bluebelly-desk.vercel.app"),"/blue-desk/newsroom");
 assert.equal(blueDeskPresentationTarget("/regime-watch","bluebelly-desk.vercel.app"),"/blue-desk/regime-watch");
 const newsroom=readFileSync(join(base,"app/blue-desk/newsroom/page.tsx"),"utf8");
 assert.match(newsroom,/selectVerifiedNewsBriefs/);
 assert.match(newsroom,/combineQualifiedNews/);
 assert.doesNotMatch(newsroom,/x_wire_posts|market_motion_items|creator_transcript|service_role/);
});
