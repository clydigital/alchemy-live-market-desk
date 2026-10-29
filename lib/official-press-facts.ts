/**
 * Extract narrowly scoped, directly attributable statements from the same
 * official HTML page that already passed the RSS/title/host proof gate.
 * No classification, numeric inference or on-request AI paraphrase.
 */
function decodeEntities(value:string){
 return value
  .replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,v:string)=>{
    const n=v[0].toLowerCase()==="x"?parseInt(v.slice(1),16):parseInt(v,10);
    return n>=32 && n<=0x10ffff?String.fromCodePoint(n):" ";
  })
  .replace(/&(?:nbsp|thinsp);/gi," ")
  .replace(/&amp;/gi,"&").replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'").replace(/&(?:ndash|mdash);/gi,"—");
}
function cleanText(html:string){
 return decodeEntities(html.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim());
}
const NON_FACT=/\b(?:privacy policy|cookie preferences|newsletter|subscribe now|contact us|terms of use|safe harbor|forward.look(?:ing)? statement|more information|all rights reserved)\b/i;
const NUMERIC=/\b\d[\d,.]*(?:%|\b)|[$€£₩]\s*\d|\b(?:million|billion|trillion|gigawatt|megawatt|basis points?)\b/i;
const STOP=new Set(["announces","announced","today","news","investor","release","press","company","reports","report","global","the","with","from","more","than","for","and","that","this"]);
/**
 * Does not claim that these facts explain prices; they are the publisher's
 * words, bounded to original article paragraphs and first-sentence extracts.
 */
export function extractOfficialPressFacts(html:string,headline:string):string[]{
 const article=/<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1]
   ||/<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html)?.[1]
   ||/<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1];
 if(!article)return [];
 const safe=article.replace(/<(?:script|style|nav|header|footer|aside|form|noscript|svg)\b[^>]*>[\s\S]*?<\/\s*(?:script|style|nav|header|footer|aside|form|noscript|svg)\s*>/gi," ");
 const anchors=[...new Set((headline.toLowerCase().match(/[a-z]{5,}/g)||[]).filter(t=>!STOP.has(t)))];
 if(!anchors.length)return [];
 const result:string[]=[];
 // The standard Fed FOMC headline is only "Federal Reserve issues FOMC
 // statement". Extract the actual rate action from the same validated source
 // page, rather than pretending the headline itself states "held" or "hiked".
 const bankPolicy=/\b(?:fomc|federal reserve|bank of canada|rbnz|reserve bank of new zealand|official cash rate|ocr)\b/i.test(headline);
 const sourceRateDecision=(line:string)=>bankPolicy
   && /\b(?:committee|council|bank|reserve)\b/i.test(line)
   && /\b(?:decided to|voted to|continues? to|maintains?|maintained|held|holds?|raised|raises?|increased|increases|unchanged|cut|lowered)\b/i.test(line)
   && /\b(?:federal funds rate|target range|overnight rate|policy rate|official cash rate|ocr)\b/i.test(line);
 const p=/<p\b[^>]*>([\s\S]*?)<\/p>/gi;
 for(const match of safe.matchAll(p)){
  const text=cleanText(match[1]);
  if(text.length<55||text.length>850||NON_FACT.test(text))continue;
  const sentence=text.split(/(?<=[.!?])\s+(?=[A-Z\d])/)[0]?.trim()||"";
  if(sentence.length<55||sentence.length>235||NON_FACT.test(sentence))continue;
  const lower=sentence.toLowerCase();
  const ecbPolicy=headline.trim().toLowerCase()==="monetary policy decisions" &&
    /\b(?:governing council|ecb|deposit facility|refinancing operations)\b/i.test(sentence) &&
    NUMERIC.test(sentence);
  if(!ecbPolicy&&!anchors.some(a=>lower.includes(a))&&!sourceRateDecision(sentence))continue;
  // A specific numerical/commercial announcement is more useful than
  // source boilerplate. Non-numeric sentences are admitted only if they
  // describe an actual action with an identifiable subject.
  if(!NUMERIC.test(sentence) &&
      !/\b(?:signed|agreed|approved|acquired|launched|expanded|increased|reduced|secured|issued|maintained|held|cut|raised|invested|partnered|contracted|imported|importing|exported|exporting|grew|fell|declined|climbed|shifted|exceeded)\b/i.test(sentence))continue;
  if(!result.includes(sentence))result.push(sentence);
  if(result.length>=2)break;
 }
 return result;
}
