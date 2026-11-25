import {expectedHomeEtfSession} from "./bluebelly-home-etf-history.ts";
import {scanEquityEma,type EmaPoint} from "./bluebelly-equity-ema.ts";
import {scheduledUsEquityCloseHourET} from "./bluebelly-us-equity-trading-calendar.ts";

// Existing instrument identities only, never infer a cash index from its ETF.
export const CROSS_ASSET_DEEP_ETFS=["XLB","XLC","XLE","XLF","XLI","XLK","XLP","XLRE","XLU","XLV","XLY","SMH"] as const;
const etfs=new Set<string>([...CROSS_ASSET_DEEP_ETFS,"SPY","RSP","QQQ","SOXX","DIA","IWM","SGOV","USFR","SHY","IEF","TLH","TLT","TIP","AGG","GOVT","LQD","HYG","EDV","ZROZ","VGIT","GLD","GLDM","SLV","CPER","GDX","UUP","FXE","FXB","FXC","FXA","FXY","FXF","CYB","EWJ","EWY","EWH","ASHR","EWG","FEZ","EWU","PALL","PPLT","UNG","BOTZ","AIQ","IGV","CHAT","NLR","RSPD","RSPS","JNK","VIXY","IPO","IBIT","ETHA"]);
type Source={id:string;symbol:string;frequency:string;sourceName:string;sourceUrl:string};
export function crossAssetEmaIdentity(r:Source):{instrument:string;kind:"ETF"|"CASH_INDEX"}|null{
 if(r.frequency!=="daily")return null;
 const ticker=r.id==="spx-proxy"&&r.symbol==="^GSPC"?"SPY":r.symbol;
 if(etfs.has(ticker)&&(
  (r.sourceName==="Nasdaq official etf history"&&r.sourceUrl==="https://www.nasdaq.com/market-activity/etf/"+ticker.toLowerCase()+"/historical")||
  (r.sourceName==="Yahoo Finance public daily chart (secondary; delayed)"&&r.sourceUrl==="https://finance.yahoo.com/quote/"+ticker+"/history/")
 ))return {instrument:ticker,kind:"ETF"};
 if(r.id==="spx"&&r.symbol==="SP500"&&r.sourceName==="S&P Dow Jones Indices via FRED"&&r.sourceUrl==="https://fred.stlouisfed.org/series/SP500")return {instrument:"SP500",kind:"CASH_INDEX"};
 if(r.id==="nasdaq-comp"&&r.symbol==="^IXIC"&&r.sourceName==="Nasdaq official index history"&&r.sourceUrl==="https://www.nasdaq.com/market-activity/index/comp/historical")return {instrument:"COMP",kind:"CASH_INDEX"};
 return null;
}
export function scanCrossAssetEma(r:Source,points:readonly EmaPoint[],now=new Date()){
 const identity=crossAssetEmaIdentity(r),expected=expectedHomeEtfSession(now);
 if(!identity||!expected)return null;
 const days=new Set<string>();
 const accepted:EmaPoint[]=[];
 for(const p of points){
  if(!Number.isFinite(p.time)||p.time<=0||!Number.isFinite(p.close)||p.close<=0)continue;
  const date=new Date(p.time*1000);
  if(!Number.isFinite(+date)||date.getUTCHours()!==0||date.getUTCMinutes()!==0||date.getUTCSeconds()!==0)continue;
  const d=date.toISOString().slice(0,10);
  if(d>expected||scheduledUsEquityCloseHourET(d)===null)continue;
  if(days.has(d))return null;
  days.add(d);accepted.push(p);
 }
 const scan=scanEquityEma(accepted,"America/New_York",now);
 if(!scan)return null;
 return {scan,scope:{...identity,expectedSession:expected,status:scan.asOf===expected?"CURRENT" as const:"BEHIND" as const}};
}
