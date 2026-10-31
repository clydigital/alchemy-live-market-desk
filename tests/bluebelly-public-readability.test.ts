import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const files={
 newsroom:read("components/blue-desk/bluebelly-newswire.module.css"),
 stories:read("app/blue-desk/key-stories/key-stories.module.css"),
 daily:read("app/blue-desk/daily-report/daily-report.module.css"),
 hormuz:read("app/blue-desk/hormuz/hormuz.module.css"),
 markets:read("app/blue-desk/markets/legibility.module.css"),
 regime:read("app/blue-desk/regime-watch/regime-watch.module.css"),
 lens:read("app/blue-desk/regime-watch/[lensId]/lens.module.css"),
 learn:read("app/blue-desk/learn/learn.module.css"),
 header:read("app/blue-desk/blue-desk.module.css"),
};

test("the main story descriptions do not remain 12px microcopy",()=>{
 assert.match(files.newsroom,/\.item p\{font-size:15px;line-height:1\.73/);
 assert.match(files.stories,/\.card p,\.catalystCard p,\.calendarCard p\{font-size:15px/);
 assert.match(files.daily,/\.news p,\.reading p,\.watch p,\.storyParagraph\{font-size:15px!important/);
 assert.match(files.hormuz,/\.metric>p,\.incidentCard p,\.scenarios p\{font-size:14px/);
 assert.match(files.markets,/\.marketSection p\{font-size:15px/);
 assert.match(files.regime,/\.card \.content \.lensReason\{font-size:15px/);
 assert.match(files.lens,/\.outlookNarrative>p,\.verifiedStory\{font-size:16px/);
 assert.match(files.learn,/\.slideLines p\{font-size:clamp\(17px,1\.65vw,23px\)/);
});

test("secondary text stays readable and primary controls offer touch targets",()=>{
 for(const [label,file,selector] of [
  ["newsroom filters",files.newsroom,/\.filter,\.selected,\.hotButton,\.hotSelected\{[^}]*min-height:44px/],
  ["key story links",files.stories,/\.indexNav a,\.indexNav a:first-child\{[^}]*min-height:44px/],
  ["daily links",files.daily,/\.quickNav a\{[^}]*min-height:44px/],
  ["hormuz links",files.hormuz,/\.actions a\{[^}]*min-height:44px/],
  ["markets links",files.markets,/\.marketGroups a\{[^}]*min-height:44px/],
  ["regime hero actions",files.regime,/\.heroActions a\{[^}]*min-height:44px/],
  ["lens navigation",files.lens,/\.pageNav a\{[^}]*min-height:44px/],
  ["learn controls",files.learn,/\.readerBar button,\.readerNav button,\.readerNav select\{[^}]*min-height:44px/],
  ["global nav",files.header,/\.navItem,\.navActive\{[^}]*min-height:44px/],
 ] as const)assert.match(file,selector,label);
 assert.match(files.newsroom,/@media\(max-width:560px\)[\s\S]*\.item p\{display:block;font-size:15px/);
 assert.match(files.learn,/@media\(max-width:730px\)[\s\S]*\.slideLines p\{font-size:16px/);
 assert.match(files.regime,/@media\(max-width:680px\)/);
});

test("accent controls keep dark ink, including the mobile text fill override",()=>{
 const tokens=read("app/bluebelly-tokens.css");
 assert.match(tokens,/--bb-accent-ink:#090a0c/);
 assert.match(files.regime,/\.crashFeaturedLink,\.crashFeaturedLink:visited,\.crashFeaturedLink:hover,\.crashFeaturedLink:focus-visible\{[^}]*color:var\(--bb-accent-ink\)!important/);
 assert.match(files.regime,/-webkit-text-fill-color:var\(--bb-accent-ink\)/);
 assert.match(files.stories,/\.indexNav a:first-child[^}]*color:var\(--bb-accent-ink\)!important/);
 assert.match(files.markets,/\.marketGroups a\[aria-current="page"\][^}]*-webkit-text-fill-color:var\(--bb-accent-ink\)/);
});
