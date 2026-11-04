/**
 * Dated editorial readback of independently opened issuer releases; not an
 * earnings-calendar prediction, real-time quote, or automatic canonical Event.
 * One entry per original financial release. Scheduling notices are never
 * promoted here merely because their webcast time has passed.
 */
export type OriginalIssuerRelease={
 ticker:string;company:string;fiscalPeriod:string;sourceDay:string;
 availableNotBefore:string;sourceUrl:string;sourceName:string;
 confirmed:string;nextTest:string;
};
const RELEASES:readonly OriginalIssuerRelease[]=[
 {
  ticker:"DASH",company:"DoorDash",fiscalPeriod:"Q3 2026",sourceDay:"2026-10-29",
  availableNotBefore:"2026-10-29T12:30:00Z",
  sourceUrl:"https://ir.doordash.com/news/news-details/2026/DoorDash-Releases-Third-Quarter-2026-Financial-Results/default.aspx",
  sourceName:"DoorDash Investor Relations · original 29 October results",
  confirmed:"Moved from 4 November to 29 October. Q3 revenue $4.616bn (+34% YoY), GAAP net income $466m and free cash flow $787m. Instacart acquisition announced separately; not yet completed.",
  nextTest:"Check the mix of organic order growth versus Deliveroo, acquisition funding and cash conversion. Do not retain 4 Nov as its scheduled release date.",
 },
 {
  ticker:"SHOP",company:"Shopify",fiscalPeriod:"Q3 2026",sourceDay:"2026-11-03",
  availableNotBefore:"2026-11-03T13:30:00Z",
  sourceUrl:"https://www.shopify.com/investors/press-releases/shopify-sustains-rapid-growth-with-revenue-up-32-and-free-cash-flow-margin-of-22",
  sourceName:"Shopify Investor Relations · original 3 November results",
  confirmed:"Q3 revenue $3.742bn (+32% YoY), gross merchandise value $119.145bn, free cash flow $816m and issuer-defined free-cash-flow margin 22%.",
  nextTest:"Check 2026 Q4 gross-profit outlook and the sustainability of merchant AI activity, cash margin and payment volume.",
 },
 {
  ticker:"NVO",company:"Novo Nordisk",fiscalPeriod:"9M 2026 / Q3",sourceDay:"2026-11-04",
  availableNotBefore:"2026-11-04T06:30:00Z",
  sourceUrl:"https://www.novonordisk.com/investors/financial-results.html",
  sourceName:"Novo Nordisk Investor Relations · 4 November results library",
  confirmed:"Novo Nordisk confirms that its first-nine-months 2026 results have been announced. Detailed financial figures and consensus surprise are not independently reconciled in this calendar receipt.",
  nextTest:"Read the full company announcement, obesity-drug volume and price mix, manufacturing constraints, competitive pipeline and management guidance before labelling a beat or miss.",
 },
] as const;
export function recentOriginalIssuerReleases(now:Date,lookbackDays=8):OriginalIssuerRelease[]{
 if(!Number.isFinite(+now)||!Number.isInteger(lookbackDays)||lookbackDays<1||lookbackDays>30)return [];
 return RELEASES.filter(x=>{
  const at=Date.parse(x.availableNotBefore);
  return Number.isFinite(at)&&+now>=at&&(+now-at)<=lookbackDays*86400000;
 }).sort((a,b)=>b.sourceDay.localeCompare(a.sourceDay)||a.ticker.localeCompare(b.ticker));
}
