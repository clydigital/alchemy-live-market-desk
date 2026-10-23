import "server-only";
import { getHybridPresenterEditionCandidates } from "@/lib/hybrid-publication";
import { projectMarketBriefArticles } from "@/lib/market-brief-articles";
import { loadEditorialMarketBrief } from "@/lib/market-brief-editorial-data";
import { exactPublishedStoryId, type PublishedStoryReading } from "@/lib/blue-desk/story-archive";

/** Bounded read-only archive projection. No raw edition / owner-only payload reaches the client. */
export async function getRecentPublishedStoryReadings():Promise<PublishedStoryReading[]> {
 const editions=await getHybridPresenterEditionCandidates({fresh:true}).catch(()=>[]);
 const selected=editions.slice(0,24);
 const output:PublishedStoryReading[]=[];
 // Four at a time: bounded source/evidence queries, no unbounded public scan.
 for(let index=0;index<selected.length;index+=4){
   const pages=await Promise.all(selected.slice(index,index+4).map(async edition=>{
     try{
       const brief=await loadEditorialMarketBrief(projectMarketBriefArticles(edition));
       return brief.articles.flatMap(article=>{
         const storyId=exactPublishedStoryId(article);
         if(!storyId||article.editorial.readiness==="RESEARCH_ONLY")return [];
         return [{article,storyId,editionId:article.editionId,publishedAt:edition.published_at}];
       });
     }catch{return [];}
   }));
   output.push(...pages.flat());
 }
 return output;
}
