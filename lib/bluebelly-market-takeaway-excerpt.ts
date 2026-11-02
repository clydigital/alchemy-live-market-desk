/**
 * Deterministic display-only shortening of an already reviewed explanation.
 * Never substitutes a new AI interpretation for the source. The full original
 * remains directly accessible in the detail disclosure next to the excerpt.
 */
export function takeawayExcerpt(value:string,max=225):{
 preview:string;expanded:boolean;
}{
 const clean=value.trim().replace(/\s+/g," ");
 if(!Number.isInteger(max)||max<100||max>450)max=225;
 if(clean.length<=max)return {preview:clean,expanded:false};
 const window=clean.slice(0,max+1);
 const stops=[...window.matchAll(/[.!?](?=\s|$)/g)]
  .filter(m=>(m.index??0)>=80&&(m.index??0)<max);
 const stop=stops.at(-1);
 if(stop&&stop.index!==undefined){
  const preview=clean.slice(0,stop.index+1).trimEnd();
  return {preview,expanded:true};
 }
 const whitespace=window.lastIndexOf(" ",max);
 const cut=whitespace>=max*.65?whitespace:max;
 return {preview:clean.slice(0,cut).trimEnd()+"…",expanded:true};
}
