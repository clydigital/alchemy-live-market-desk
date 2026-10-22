/**
 * Visual-only labels. A badge means the named country or company was explicitly
 * mentioned in the published title/deck, NOT that the desk established causal
 * exposure or promoted new canonical Story evidence.
 */
export type StoryIdentity = {
  kind: "country" | "company" | "asset";
  label: string;
  code: string;
  imageUrl: string;
};

type IdentitySpec = StoryIdentity & { expressions: readonly RegExp[] };
const COUNTRY: readonly IdentitySpec[] = [
  {kind:"country",code:"US",label:"United States",imageUrl:"https://flagcdn.com/w80/us.png",expressions:[/\bUnited States\b/i,/\bU\.S\./i,/\bUS\b/,/\bUS(?:500|100|30|10|2|[ -]stocks|[ -]equities|[ -]Treasur(?:y|ies))\b/i,/\b(?:Federal Reserve|FOMC|Treasury yields|Wall Street)\b/i]},
  {kind:"country",code:"CN",label:"China",imageUrl:"https://flagcdn.com/w80/cn.png",expressions:[/\bChina\b/i,/\bChinese\b/i,/\bBeijing\b/i,/\bXi Jinping\b/i,/\bPBOC\b/i]},
  {kind:"country",code:"JP",label:"Japan",imageUrl:"https://flagcdn.com/w80/jp.png",expressions:[/\bJapan(?:ese)?\b/i,/\bBOJ\b/i,/\bJPY\b/i,/\byen\b/i]},
  {kind:"country",code:"SA",label:"Saudi Arabia",imageUrl:"https://flagcdn.com/w80/sa.png",expressions:[/\bSaudi(?: Arabia)?\b/i,/\bRiyadh\b/i]},
  {kind:"country",code:"IR",label:"Iran",imageUrl:"https://flagcdn.com/w80/ir.png",expressions:[/\bIran(?:ian)?\b/i,/\bTehran\b/i,/\bHormuz\b/i]},
  {kind:"country",code:"IL",label:"Israel",imageUrl:"https://flagcdn.com/w80/il.png",expressions:[/\bIsrael(?:i)?\b/i]},
  {kind:"country",code:"TW",label:"Taiwan",imageUrl:"https://flagcdn.com/w80/tw.png",expressions:[/\bTaiwan(?:ese)?\b/i]},
  {kind:"country",code:"GB",label:"United Kingdom",imageUrl:"https://flagcdn.com/w80/gb.png",expressions:[/\b(?:Britain|British|United Kingdom|UK|BoE|Bank of England|gilts?|sterling)\b/i]},
  {kind:"country",code:"FR",label:"France",imageUrl:"https://flagcdn.com/w80/fr.png",expressions:[/\b(?:France|French|Paris)\b/i]},
  {kind:"country",code:"DE",label:"Germany",imageUrl:"https://flagcdn.com/w80/de.png",expressions:[/\b(?:Germany|German|Bunds?)\b/i]},
  {kind:"country",code:"AU",label:"Australia",imageUrl:"https://flagcdn.com/w80/au.png",expressions:[/\b(?:Australia|Australian|RBA)\b/i]},
  {kind:"country",code:"NZ",label:"New Zealand",imageUrl:"https://flagcdn.com/w80/nz.png",expressions:[/\b(?:New Zealand|RBNZ)\b/i]},
  {kind:"country",code:"RU",label:"Russia",imageUrl:"https://flagcdn.com/w80/ru.png",expressions:[/\bRussia(?:n)?\b/i,/\bMoscow\b/i]},
  {kind:"country",code:"EU",label:"European Union",imageUrl:"https://flagcdn.com/w80/eu.png",expressions:[/\b(?:Eurozone|Euro area|ECB|European Central Bank)\b/i]},
];
const COMPANY_ROWS: ReadonlyArray<readonly [string,string,string,RegExp]> = [
  ["DELL","Dell","dell.com",/\bDell\b/i],
  ["NVDA","Nvidia","nvidia.com",/\b(?:Nvidia|NVDA)\b/i],
  ["MSFT","Microsoft","microsoft.com",/\b(?:Microsoft|MSFT)\b/i],
  ["META","Meta","meta.com",/\bMeta\b/i],
  ["GOOGL","Alphabet","abc.xyz",/\b(?:Alphabet|Google|GOOGL)\b/i],
  ["AMZN","Amazon","amazon.com",/\b(?:Amazon|AWS|AMZN)\b/i],
  ["TSM","TSMC","tsmc.com",/\b(?:TSMC|Taiwan Semiconductor)\b/i],
  ["MU","Micron","micron.com",/\b(?:Micron|MU)\b/i],
  ["ORCL","Oracle","oracle.com",/\b(?:Oracle|ORCL)\b/i],
  ["AMD","AMD","amd.com",/\bAMD\b/i],
  ["AVGO","Broadcom","broadcom.com",/\b(?:Broadcom|AVGO)\b/i],
  ["ASML","ASML","asml.com",/\bASML\b/i],
  ["AAPL","Apple","apple.com",/\bApple\b/i],
  ["TSLA","Tesla","tesla.com",/\bTesla\b/i],
  ["QCOM","Qualcomm","qualcomm.com",/\bQualcomm\b/i],
  ["CRWV","CoreWeave","coreweave.com",/\bCoreWeave\b/i],
  ["SAMSUNG","Samsung","samsung.com",/\bSamsung\b/i],
  ["OPENAI","OpenAI","openai.com",/\bOpenAI\b/i],
];
const COMPANY: readonly IdentitySpec[] = COMPANY_ROWS.map(([code,label,domain,pattern])=>({
  kind:"company" as const,code,label,
  imageUrl:"https://icons.duckduckgo.com/ip3/"+domain+".ico",
  expressions:[pattern],
}));

