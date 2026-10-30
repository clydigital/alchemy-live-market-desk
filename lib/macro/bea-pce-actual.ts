/**
 * Deterministic original BEA Personal Income and Outlays source adapter.
 * Calendar clock alone is not a result. Four actual rates are admitted only
 * from the original reference-period-matched BEA release.
 */
const MONTHS=["january","february","march","april","may","june",
 "july","august","september","october","november","december"] as const;

export function beaPceReleaseUrl(name:string,referencePeriod:string|null){
 if(!/^Personal Income and Outlays$/i.test(name.trim())||!referencePeriod)return null;
 const m=/^(January|February|March|April|May|June|July|August|September|October|November|December) (20\d{2})$/i.exec(referencePeriod.trim());
 if(!m||!MONTHS.includes(m[1].toLowerCase() as typeof MONTHS[number]))return null;
 const year=Number(m[2]);
 if(year<2020||year>2035)return null;
 return "https://www.bea.gov/news/"+year+"/personal-income-and-outlays-"+m[1].toLowerCase()+"-"+year;
}

export type BeaPceReading={
 headlineMom:number;headlineYoy:number;coreMom:number;coreYoy:number;actual:string;
};
function numeric(action:string,value:string){
 const n=Number(value);
 if(!Number.isFinite(n)||n<0||n>20)return null;
 return /decreas|fell|declin/i.test(action)?-n:n;
}
function percent(value:number){return (value>0?"+":"")+value.toFixed(1);}

export function parseBeaPceActual(
 name:string,referencePeriod:string|null,body:string,
):BeaPceReading|null{
 if(!beaPceReleaseUrl(name,referencePeriod)||body.length>2_000_000)return null;
 const [month,year]=referencePeriod!.split(" ");
 const text=body
  .replace(/<script\b[\s\S]*?<\/script>/gi," ")
  .replace(/<style\b[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]+>/g," ")
  .replace(/&nbsp;|&#160;/gi," ")
  .replace(/&amp;/gi,"&")
  .replace(/\s+/g," ").trim();
 const title=new RegExp("Personal Income and Outlays,?\\s+"+month+"\\s+"+year+"\\b","i");
 if(!title.test(text))return null;
 const monthly=new RegExp(
  "From the preceding month,?\\s+the PCE price index for "+month+
  "\\s+(increased|decreased|rose|fell)\\s+([0-9]+(?:\\.[0-9]+)?)\\s+percent\\.\\s+"+
  "Excluding food and energy,\\s+the PCE price index\\s+(increased|decreased|rose|fell)\\s+"+
  "([0-9]+(?:\\.[0-9]+)?)\\s+percent","i",
 ).exec(text);
 const yearly=new RegExp(
  "From the same month one year ago,?\\s+the PCE price index for "+month+
  "\\s+(increased|decreased|rose|fell)\\s+([0-9]+(?:\\.[0-9]+)?)\\s+percent\\.\\s+"+
  "Excluding food and energy,\\s+the PCE price index\\s+(increased|decreased|rose|fell)\\s+"+
  "([0-9]+(?:\\.[0-9]+)?)\\s+percent","i",
 ).exec(text);
 if(!monthly||!yearly)return null;
 const [headlineMom,coreMom,headlineYoy,coreYoy]=[
  numeric(monthly[1],monthly[2]),numeric(monthly[3],monthly[4]),
  numeric(yearly[1],yearly[2]),numeric(yearly[3],yearly[4]),
 ];
 if([headlineMom,coreMom,headlineYoy,coreYoy].some(x=>x===null))return null;
 return {
  headlineMom:headlineMom!,coreMom:coreMom!,headlineYoy:headlineYoy!,coreYoy:coreYoy!,
  actual:"Headline PCE "+percent(headlineMom!)+"% m/m; "+percent(headlineYoy!)+"% y/y; Core PCE "+
   percent(coreMom!)+"% m/m; "+percent(coreYoy!)+"% y/y",
 };
}

/** Four measured observations, never conflating month-over-month with annual.
 * Consensus and previously captured expectations are separate columns. */
export function parseOfficialBeaPceMetricRows(actual:string){
 const m=/^Headline PCE ([+-]?\d+(?:\.\d+)?)% m\/m; ([+-]?\d+(?:\.\d+)?)% y\/y; Core PCE ([+-]?\d+(?:\.\d+)?)% m\/m; ([+-]?\d+(?:\.\d+)?)% y\/y$/.exec(actual.trim());
 if(!m)return [];
 const values=m.slice(1).map(Number);
 if(values.some(n=>!Number.isFinite(n)||Math.abs(n)>20))return [];
 return [
  {metric_key:"pce_headline_mom",label:"Headline PCE m/m",transformation:"mom",unit:"%",actual:values[0]},
  {metric_key:"pce_headline_yoy",label:"Headline PCE y/y",transformation:"yoy",unit:"%",actual:values[1]},
  {metric_key:"pce_core_mom",label:"Core PCE m/m",transformation:"mom",unit:"%",actual:values[2]},
  {metric_key:"pce_core_yoy",label:"Core PCE y/y",transformation:"yoy",unit:"%",actual:values[3]},
 ] as const;
}
