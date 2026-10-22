import type { EditorialArticle } from "../market-brief-editorial.ts";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAGE=6;

export type PublishedStoryReading={
  article:EditorialArticle;
  storyId:string;
  editionId:string;
  publishedAt:string;
};
export function exactPublishedStoryId(article:Pick<EditorialArticle,"articleId"|"editionId">):string|null {
 const prefix="article:"+article.editionId+":";
 if(!article.articleId.startsWith(prefix))return null;
 const suffix=article.articleId.slice(prefix.length);
 return UUID.test(suffix)?suffix.toLowerCase():null;
}
export function newestStoryReadings(items:readonly PublishedStoryReading[]):PublishedStoryReading[] {
 const sorted=[...items].filter(item=>item.article.editorial.readiness!=="RESEARCH_ONLY"
   && Number.isFinite(Date.parse(item.publishedAt)))
   .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)
     || a.article.articleId.localeCompare(b.article.articleId));
 const used=new Set<string>();
 return sorted.filter(item=>{
  if(used.has(item.storyId))return false;
  used.add(item.storyId);return true;
 });
}
export function readingsForStory(items:readonly PublishedStoryReading[],storyId:string,editionId:string):PublishedStoryReading[] {
 const selected=items.find(item=>item.storyId===storyId && item.editionId===editionId);
 if(!selected)return [];
 const limit=Date.parse(selected.publishedAt);
 return [...items].filter(item=>item.storyId===storyId && item.editionId!==editionId
   && Date.parse(item.publishedAt)<=limit)
   .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
}
export function paginateStoryReadings(items:readonly PublishedStoryReading[],page:number,pageSize=MAX_PAGE) {
 const pages=Math.max(1,Math.ceil(items.length/pageSize));
 const current=Number.isSafeInteger(page) && page>=1 && page<=pages?page:1;
 return {page:current,pages,total:items.length,items:items.slice((current-1)*pageSize,current*pageSize)};
}
