/** Aggregate only successfully read partitions. A failed read is not an empty partition.
 * No upstream error text is retained or exposed by this pure projection. */
export function projectXWirePool<T>(results:readonly PromiseSettledResult<{data:T[]|null;error:unknown}>[]){
 const rows:T[]=[];let successfulPartitions=0;
 for(const result of results){
  if(result.status==="fulfilled"&&!result.value.error&&Array.isArray(result.value.data)){
   successfulPartitions++;rows.push(...result.value.data);
  }
 }
 return {rows,successfulPartitions,totalPartitions:results.length,complete:results.length>0&&successfulPartitions===results.length};
}
