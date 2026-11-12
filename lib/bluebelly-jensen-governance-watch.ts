/** Frozen, editor-checked market watch. 12 November 2026 NVIDIA issuer
 * announcement supersedes Nov 11 attributed deliberation. NOT a live ticker
 * or a conclusion regarding national-security allegations. */
export const JENSEN_GOVERNANCE_WATCH={
 id:"jensen-huang-board-governance-nov-2026",
 reviewedOn:"2026-11-13 · MYT (12 Nov US session)",
 activeThrough:"2026-11-20",
 status:"CEO TRANSITION CONFIRMED · KRESS INTERIM · SUCCESSOR OPEN",
 official:[
  {date:"2026-11-08",text:"On 8 November, NVIDIA's board opened an independent investigation and expressed confidence in Huang; it then reported no reason to believe national security or company secrets were compromised.",
   url:"https://investor.nvidia.com/news/press-release-details/2026/Statement-from-NVIDIA-Board-of-Directors/default.aspx",label:"NVIDIA board · 8 Nov statement"},
  {date:"2026-11-10",text:"On 10 November, independent directors confirmed an outside-counsel investigation.",
   url:"https://investor.nvidia.com/news/press-release-details/2026/Statement-from-the-Independent-Members-of-the-NVIDIA-Board/default.aspx",label:"NVIDIA independent directors · 10 Nov statement"},
  {date:"2026-11-12",text:"On 12 November, NVIDIA announced Jensen Huang's immediate resignation as president, CEO and director. CFO Colette Kress became interim CEO and the board began a search for a permanent successor. The company expects customer commitments and its product roadmap to continue.",
   url:"https://nvidianews.nvidia.com/news/nvidia-announces-ceo-transition",label:"NVIDIA · 12 Nov confirmed CEO transition"}
 ],
 reported:{
  date:"2026-11-12",
  text:"Reuters reported concern that Huang's departure could weaken NVIDIA's role funding the AI ecosystem and coordinating Asian suppliers; these are forward risks, not observed lost customer orders. His resignation is now confirmed; an investigation finding, permanent CEO choice or export-policy consequence is not.",
  url:"https://www.reuters.com/business/retail-consumer/nvidia-ceo-jensen-huang-step-down-big-blow-ai-boom-2026-11-12/",
  label:"Reuters · 12 Nov attributed industry read-through"
 },
 market:{
  signal:"The resignation is a completed governance decision, not merely a rumoured board meeting. Kress provides operational continuity, while the permanent leadership, policy strategy and long-term capital commitments remain uncertain.",
  uncertainty:"MIXED: The question of whether Huang remains CEO was resolved. Uncertainty remains elevated over the permanent successor, governance investigation, export controls and whether NVIDIA changes its AI financing and manufacturing commitments.",
  supplyDemand:"The decision does not by itself cancel GPU orders, reduce manufactured chip supply or prove lower compute demand. Suppliers may face different future capacity commitments; customers may face different investment support. Distinguish physical chip demand from demand for NVIDIA equity.",
  price:"Reuters reported an NVDA fall of 7.6% at 09:45 ET on 12 November, while AMD and Broadcom were stronger. Later reports described a partial semiconductor-index recovery. These are separate, time-limited observations; no closing-return or causal event-window attribution is established.",
  next:"Seek NVIDIA's transition filing and permanent CEO appointment, board/security findings, issuer customer/supplier financing decisions and 17 Nov FY27 Q3 results. Compare NVDA, SMH, AMD, AVGO, CoreWeave and suppliers using matched observation windows; do not assign an entire market move to this decision alone."
 }
} as const;
export function isJensenGovernanceWatchWindow(now:Date){
 const t=now.getTime();return Number.isFinite(t)&&t>=Date.parse("2026-11-12T00:00:00Z")&&t<Date.parse("2026-11-21T00:00:00Z");
}
