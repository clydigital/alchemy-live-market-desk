import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {computeMaterialEditorialRecall,materialEventKey} from "../lib/bluebelly-material-editorial-recall.ts";

const url="https://www.sec.gov/Archives/edgar/data/2130357/000162828026067168/0001628280-26-067168-index.htm";
const original={itemKey:"official-edgar:anthropic-sec-ipo-26",title:"Anthropic, PBC filed Form S-1 with the SEC",
 url,publishedAt:"2026-10-26T13:00:11Z",materiality:95,sourceQuality:95};
const slate={dayMyt:"2026-10-28",producedAt:"2026-10-28T01:00:00Z",
 ideas:[{title:"Broadcom $63 billion equipment financing for Anthropic compute"}],
 notes:"RECALL[ANTHROPIC:IPO]=EXCLUDED because cash analysis looked stronger"};
test("new editorial slates cannot hide material S-1 with legacy free-text notes",()=>{
 const rows=computeMaterialEditorialRecall([original],slate,new Date("2026-10-28T01:30:00Z"));
 assert.equal(rows.length,1);
 assert.equal(rows[0].key,"anthropic:ipo");
 assert.equal(rows[0].status,"unacknowledged");
});
test("structured exact source receipts make rejected original event auditable",()=>{
 const rows=computeMaterialEditorialRecall([original],{...slate,
  receipts:[{item_key:original.itemKey,source_url:url,disposition:"EXCLUDED",
   reason:"Broadcom is the stronger cash-flow decision today."}]},
  new Date("2026-10-28T01:30:00Z"));
 assert.equal(rows[0].status,"excluded_with_reason");
});
test("receipt with wrong issuer, source URL, or selected idea does not excuse omission",()=>{
 const rows=computeMaterialEditorialRecall([original],{...slate,
  receipts:[{item_key:"official-edgar:other",source_url:"https://www.sec.gov/other",
   disposition:"EXCLUDED",reason:"Not the same originally accepted filing"}]},
  new Date("2026-10-28T01:30:00Z"));
 assert.equal(rows[0].status,"unacknowledged");
 const wronglySelected=computeMaterialEditorialRecall([original],{...slate,
  receipts:[{item_key:original.itemKey,source_url:url,disposition:"SELECTED",
   reason:"An IPO was wrongly claimed as covered by a Broadcom note"}]},
  new Date("2026-10-28T01:30:00Z"));
 assert.equal(wronglySelected[0].status,"unacknowledged");
});
test("material original-source receipts are mandatory only for new fully source-checked slates",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261028033000_material_event_editorial_receipts.sql",import.meta.url),"utf8");
 assert.match(sql,/NEW\.day_myt < date '2026-10-28'/);
 assert.match(sql,/NEW\.verification_status <> 'source_checked'/);
 assert.match(sql,/source_quality>=90 and materiality>=80/);
 assert.match(sql,/created_at <= NEW\.produced_at/);
 assert.match(sql,/published_at <= NEW\.produced_at/);
 assert.match(sql,/MATERIAL_EVENT_NOT_ACKNOWLEDGED/);
 assert.match(sql,/MATERIAL_EVENT_SELECTION_NEEDS_SOURCE_URL/);
 assert.match(sql,/jsonb_array_length\(material_event_receipts\)<=30/);
 assert.match(sql,/drop trigger if exists/);
 assert.match(sql,/revoke all on public\.blue_desk_editorial_slates from public,anon,authenticated/);
 assert.doesNotMatch(sql,/create table|story_thesis_versions|new cron/i);
});

test("a Tesla material 8-K becomes an editorial candidate, not an invented completed deal",()=>{
 assert.equal(materialEventKey("Tesla, Inc. filed Form 8-K with SEC (item codes 1.01)"),"tesla:material-filing");
 assert.equal(materialEventKey("Tesla and SpaceX special committees discussing merger"),"spacex-tesla:merger");
});

test("issuer equity offering and proposed corporate combinations are distinct decisions",()=>{
 assert.equal(materialEventKey("Meta Announces Pricing of Offering of Class A Common Stock"),"meta:capital");
 assert.equal(materialEventKey("Anthropic files to go public ahead of listing"),"anthropic:ipo");
 assert.equal(materialEventKey("Tesla and SpaceX consider proposed combination"),"spacex-tesla:merger");
});