const MARKET_ASSETS: readonly IdentitySpec[]=[
 {kind:"asset",code:"OIL",label:"Oil",imageUrl:"",expressions:[/\\b(?:Brent|WTI|crude|petroleum|oil)\\b/i]},
 {kind:"asset",code:"GOLD",label:"Gold",imageUrl:"",expressions:[/\\b(?:gold|XAUUSD|XAU\\/USD)\\b/i]},
 {kind:"asset",code:"BONDS",label:"Bonds",imageUrl:"",expressions:[/\\b(?:Treasur(?:y|ies)|bonds?|gilts?)\\b/i]},
 {kind:"asset",code:"DXY",label:"US Dollar Index",imageUrl:"",expressions:[/\\bDXY\\b/i]},
];
/** Source-owned asset tags outrank surface wording; neither establishes new evidence. */
function keyedAsset(value:string):string[] {
 const x=value.toUpperCase().replace(/[^A-Z0-9]/g,"");
 const map:Record<string,string[]>={
  XAUUSD:["GOLD"],GOLD:["GOLD"],BRENT:["OIL"],WTI:["OIL"],CL:["OIL"],
  USDJPY:["US","JP"],JPY:["JP"],JXY:["JP"],USDCNH:["US","CN"],
  EURGBP:["EU","GB"],DXY:["DXY"],US2Y:["US","BONDS"],US10Y:["US","BONDS"],
  US30Y:["US","BONDS"],NVDA:["NVDA"],TSM:["TSM"],SMH:["NVDA"],
 };
 return map[x]??[x];
}
/** Titles outrank decks. Same entity never appears twice. Show up to three balls. */
export function storyIdentityBalls(title:string,deck:string,max=3,assetKeys:readonly string[]=[]):StoryIdentity[] {
 const text=[title,deck].filter(Boolean).join(" ");
 const all=[...COMPANY,...COUNTRY,...MARKET_ASSETS];
 const associated=new Set(assetKeys.flatMap(keyedAsset));
 const matched=all.flatMap(spec=>{
  const positions=spec.expressions.map(pattern=>text.search(pattern)).filter(x=>x>=0);
  if(associated.has(spec.code))return [{spec,index:-1}];
  return positions.length ? [{spec,index:Math.min(...positions)}] : [];
 }).sort((a,b)=>a.index-b.index || (a.spec.kind==="company"?-1:1));
 const used=new Set<string>();
 return matched.filter(({spec})=>{if(used.has(spec.code))return false;used.add(spec.code);return true;})
   .slice(0,Math.max(0,Math.min(max,5)))
   .map(({spec})=>({kind:spec.kind,code:spec.code,label:spec.label,imageUrl:spec.imageUrl}));
}
export function storyMatchesSubject(title:string,deck:string,assetKeys:readonly string[],subject:string):boolean {
 return subject.length>0 && storyIdentityBalls(title,deck,5,assetKeys).some(x=>x.code===subject);
}
