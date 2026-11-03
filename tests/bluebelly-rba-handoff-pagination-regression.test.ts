import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Key Stories preserves reviewed public RBA handoff after pagination and other reader edits",()=>{
 const page=src("app/blue-desk/key-stories/page.tsx");
 assert.match(page,/reconcileReviewedBankReaders\(originalPress,now\)/);
 assert.match(page,/REVIEWED_READER_NO_FEED_RECEIPT/);
 assert.match(page,/data-reviewed-bank-handoff=\{row\.status\}/);
 assert.match(page,/indexHref\+"\?postEvent="\+encodeURIComponent\(row\.bank\.id\)/);
 assert.match(page,/reviewedPostEventForNews\(topic\.updates\[0\],now\)/);
 // Source-only macro headlines never become an approved review by fuzzy ticker.
 assert.match(page,/getOriginalPressNews\(now,18,7\)/);
 // Existing pagination work may not be overwritten by this handoff repair.
 assert.match(page,/ReaderPagination|paginateReader|paginate/i);
});
