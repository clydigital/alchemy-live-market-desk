import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Key Stories and Newsroom use the same right-side illustrated metadata and return navigation",()=>{
 const shared=src("components/blue-desk/StoryHeroAside.tsx");
 const styling=src("components/blue-desk/StoryHeroAside.module.css");
 assert.match(shared,/data-story-hero-meta="under-illustration"/);
 assert.match(shared,/<EditorialStoryArt headline=\{headline\} summary=\{summary\}\/>/);
 assert.ok(shared.indexOf("<EditorialStoryArt")<shared.indexOf('data-story-hero-meta="under-illustration"'));
 assert.ok(shared.indexOf('data-story-hero-meta="under-illustration"')<shared.indexOf('Return to {backLabel}'));
 assert.match(shared,/<DualTimestamp value=\{eventAt\|\|null\} sourceDate=\{sourceDate\|\|null\}\/>/);
 assert.match(styling,/\.returnButton\{/);
 assert.match(styling,/@media\(max-width:650px\)/);
 const newsroom=src("components/blue-desk/NewsroomEventReader.tsx");
 assert.match(newsroom,/<StoryHeroAside/);
 assert.match(newsroom,/backHref=\{backHref\} backLabel="Newsroom"/);
 assert.match(newsroom,/<BankCountryBall code=\{bank.countryCode\}/);
 assert.ok(newsroom.indexOf("<h1>{title}</h1>")<newsroom.indexOf("<StoryHeroAside"));
 assert.doesNotMatch(newsroom,/className=\{s\.crumb\}/);
 for(const p of ["components/blue-desk/PostEventRecap.tsx","components/blue-desk/ShortNewsRecap.tsx"]){
  const body=src(p);
  assert.match(body,/<StoryHeroAside/);
  assert.match(body,/backHref=\{backHref\} backLabel="Key Stories"/);
  assert.ok(body.includes("The full story")||body.includes("WHAT WE CAN VERIFY"));
 }
 const deep=src("components/blue-desk/KeyStoryDeepArticle.tsx");
 assert.match(deep,/data-key-story-meta="under-illustration"/);
 assert.match(deep,/Return to Key Stories/);
 assert.doesNotMatch(src("components/blue-desk/NewsroomEventReader.module.css"),/\.art\{display:none/);
});
test("Shared hero is only presentation, not a new editorial or publication source",()=>{
 const hero=src("components/blue-desk/StoryHeroAside.tsx");
 assert.doesNotMatch(hero,/fetch\(|supabase|generateContent|useEffect|dangerouslySetInnerHTML|service.role/i);
 assert.match(hero,/Original event/);
 assert.match(hero,/backHref:string/);
});
