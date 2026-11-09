/** A Story's research date is NOT proof of a current real-world outcome. */
export type StoryFreshness = "dated" | "review_due" | "unknown";
export type StorySnapshotStatus = {
  lifecycle: string;
  freshness: StoryFreshness;
  asOf: string | null;
  reviewAfterHours: number;
};
const FAST_MOVING = /(?:hormuz|iran|ceasefire|peace-talk|negotiat|shipping-incident|midterm|election-result)/i;
const LIFECYCLE: Record<string,string> = {
  monitor:"Monitoring",develop:"Developing",publish:"Published thesis",
};
export function getStorySnapshotStatus(
  item:{status:string;slug:string;updatedAt:string},
  now=new Date(),
): StorySnapshotStatus {
  const at=Date.parse(item.updatedAt),current=now.getTime();
  const reviewAfterHours=FAST_MOVING.test(item.slug)?48:168;
  const valid=Number.isFinite(at)&&Number.isFinite(current)&&at<=current;
  return {
    lifecycle:LIFECYCLE[item.status]||"Research snapshot",
    freshness:valid?(current-at>reviewAfterHours*3600000?"review_due":"dated"):"unknown",
    asOf:valid?new Date(at).toISOString().slice(0,10):null,
    reviewAfterHours,
  };
}
