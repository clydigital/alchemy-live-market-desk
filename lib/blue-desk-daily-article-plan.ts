/** Unpublished private article-plan proposals. No calendar or market claim is
 * inferred from a chart symbol alone. */
export type DailyArticleIdea={
 title:string;kind:"COTD"|"OB";angle:string;whyItMatters:string;
 whatToVerify:string;chartSymbols:string[];chartChecks:string[];
};
export const DESK_CHARTS:Record<string,{label:string;prompt:string;link:string}>={
 "TVC:DXY":{label:"US Dollar Index (DXY)",prompt:"4H/1D 20 EMA ±1 SD: most recent confirmed band break",link:"https://www.tradingview.com/chart/?symbol=TVC%3ADXY"},
 "TVC:US02Y":{label:"US 2Y yield",prompt:"Compare front-end repricing with the CPI/Fed catalyst clock",link:"https://www.tradingview.com/chart/?symbol=TVC%3AUS02Y"},
 "TVC:US10Y":{label:"US 10Y yield",prompt:"Compare same-session moves with 2Y and equities",link:"https://www.tradingview.com/chart/?symbol=TVC%3AUS10Y"},
 "TVC:US30Y":{label:"US 30Y yield",prompt:"Check long-end stress and 2Y–30Y curve direction",link:"https://www.tradingview.com/chart/?symbol=TVC%3AUS30Y"},
 "TVC:UKOIL":{label:"Brent crude",prompt:"4H 20/50 EMA ±1 SD, then daily 20 EMA; verify latest completed bar",link:"https://www.tradingview.com/chart/?symbol=TVC%3AUKOIL"},
 "TVC:USOIL":{label:"WTI crude",prompt:"4H 20/50 EMA ±1 SD; confirm price series and session",link:"https://www.tradingview.com/chart/?symbol=TVC%3AUSOIL"},
 "TVC:GOLD":{label:"Gold",prompt:"4H and daily 20 EMA ±1 SD; compare yield and dollar clocks",link:"https://www.tradingview.com/chart/?symbol=TVC%3AGOLD"},
 "FX:USDJPY":{label:"USD/JPY",prompt:"4H/weekly EMA 20 ±1 SD; compare JXY and US/JGB yields",link:"https://www.tradingview.com/chart/?symbol=FX%3AUSDJPY"},
 "SP:SPX":{label:"S&P 500",prompt:"Daily rising channel, breadth and 20 EMA ±1 SD; verify live chart",link:"https://www.tradingview.com/chart/?symbol=SP%3ASPX"},
 "NASDAQ:NDX":{label:"Nasdaq 100",prompt:"Daily 20 EMA ±1 SD and leadership/breadth divergence",link:"https://www.tradingview.com/chart/?symbol=NASDAQ%3ANDX"},
};
export function parseDailyArticlePlan(input:unknown):DailyArticleIdea[]|null{
 if(!input||typeof input!=="object"||Array.isArray(input))return null;
 const raw=(input as Record<string,unknown>).ideas;
 if(!Array.isArray(raw)||raw.length<3||raw.length>4)return null;
 const titles=new Set<string>();let cotd=0,ob=0;
 const results:DailyArticleIdea[]=[];
 for(const x of raw){
  if(!x||typeof x!=="object"||Array.isArray(x))return null;
  const r=x as Record<string,unknown>;
  const str=(key:string,max:number,min=1)=>typeof r[key]==="string"&&
   (r[key] as string).trim().length>=min&&(r[key] as string).trim().length<=max
   ?(r[key] as string).trim():null;
  const title=str("title",63,12),angle=str("angle",400,70),
   why=str("whyItMatters",400,65),verify=str("whatToVerify",430,55);
  if(!title||!angle||!why||!verify||!["OB","COTD"].includes(String(r.kind)))return null;
  if(titles.has(title.toLowerCase()))return null;
  const symbols=r.chartSymbols,checks=r.chartChecks;
  if(!Array.isArray(symbols)||symbols.length<1||symbols.length>3||
     !symbols.every(x=>typeof x==="string"&&x in DESK_CHARTS)||
     new Set(symbols).size!==symbols.length)return null;
  if(!Array.isArray(checks)||checks.length<1||checks.length>3||
     !checks.every(x=>typeof x==="string"&&x.trim().length>=12&&x.length<=200))return null;
  const kind=r.kind as "OB"|"COTD";
  if(kind==="COTD")cotd++;else ob++;
  results.push({title,kind,angle,whyItMatters:why,whatToVerify:verify,
    chartSymbols:symbols,chartChecks:checks.map(x=>String(x).trim())});
  titles.add(title.toLowerCase());
 }
 return cotd>=1&&ob>=1?results:null;
}
