import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {entityPortrait,entityForAsset} from '../lib/bluebelly-entity-identity.ts';
test('portraits use explicit identity metadata, never a headline or ticker substring',()=>{
 assert.equal(entityPortrait('company','AMZN'),'/bluebelly/actors/amazon.svg');
 assert.equal(entityPortrait('institution','FED'),'/bluebelly/actors/us.svg');
 assert.equal(entityPortrait('company','000660.KS'),'/bluebelly/actors/sk.svg');
 assert.equal(entityForAsset('000660.KS')?.kind,'company');
 for(const [kind,code] of [['company','SK'],['asset','AMZN'],['company','US'],['country','AMZN'],['company','unknown']] as const)assert.equal(entityPortrait(kind,code),null);
});
test('every portrait is a first-party passive SVG with isolated IDs and original hash',()=>{
 const manifest=JSON.parse(readFileSync('docs/bluebelly-actor-assets.json','utf8'));
 assert.equal(manifest.assets.length,10);
 for(const asset of manifest.assets){
  assert.ok(existsSync('public/bluebelly/actors/'+asset.file));
  const svg=readFileSync('public/bluebelly/actors/'+asset.file,'utf8');
  assert.doesNotMatch(svg,/<script|onload=|href="https?:/i);
  assert.match(svg,/aria-label=/);
 }
});
test('four accent palettes preserve stable article canvas and semantic market colours',()=>{
 const tokens=readFileSync('app/bluebelly-tokens.css','utf8');
 for(const colour of ['#ffdb23','#49e2d0','#3da8ff','#b9e9aa'])assert.ok(tokens.includes(colour));
 assert.equal((tokens.match(/--bb-canvas:/g)||[]).length,1);
 assert.doesNotMatch(tokens,/--positive|--negative|--gain|--loss/);
 const prefs=readFileSync('components/blue-desk/ThemePreferences.tsx','utf8');
 assert.match(prefs,/type="radio"/);assert.match(prefs,/catch\{/);
});


test('public editorial and glossary cards inherit all four live Bluebelly themes',()=>{
 const tokens=readFileSync('app/bluebelly-tokens.css','utf8');
 const prefs=readFileSync('components/blue-desk/ThemePreferences.tsx','utf8');
 for(const theme of ['yellow-black','turquoise','neon-blue','pastel-green'])assert.ok(prefs.includes(theme));
 for(const token of ['--bb-card-bg:','--bb-card-bg-hover:','--bb-card-border:','--bb-card-quiet:','--bb-card-focus:'])
  assert.ok(tokens.includes(token),token);
 assert.match(tokens,/--bb-card-bg:[^;]*var\(--bb-accent\)/);
 assert.match(tokens,/--bb-card-border:[^;]*var\(--bb-accent\)/);
 // Never tint real positive/negative changes with a brand accent.
 assert.doesNotMatch(tokens,/--positive|--negative|--gain|--loss/);
 const cardStyles=[
  'app/blue-desk/learn/learn.module.css',
  'app/blue-desk/key-stories/key-stories.module.css',
  'app/blue-desk/daily-report/daily-report.module.css',
  'components/blue-desk/bluebelly-newsfront.module.css',
  'components/blue-desk/DecisionBrief.module.css',
  'components/blue-desk/DailyEditorialRundown.module.css',
  'components/blue-desk/NewsroomLensExplorer.module.css',
  'app/blue-desk/tracked-stories.module.css',
  'app/blue-desk/regime-watch/[lensId]/lens.module.css'
 ];
 for(const path of cardStyles){
  const css=readFileSync(path,'utf8');
  assert.match(css,/var\(--bb-card-bg\)/,path+' card background');
  assert.match(css,/var\(--bb-card-border\)/,path+' card border');
  assert.match(css,/var\(--bb-accent\)/,path+' accent interaction');
  assert.match(css,/var\(--bb-card-bg-hover\)/,path+' interaction treatment');
 }
 const glossary=readFileSync(cardStyles[0],'utf8');
 assert.match(glossary,/\.entry:hover\{/);
 assert.match(glossary,/\.entry:target\{outline:2px solid var\(--bb-accent\)/);
 assert.match(glossary,/@media\(max-width:730px\)\{\.grid\{grid-template-columns:1fr/);
 const art=readFileSync('components/blue-desk/EditorialStoryArt.tsx','utf8');
 assert.match(art,/stroke="var\(--bb-accent\)"/);
 assert.match(art,/fill="var\(--bb-card-quiet\)"/);
 assert.match(art,/NOT MARKET DATA/);
});

test('Key Stories coverage is a compact high-contrast cyberpunk HUD, not nested pill counters',()=>{
 const page=readFileSync('app/blue-desk/key-stories/page.tsx','utf8');
 const css=readFileSync('app/blue-desk/key-stories/key-stories.module.css','utf8');
 assert.match(page,/data-coverage-hud="public-source-counts"/);
 assert.equal((page.match(/className=\{ui\.summaryMetric\}/g)||[]).length,3);
 assert.match(page,/className=\{ui\.summaryTimestamp\}/);
 assert.match(page,/className=\{ui\.summaryTime\}/);
 assert.match(page,/<strong>\{theses\.length\}<\/strong>/);
 assert.match(css,/\.summary\{\s*display:grid/);
 assert.match(css,/\.summaryMetric,.summaryTimestamp\{/);
 assert.match(css,/clip-path:polygon/);
 assert.match(css,/\.summaryMetric::before,.summaryTimestamp::before\{/);
 assert.match(css,/\.summaryMetric strong\{/);
 assert.match(css,/color:var\(--bb-text\)/);
 assert.match(css,/\.summaryTime>small\{color:var\(--bb-muted\)/);
 assert.match(css,/@media\(max-width:1050px\)/);
 assert.match(css,/@media\(max-width:480px\)/);
 assert.doesNotMatch(css,/\.summary span\{/);
 assert.doesNotMatch(css,/\.summaryMetric[^}]*border-radius:(?:100px|50px|100%)/);
});
