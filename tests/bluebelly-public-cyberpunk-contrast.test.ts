import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const root=read("app/bluebelly-tokens.css");
const key=read("app/blue-desk/key-stories/key-stories.module.css");
const daily=read("app/blue-desk/daily-report/daily-report.module.css");
const news=read("components/blue-desk/bluebelly-newswire.module.css");
const newsroom=read("app/blue-desk/newsroom/newsroom.module.css");
const hormuz=read("app/blue-desk/hormuz/hormuz.module.css");
const markets=read("app/blue-desk/markets/legibility.module.css");
const newsroomPage=read("app/blue-desk/newsroom/page.tsx");
const marketsPage=read("app/blue-desk/markets/page.tsx");
const shared=read("app/blue-desk/blue-desk.module.css");
function luminance(hex:string){
 const rgb=hex.match(/[a-f0-9]{2}/gi);
 assert.ok(rgb && rgb.length===3);
 const values=rgb.map(p=>parseInt(p,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return .2126*values[0]+.7152*values[1]+.0722*values[2];
}
function contrast(a:string,b:string){
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
test("every existing Bluebelly accent meets readable contrast with the shared dark ink",()=>{
 assert.match(root,/--bb-accent-ink:#090a0c/);
 const ink="090a0c";
 for(const accent of ["ffdb23","49e2d0","3da8ff","b9e9aa"]){
  assert.ok(contrast(ink,accent)>=4.5,accent+" WCAG text contrast");
 }
});
test("CP-styled public pages inherit theme tokens without editing the research engines",()=>{
 for(const [name,css] of [["Key Stories",key],["Daily Report",daily],["Newsroom wire",news],["Newsroom lead",newsroom],["Hormuz",hormuz],["Markets",markets]] as const){
  assert.match(css,/var\(--bb-accent\)/,name);
  assert.match(css,/var\(--bb-text\)/,name);
  assert.match(css,/var\(--bb-card-border\)/,name);
  assert.match(css,/var\(--bb-display\)/,name);
  assert.match(css,/@media\(max-width:/,name);
 }
 assert.match(newsroomPage,/className=\{ui.featureLead\}/);
 assert.match(newsroomPage,/className=\{ui.contextBridge\}/);
 assert.match(marketsPage,/legibility.marketHero/);
 assert.match(marketsPage,/legibility.marketGroups/);
 assert.match(marketsPage,/legibility.marketSection/);
 for(const file of [newsroomPage,marketsPage]){
  assert.doesNotMatch(file,/createSupabaseAdminClient|service_role|\.insert\(|\.update\(/);
 }
});
test("yellow or other bright-accent controls cannot inherit white anchor text",()=>{
 assert.match(shared,/\.page a \{ color:/,"Global anchor specificity is understood");
 for(const [name,css,pattern] of [
  ["Key Stories first CTA",key,/\.indexNav a:first-child\{[^}]*color:var\(--bb-accent-ink\)!important/],
  ["Daily PDF CTA",daily,/\.pdfActions a:last-child[^\{]*\{[^}]*color:var\(--bb-accent-ink\)!important/],
  ["Newsroom selected filter",news,/\.selected,\.selected:hover,\.selected:focus-visible\{[^}]*color:var\(--bb-accent-ink\)!important/],
  ["Hormuz primary CTA",hormuz,/\.actions a:first-child[^\{]*\{[^}]*color:var\(--bb-accent-ink\)!important/],
  ["Markets selected tab",markets,/\.marketGroups a\[aria-current="page"\][^\{]*\{[^}]*color:var\(--bb-accent-ink\)!important/],
 ] as const){
  assert.match(css,pattern,name+" readable foreground");
  assert.match(css,/-webkit-text-fill-color:var\(--bb-accent-ink\)/,name+" mobile foreground");
 }
 assert.match(news,/\.chip\{[^}]*color:var\(--bb-accent-ink\)!important/);
});
