import test from "node:test";
import assert from "node:assert/strict";
import {getStorySnapshotStatus} from "../lib/bluebelly-story-status.ts";

const now=new Date("2026-11-10T00:00:00.000Z");
test("fast-moving geopolitical research becomes review-due without inferring peace outcomes",()=>{
  const s=getStorySnapshotStatus({slug:"iran-hormuz",status:"monitor",updatedAt:"2026-11-01T00:00:00Z"},now);
  assert.equal(s.freshness,"review_due");
  assert.equal(s.lifecycle,"Monitoring");
  assert.equal(s.asOf,"2026-11-01");
  assert.equal(s.reviewAfterHours,48);
});
test("structural theses have a longer dated research window",()=>{
  const fresh=getStorySnapshotStatus({slug:"ai-capex-cash-conversion",status:"develop",updatedAt:"2026-11-06T00:00:00Z"},now);
  assert.equal(fresh.freshness,"dated");
  assert.equal(fresh.lifecycle,"Developing");
  const old=getStorySnapshotStatus({slug:"ai-capex-cash-conversion",status:"monitor",updatedAt:"2026-10-15T00:00:00Z"},now);
  assert.equal(old.freshness,"review_due");
});
test("unknown and future research dates cannot pass the freshness check",()=>{
  assert.equal(getStorySnapshotStatus({slug:"fed",status:"publish",updatedAt:"invalid"},now).freshness,"unknown");
  assert.equal(getStorySnapshotStatus({slug:"fed",status:"publish",updatedAt:"2026-11-11T00:00:00Z"},now).freshness,"unknown");
});
