/**
 * Conservative publisher-native fallback for CPI with officially unavailable
 * annual comparisons. Never infer a 12-month rate from missing prior-year data.
 * Call only after fetching the exact original BLS release archive.
 */
export function parseBlsMonthlyOnlyCpiOriginal(input:{
 body:string;referencePeriod:string|null;sourceUrl:string;releaseDate:string;
}):{actual:string;sourceUrl:string}|null{
 const ref=/^(January|February|March|April|May|June|July|August|September|October|November|December) (20\d{2})$/.exec(input.referencePeriod??"");
 if(!ref)return null;
 const date=new Date(input.releaseDate);
 if(!Number.isFinite(date.getTime()))return null;
 const archive=String(date.getUTCMonth()+1).padStart(2,"0")+String(date.getUTCDate()).padStart(2,"0")+date.getUTCFullYear();
 if(input.sourceUrl!=="https://www.bls.gov/news.release/archives/cpi_"+archive+".htm")return null;
 const plain=input.body.replace(/<script[\s\S]*?<\/script>/gi," ")
  .replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ")
  .replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&")
  .replace(/\s+/g," ").trim();
 const header=new RegExp("CONSUMER PRICE INDEX\\s*[-–]\\s*"+ref[1]+" "+ref[2]+"\\b","i");
 const location=header.exec(plain);
 if(!location)return null;
 // Isolate publisher opening paragraphs; ignore tables and appended articles.
 const intro=plain.slice(location.index,location.index+2800);
 const month=ref[1];
 const headline=new RegExp("The Consumer Price Index for All Urban Consumers \\(CPI-U\\) (increased|rose|decreased|fell) (\\d+(?:\\.\\d+)?) percent on a seasonally adjusted basis in "+month+"\\b","i").exec(intro);
 const core=new RegExp("The index for all items less food and energy (rose|increased|decreased|fell) (\\d+(?:\\.\\d+)?) percent in "+month+"\\b","i").exec(intro);
 const annualMissing=new RegExp("BLS cannot publish 12-month percent changes for\\s+"+month+" "+ref[2]+"\\b","i").test(intro);
 if(!headline||!core||!annualMissing)return null;
 const signed=(verb:string,value:string)=>{
  const number=Number(value);
  if(!Number.isFinite(number)||number<0||number>20)return null;
  return (/(?:decreased|fell)/i.test(verb)?"-":"+")+value;
 };
 const head=signed(headline[1],headline[2]),coreValue=signed(core[1],core[2]);
 if(!head||!coreValue)return null;
 return {
  actual:"Headline CPI "+head+"% m/m; y/y unavailable (BLS); Core "+coreValue+"% m/m; y/y unavailable (BLS)",
  sourceUrl:input.sourceUrl,
 };
}
export function isSameOriginalBlsArchive(requested:string,actual:string):boolean{
 try{
  const a=new URL(requested),b=new URL(actual);
  return a.protocol==="https:"&&b.protocol==="https:"&&
   a.hostname==="www.bls.gov"&&b.hostname==="www.bls.gov"&&
   a.pathname===b.pathname&&!a.search&&!b.search&&!a.hash&&!b.hash;
 }catch{return false;}
}
