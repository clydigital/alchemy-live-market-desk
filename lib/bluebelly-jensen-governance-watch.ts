/** Dated editorial watch, deliberately NOT an automated board-decision status.
 * Future sweeps must refresh original source receipts before revising wording. */
export const JENSEN_GOVERNANCE_WATCH={
 id:"jensen-huang-board-governance-nov-2026",
 reviewedOn:"2026-11-12",
 activeThrough:"2026-11-20",
 status:"INVESTIGATION UNDER WAY · BOARD OUTCOME NOT OFFICIALLY CONFIRMED",
 official:[
  {date:"2026-11-08",text:"NVIDIA's board opened an independent investigation and said it had confidence in Huang; at that point it reported no reason to believe company secrets or national security were compromised.",
   url:"https://investor.nvidia.com/news/press-release-details/2026/Statement-from-NVIDIA-Board-of-Directors/default.aspx",label:"NVIDIA board · original 8 Nov statement"},
  {date:"2026-11-10",text:"Independent directors said they had retained outside counsel for the investigation.",
   url:"https://investor.nvidia.com/news/press-release-details/2026/Statement-from-the-Independent-Members-of-the-NVIDIA-Board/default.aspx",label:"NVIDIA independent directors · 10 Nov statement"}
 ],
 reported:{
  date:"2026-11-11",
  text:"Reuters reported that the board was considering Huang's future, citing another publication. Deliberation is not removal, and no final resolution is verified by this frozen edition.",
  url:"https://www.reuters.com/technology/nvidia-is-preparing-oust-ceo-jensen-huang-wsj-reports-2026-11-11/",
  label:"Reuters · attributed governance reporting"
 },
 market:{
  signal:"A formal independent review signals the board sees a material governance question requiring documented investigation, not that any wrongdoing or loss of corporate secrets is established.",
  uncertainty:"RISING/UNRESOLVED: Attributed board-deliberation reporting increases the range of leadership outcomes, while the issuer's last sourced statement expressed confidence. Neither is a verified final vote.",
  supplyDemand:"No confirmed change to GPU shipments, booked customer orders, chip availability or data-centre capacity follows from the investigation alone. If restrictions or leadership disruption later alter procurement, re-evaluate separately.",
  price:"Corporate governance uncertainty could widen NVIDIA's valuation risk premium even if AI chip demand remains intact. An NVDA/SMH reaction caused specifically by a board decision has not been independently measured.",
  next:"Watch new dated NVIDIA board statements/SEC 8-Ks, a formal leadership or regulatory decision, customer or supplier guidance, and the official 17 Nov 17:00 ET earnings and CFO commentary."
 }
} as const;
export function isJensenGovernanceWatchWindow(now:Date){
 const t=now.getTime();return Number.isFinite(t)&&t>=Date.parse("2026-11-12T00:00:00Z")&&t<Date.parse("2026-11-21T00:00:00Z");
}
