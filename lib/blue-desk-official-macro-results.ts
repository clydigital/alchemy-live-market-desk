/**
 * Dated, primary-source-reviewed public economic release SNAPSHOT.
 * This is a conservative, expiring editorial fallback while the existing
 * official-intake/publisher handoff is repaired; it is NOT a data API,
 * a canonical Evidence receipt, or authority to rewrite an archived edition.
 * Future months require a new original BEA source or existing verified intake.
 */
export type OfficialMacroResult={
  id:string; title:string; fact:string; why:string; test:string;
  releaseAt:string; sourceUrl:string; sourceName:string; mechanism:string;
  affectedAssets:string[]; windowDays:number;
};
const RELEASES:readonly OfficialMacroResult[]=[
  {
    id:"bea-pce-september-2026",
    title:"US PCE inflation reaches 3.6% as real spending stalls",
    fact:"BEA reported September headline PCE inflation of 3.6% year-on-year and 0.5% month-on-month; core PCE was 3.1% year-on-year and 0.3% month-on-month. Nominal consumer spending rose 0.5%, but real spending was essentially flat; personal income grew 0.2%.",
    why:"The Fed is balancing persistent price increases against a consumer who is buying little more after inflation. Stronger third-quarter GDP growth and flat September real spending cover different periods; neither alone proves a recession or a new Fed path.",
    test:"Compare the next employment and inflation reports with the dated 2Y yield, five-year breakeven and Fed-funds futures repricing; the October PCE release is due 25 November 2026.",
    releaseAt:"2026-10-29T12:30:00.000Z",
    sourceUrl:"https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026",
    sourceName:"US Bureau of Economic Analysis · original September PCE",
    mechanism:"Hotter PCE can increase the expected cost of money, while weaker real household demand may argue for patience. The FOMC's explicit 2% target was already defined in terms of headline PCE in 2012, not newly switched from CPI in October 2026.",
    affectedAssets:["DXY","US02Y","SPX"],
    windowDays:7,
  },
];
export function getRecentOfficialMacroResults(now=new Date()):OfficialMacroResult[]{
 const at=now.getTime();
 if(!Number.isFinite(at))return [];
 return RELEASES.filter(item=>{
  const released=Date.parse(item.releaseAt);
  return Number.isFinite(released)&&at>=released&&at-released<=item.windowDays*86400000;
 });
}
