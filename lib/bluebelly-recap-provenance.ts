/** Pure, read-only presentation label. A source-reviewed editorial snapshot is
 * never promoted to canonical Evidence by this function. */
export function decisionRecapSourceLabel(status:"NEW"|"UPCOMING"|"FEATURE",issuerResult:boolean,id:string){
 if(status==="UPCOMING") return "PREVIEW · OUTCOME NOT YET VERIFIED";
 if(issuerResult) return "ISSUER-REVIEWED FINANCIAL RESULT";
 if(id.startsWith("bea-")) return "BEA ORIGINAL RELEASE · SOURCE-REVIEWED";
 return "SOURCE-REVIEWED MARKET DEVELOPMENT";
}
