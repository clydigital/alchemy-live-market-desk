/** Bounded pagination for already-admitted public/owner reader items.
 * The result count means items AVAILABLE IN THIS READER, not all records
 * across the underlying source or unreviewed/private material.
 */
export function normaliseReaderPage(input:string|number|null|undefined,totalPages:number):number{
 const requested=typeof input==="number"?(Number.isSafeInteger(input)&&input>0?input:1):
   typeof input==="string"&&/^[1-9]\d{0,4}$/.test(input)?Number(input):1;
 return Math.min(Math.max(1,requested),Math.max(1,totalPages));
}
export function paginateReaderItems<T>(items:readonly T[],requested:string|number|null|undefined,pageSize:number){
 const size=Number.isInteger(pageSize)&&pageSize>=1&&pageSize<=100?pageSize:8;
 const totalItems=items.length;
 const totalPages=Math.max(1,Math.ceil(totalItems/size));
 const page=normaliseReaderPage(requested,totalPages);
 const start=(page-1)*size;
 return {items:items.slice(start,start+size),page,totalPages,totalItems,pageSize:size,
  firstItem:totalItems===0?0:start+1,lastItem:Math.min(start+size,totalItems)};
}
export type ReaderPageToken=number|"ellipsis";
export function readerPageTokens(page:number,totalPages:number):ReaderPageToken[]{
 const total=Math.max(1,Math.floor(totalPages)||1);
 const current=normaliseReaderPage(page,total);
 if(total<=7)return Array.from({length:total},(_,i)=>i+1);
 const candidates=new Set([1,total,current-1,current,current+1]);
 if(current<=4)for(const n of [2,3,4,5])candidates.add(n);
 if(current>=total-3)for(const n of [total-4,total-3,total-2,total-1])candidates.add(n);
 const sorted=[...candidates].filter(n=>n>=1&&n<=total).sort((a,b)=>a-b);
 const tokens:ReaderPageToken[]=[];
 for(let i=0;i<sorted.length;i++){
  if(i){
   const gap=sorted[i]-sorted[i-1];
   if(gap===2)tokens.push(sorted[i]-1);
   else if(gap>2)tokens.push("ellipsis");
  }
  tokens.push(sorted[i]);
 }
 return tokens;
}
