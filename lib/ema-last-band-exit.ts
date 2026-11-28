/** Most recent completed-close exit from the band, not a midpoint cross or re-entry.
 * Read backwards over a bounded contiguous, ready history. Missing observations
 * stop the search; never infer an exit from the first available outside bar. */
export type ExitPosition="above"|"inside"|"below";
export type LastBandExit={direction:"up"|"down";asOf:string};
export const EXIT_LOOKBACK=60;
export function lastBandExit(length:number,read:(i:number)=>{position:ExitPosition;asOf:string}|null,adjacent:(before:number,after:number)=>boolean):LastBandExit|null{
 if(length<2)return null;
 let current=read(length-1);
 if(!current)return null;
 for(let i=length-1;i>Math.max(0,length-1-EXIT_LOOKBACK);i--){
  if(!adjacent(i-1,i))return null;
  const previous=read(i-1);
  if(!previous)return null;
  if(current.position!==previous.position&&current.position!=="inside")return {direction:current.position==="above"?"up":"down",asOf:current.asOf};
  current=previous;
 }
 return null;
}
