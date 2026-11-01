/** Pure edition identity. Two separate private storage receipts with the same
 * static HTML SHA represent one reading edition, never two reports. */
export type PrivateDailyIntelligenceEdition={
 id:string;reportDay:string;title:string;createdAt:string;htmlSha256:string;
 reviewStatus:"PRIVATE_DRAFT"|"OWNER_REVIEWED";delivery:"WORK"|"MY_DESK"|"AUTOMATED";
};
export function uniquePrivateDailyIntelligence(rows:PrivateDailyIntelligenceEdition[]){
 const ordered=[...rows].sort((a,b)=>
  b.reportDay.localeCompare(a.reportDay)||b.createdAt.localeCompare(a.createdAt));
 const seen=new Set<string>();
 const editions=ordered.filter(e=>{
  if(seen.has(e.htmlSha256))return false;
  seen.add(e.htmlSha256);return true;
 });
 return {editions,duplicatesHidden:ordered.length-editions.length};
}
