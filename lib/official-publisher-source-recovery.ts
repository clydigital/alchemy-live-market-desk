import { scrapePublicUrlWithFirecrawl, type FirecrawlScrapeResult } from "./firecrawl.ts";

/**
 * Transport-only recovery for exact public original-publisher URLs after
 * direct fetch fails. The caller must still verify the permitted publisher,
 * RSS timestamp, article title, URL identity and the article's factual claims.
 *
 * Jina Reader is already configured for the existing research deployment.
 * x-respond-with: html requests the source document rather than a paraphrase.
 * No search result, generated answer or LLM summary can become source proof.
 */
export async function recoverOfficialPublisherSource(
  sourceUrl: string,
  opts: {timeoutMs?:number;fetchImpl?:typeof fetch}={},
):Promise<FirecrawlScrapeResult>{
  const key=process.env.JINA_API_KEY?.trim();
  if(key){
    const fetchImpl=opts.fetchImpl??fetch;
    const timeoutMs=Math.max(2_000,Math.min(opts.timeoutMs??13_000,16_000));
    try{
      const target=new URL(sourceUrl);
      if(target.protocol!=="https:"||target.username||target.password)
        return {ok:false,code:"invalid_url",retryable:false,detail:"Only public source HTTPS URLs are permitted."};
      const response=await fetchImpl("https://r.jina.ai/"+target.toString(),{
        method:"GET",cache:"no-store",signal:AbortSignal.timeout(timeoutMs),
        headers:{
          Authorization:"Bearer "+key,
          Accept:"text/plain",
          "X-Respond-With":"html",
          "X-Respond-Timing":"html",
          "X-No-Cache":"true",
        },
      });
      if(response.ok){
        const body=(await response.text()).slice(0,250_000);
        // Never promote Jina's Markdown, extracted text, a snippet or an
        // error page into the original HTML/RSS verification contract.
        if(/<(?:html|!doctype\s+html|rss|rdf:RDF|feed)\b/i.test(body))
          return {ok:true,rawHtml:body,sourceUrl:target.toString(),resolvedUrl:target.toString(),statusCode:200,warning:null};
      }
    }catch{
      // A provider failure is not evidence. Try only the existing fallback.
    }
  }
  return scrapePublicUrlWithFirecrawl(sourceUrl,{timeoutMs:opts.timeoutMs,fetchImpl:opts.fetchImpl});
}
