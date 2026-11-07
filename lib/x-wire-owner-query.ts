export const X_WIRE_THEMES = [
  ["energy_shipping", "Energy & shipping", ["oil","brent","wti","tanker","hormuz","shipping","lng","diesel","refinery","opec","freight"]],
  ["macro_rates_fx", "Macro, rates & FX", ["treasury","yield","fomc","fed","inflation","payroll","cpi","pce","central bank","dollar","yen","bond"]],
  ["geopolitics", "Geopolitics", ["iran","israel","missile","war","ceasefire","tariff","sanction","ukraine","taiwan","military"]],
  ["equities_ai", "Equities & AI", ["nvidia","nasdaq","earnings","semiconductor","stocks","capex","microsoft","oracle","valuation","ai spending"]],
  ["corporate", "Companies & deals", ["ipo","takeover","merger","acquisition","financing","bankruptcy","stock offering"]],
  ["resilience_preparedness", "Resilience", ["preparedness","stockpile","blackout","emergency","power grid","red cross","shelter"]],
] as const;
export type XWireTheme = (typeof X_WIRE_THEMES)[number][0];
export const X_WIRE_PAGE_SIZE = 25;
export type XWireOwnerFilters = {page:number;handle:string;status:string;theme:string;period:string;q:string};
const first=(x:unknown):string=>Array.isArray(x)?String(x[0]??""):typeof x==="string"?x:"";
export function parseXWireOwnerFilters(raw:Record<string,unknown>):XWireOwnerFilters {
  const candidate=first(raw.page);
  const parsed=/^[1-9]\d{0,3}$/.test(candidate)?Number(candidate):1;
  const status=first(raw.status);
  const theme=first(raw.theme);
  const period=first(raw.period);
  const handle=first(raw.handle).replace(/^@/,"").trim();
  return {
    page:Math.min(parsed,1000),
    handle:/^[A-Za-z0-9_]{1,15}$/.test(handle)?handle:"",
    status:["discovery","deferred","reviewed","rejected"].includes(status)?status:"",
    theme:X_WIRE_THEMES.some(t=>t[0]===theme)?theme:"",
    period:["24h","7d","30d","all"].includes(period)?period:"7d",
    q:first(raw.q).replace(/[%,_()]/g,"").trim().slice(0,100),
  };
}
export function xWireOwnerHref(filters:XWireOwnerFilters,changes:Partial<XWireOwnerFilters>={}) {
  const input={...filters,...changes},params=new URLSearchParams();
  for(const key of ["handle","status","theme","period","q"] as const)if(input[key])params.set(key,input[key]);
  if(input.page>1)params.set("page",String(input.page));
  const search=params.toString();
  return "/owner/x-wire"+(search?"?"+search:"");
}
