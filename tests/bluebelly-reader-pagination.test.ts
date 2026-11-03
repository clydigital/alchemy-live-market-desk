import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normaliseReaderPage,paginateReaderItems,readerPageTokens}
 from "../lib/bluebelly-reader-pagination.ts";

const src=(file:string)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
test("paginates deterministically and preserves original order",()=>{
 const items=Array.from({length:21},(_,i)=>"report-"+i);
 const first=paginateReaderItems(items,"1",8);
 assert.deepEqual(first.items,items.slice(0,8));
 assert.deepEqual([first.firstItem,first.lastItem,first.totalPages,first.totalItems],[1,8,3,21]);
 const third=paginateReaderItems(items,"3",8);
 assert.deepEqual(third.items,items.slice(16));
 assert.deepEqual([third.firstItem,third.lastItem,third.page],[17,21,3]);
 assert.deepEqual(paginateReaderItems(items,9999,8).items,items.slice(16));
 assert.deepEqual(items,Array.from({length:21},(_,i)=>"report-"+i));
});
test("invalid and malicious query-string page values cannot bypass safe bounds",()=>{
 for(const value of ["-3","0","3abc","1e10","1.5","NaN","99999999999",
  "<script>","",undefined,null,Infinity,-3])assert.equal(normaliseReaderPage(value,4),1);
 assert.equal(normaliseReaderPage("42",4),4);
 assert.equal(normaliseReaderPage("2",4),2);
 assert.deepEqual(paginateReaderItems([],1,6),{
  items:[],page:1,totalPages:1,totalItems:0,pageSize:6,firstItem:0,lastItem:0,
 });
});
test("pagination window keeps first/last, current and unobtrusive ellipses",()=>{
 assert.deepEqual(readerPageTokens(1,3),[1,2,3]);
 assert.deepEqual(readerPageTokens(10,20),[1,"ellipsis",9,10,11,"ellipsis",20]);
 assert.deepEqual(readerPageTokens(2,20),[1,2,3,4,5,"ellipsis",20]);
 assert.deepEqual(readerPageTokens(19,20),[1,"ellipsis",16,17,18,19,20]);
 assert.deepEqual(readerPageTokens(100,3),[1,2,3]);
});
test("Research pages preserve search and category in paged URLs, without revising approval",()=>{
 const page=src("app/blue-desk/research/page.tsx");
 const index=src("lib/bluebelly-public-research-library.ts");
 assert.match(page,/paginateReaderItems\(results,/);
 assert.match(page,/page\.items\.map\(item/);
 assert.match(page,/query\.set\("q",q\.trim\(\)\)/);
 assert.match(page,/query\.set\("category",active\)/);
 assert.match(page,/getHref=\{pageHref\}/);
 assert.match(page,/id="research-results"/);
 assert.match(index,/MANUAL_RESEARCH_AUTOPROMOTION_ENABLED = false/);
});
test("Newsroom filters + browser history are retained while pages bound visible articles",()=>{
 const ui=src("components/blue-desk/BluebellyNewsWire.tsx");
 const page=src("app/blue-desk/newsroom/page.tsx");
 assert.match(ui,/paginateReaderItems\(visibleCards,currentPage,8\)/);
 assert.match(ui,/paginated\.items\.map\(card/);
 assert.match(ui,/setCurrentPage\(1\);syncUrl\(topic,value,1\)/);
 assert.match(ui,/syncUrl\(topic,query,next,"push"\)/);
 assert.match(ui,/window\.addEventListener\("popstate",restore\)/);
 assert.match(ui,/onPageChange=\{changePage\}/);
 assert.match(ui,/data-newsroom-pagination-position="above-feed"/);
 assert.equal((ui.match(/<ReaderPagination /g)||[]).length,2,
  "Newsroom has a compact pager above the first card and a full pager below the list");
 assert.ok(ui.indexOf('data-newsroom-pagination-position="above-feed"')<
  ui.indexOf("paginated.items.map(card=>"),"Top controls must precede article cards");
 const css=src("components/blue-desk/bluebelly-newswire.module.css");
 const pager=src("components/blue-desk/ReaderPagination.tsx");
 const pagerCss=src("components/blue-desk/ReaderPagination.module.css");
 assert.match(css,/\.resultsBar\{display:flex/);
 assert.match(css,/@media\(max-width:600px\)\{\.resultsBar/);
 assert.match(pager,/compact\?:boolean/);
 assert.match(pager,/className=\{compact\?styles.compact:styles.nav\}/);
 assert.match(pagerCss,/\.compact\{display:flex/);

 assert.match(page,/initialCategory=\{typeof params\.category/);
 assert.match(page,/initialPage=\{typeof params\.page/);
 assert.match(page,/getRecentArchivedPublicReaderItems\(now\)/);
 assert.match(page,/publicNewsroomEditorials\(news,now,host\)/);
});
test("Key Stories and private owner Research reuse the same bounded pagination",()=>{
 const stories=src("app/blue-desk/key-stories/page.tsx");
 const owner=src("components/blue-desk/ResearchLibraryExplorer.tsx");
 const shared=src("components/blue-desk/ReaderPagination.tsx");
 assert.match(stories,/paginateReaderItems\(visibleTheses,params\?\.page,6\)/);
 assert.match(stories,/label="Key Stories"/);
 assert.match(stories,/getHref=\{number=>indexHref/);
 assert.match(owner,/paginateReaderItems\(results,page,8\)/);
 assert.match(owner,/pageItems\.items\.map\(entry/);
 assert.match(owner,/setSection\(item\);setPage\(1\)/);
 assert.match(owner,/label="Owner Research"/);
 assert.match(shared,/aria-current="page"/);
 assert.match(shared,/aria-disabled="true"/);
 assert.match(shared,/aria-label=\{label\+" pagination"\}/);
});
