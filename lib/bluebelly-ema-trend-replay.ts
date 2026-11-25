/** Close-only daily-band replay. No intraday wick or execution claims.
 * A retest candidate is a close back inside the envelope following a close
 * outside it. Confirmation is a close back beyond the original boundary
 * within five sessions; invalidation is three closes beyond the opposite band.
 * Caller supplies strictly contiguous, ready, current completed sessions.
 */
export type TrendBandDay={day:string;close:number;upper:number;lower:number};
export type RespectedBandTrend={direction:"BULLISH"|"BEARISH";retestedOn:string;confirmedOn:string;status:"ACTIVE"|"INVALIDATED";invalidatedOn:string|null;lookbackSessions:number};
export function replayRespectedBand(days:readonly TrendBandDay[]):RespectedBandTrend|null{
 let trend:RespectedBandTrend|null=null;
 let pending:{direction:"BULLISH"|"BEARISH";at:number}|null=null;
 let opposite=0;
 const side=(d:TrendBandDay)=>d.close>d.upper?"above":d.close<d.lower?"below":"inside";
 for(let i=1;i<days.length;i++){
  const prev=side(days[i-1]),next=side(days[i]);
  if(trend?.status==="ACTIVE"){
   const against=trend.direction==="BULLISH"?next==="below":next==="above";
   opposite=against?opposite+1:0;
   if(opposite>=3)trend={...trend,status:"INVALIDATED",invalidatedOn:days[i].day};
  }
  if(pending){
   const original=pending.direction==="BULLISH"?"above":"below";
   if(i-pending.at>5||(next!=="inside"&&next!==original))pending=null;
   else if(next===original){
    trend={direction:pending.direction,retestedOn:days[pending.at].day,confirmedOn:days[i].day,status:"ACTIVE",invalidatedOn:null,lookbackSessions:days.length};
    opposite=0;pending=null;
   }
  }
  if(next==="inside"&&prev!=="inside")pending={direction:prev==="above"?"BULLISH":"BEARISH",at:i};
 }
 return trend;
}
