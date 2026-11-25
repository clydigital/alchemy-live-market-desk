import {scanEquityEma,type EmaPoint} from "./bluebelly-equity-ema.ts";
type Source={id:string;symbol:string;frequency:string;sourceName:string;sourceUrl:string};
const treasury="https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve";
const eia:Record<string,[string,string]>={wti:["CL=F","RWTC"],brent:["BZ=F","RBRTE"],gasoline:["RB=F","EER_EPMRU_PF4_Y35NY_DPG"],distillate:["HO=F","EER_EPD2F_PF4_Y35NY_DPG"]};
export function directEmaIdentity(r:Source):{instrument:string;kind:"SPOT"|"REFERENCE_FIXING"|"YIELD";calendar:"UTC_DAILY"|"DATED_OBSERVATION"}|null{
 if(r.frequency!=="daily")return null;
 if(r.id==="btc"&&r.symbol==="BTCUSD"&&r.sourceName==="Coinbase Exchange BTC-USD spot"&&r.sourceUrl==="https://exchange.coinbase.com/trade/BTC-USD")return {instrument:"BTC/USD",kind:"SPOT",calendar:"UTC_DAILY"};
 if(r.id==="usdjpy"&&r.symbol==="JPY=X"&&r.sourceName==="European Central Bank"&&r.sourceUrl==="https://data.ecb.europa.eu/data/datasets/EXR/EXR.D.JPY.EUR.SP00.A")return {instrument:"USD/JPY ECB fixing",kind:"REFERENCE_FIXING",calendar:"DATED_OBSERVATION"};
 const oil=eia[r.id];
 if(oil&&r.symbol===oil[0]&&r.sourceName==="U.S. Energy Information Administration"&&r.sourceUrl==="https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=D&n=PET&s="+oil[1])return {instrument:oil[1],kind:"SPOT",calendar:"DATED_OBSERVATION"};
 const usYield:Record<string,string>={us5y:"^FVX",us10y:"^TNX",us30y:"^TYX"};
 if(usYield[r.id]===r.symbol&&r.sourceName==="U.S. Treasury"&&r.sourceUrl===treasury)return {instrument:r.id,kind:"YIELD",calendar:"DATED_OBSERVATION"};
 if(/^DGS(?:3MO|6MO|2|5|10|20|30)$/.test(r.symbol)&&r.sourceName==="Federal Reserve Economic Data"&&r.sourceUrl==="https://fred.stlouisfed.org/series/"+r.symbol)return {instrument:r.symbol,kind:"YIELD",calendar:"DATED_OBSERVATION"};
 return null;
}
export function scanDirectEma(r:Source,points:readonly EmaPoint[],now=new Date()){
 const identity=directEmaIdentity(r);
 if(!identity)return null;
 const cutoff=now.toISOString().slice(0,10);
 const expected=new Date(Date.parse(cutoff+"T00:00:00Z")-86400000).toISOString().slice(0,10);
 const seen=new Set<string>(),accepted:EmaPoint[]=[];
 for(const p of points){
  if(!Number.isFinite(p.time)||p.time<=0||!Number.isFinite(p.close))return null;
  const date=new Date(p.time*1000);
  if(!Number.isFinite(+date)||p.time%86400!==0)return null;
  const day=date.toISOString().slice(0,10);
  if(day>=cutoff)continue; // conservative previous UTC date; never today's incomplete candle/fixing
  if(p.close<=0||seen.has(day))return null; // positive-price kernel cannot model negative/zero series
  if(identity.calendar==="DATED_OBSERVATION"&&(date.getUTCDay()===0||date.getUTCDay()===6))continue;
  seen.add(day);accepted.push(p);
 }
 const scan=scanEquityEma(accepted,"UTC",now);
 if(!scan)return null;
 return {scan,scope:{...identity,expectedSession:identity.calendar==="UTC_DAILY"?expected:null,status:identity.calendar==="UTC_DAILY"?(scan.asOf===expected?"CURRENT" as const:"BEHIND" as const):"SOURCE_DATED" as const}};
}
