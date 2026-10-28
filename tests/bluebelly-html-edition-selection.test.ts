import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";
import {selectHtmlEditorialShortlist} from "../lib/bluebelly-html-editorial-shortlist.ts";
const now=new Date("2026-10-27T14:00:00Z");
const news=(id:string,occurredAt:string,verification="SOURCE_VERIFIED"):NewsBriefV1=>({
 contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",id,
 headline:"Broadcom announces Anthropic financing",summary:"Original primary release with dated financing details and proper attribution.",
 sourceName:"Issuer",sourceKind:"primary",sourceUrl:"https://investors.broadcom.com/news-releases/"+id,
 occurredAt,observedAt:"2026-10-27T13:00:00Z",verification:verification as NewsBriefV1["verification"]});
test("futures, source gaps, old announcements and unverified creator interpretations do not rank",()=>{
 const future=news("future","2026-11-04T15:00:00Z");
 const old=news("old","2026-10-22T12:00:00Z");
 const valid=news("valid","2026-10-27T11:00:00Z");
 const unverified=news("unverified","2026-10-27T12:00:00Z","LEAD");
 const result=selectHtmlEditorialShortlist([future,old,valid,unverified],now);
 assert.equal(result.length,1);
 assert.equal(result[0].news.id,"valid");
 assert.equal(result[0].theme,"AI & Funding");
});
test("same original source report is shown only once and current beats equally sourced old",()=>{
 const a=news("unique","2026-10-27T13:00:00Z");
 const b={...a,id:"dupe",headline:"Broadcom announces same press release"};
 const c=news("older","2026-10-26T01:00:00Z");
 const result=selectHtmlEditorialShortlist([c,a,b],now);
 assert.equal(result.length,2);
 assert.equal(result[0].news.id,"unique");
});
test("the owner report category library offers pagination and removes duplicate editor nav",()=>{
 const page=readFileSync(new URL("../app/my-reports/page.tsx",import.meta.url),"utf8");
 const header=readFileSync(new URL("../components/blue-desk/BlueDeskHeader.tsx",import.meta.url),"utf8");
 assert.match(page,/const PAGE_SIZE=2/);
 assert.match(page,/CATEGORIES\.map/);
 assert.match(page,/data-library-page=\{currentPage\}/);
 assert.match(page,/pageHref\(activeType,currentPage\+1\)/);
 assert.match(page,/data-edition-type=\{item\.kind\}/);
 assert.match(page,/"market"/);
 assert.match(page,/"angles"/);
 assert.match(page,/"creators"/);
 assert.match(page,/"audits"/);
 assert.match(page,/const PAGE_SIZE=2/);
 const nav=header.split("const PRIVATE_NAV = [")[1]?.split("] as const;")[0]||"";
 assert.doesNotMatch(nav,/Writing Desk/);
 assert.match(nav,/My Desk/);
 assert.match(header,/activePath === "\/owner\/editorial"/);
});
