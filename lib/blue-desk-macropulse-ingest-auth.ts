import {acceptsResearchAuthorization} from "./research-auth.ts";
export function scopedMacroPulseToken(token:unknown):token is string{
 return typeof token==="string"&&token.length>=32&&token.trim()===token&&!/\s/.test(token);
}
export function acceptsMacroPulseIngest(header:string|null,token:unknown):boolean{
 return scopedMacroPulseToken(token)&&typeof header==="string"&&
  /^Bearer [^\s]+$/.test(header)&&acceptsResearchAuthorization(header,[token]);
}
