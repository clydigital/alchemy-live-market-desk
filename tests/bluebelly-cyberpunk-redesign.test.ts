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
