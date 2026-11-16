/** Topic routing only: never a source-admission or peace-direction decision. */
export const HORMUZ_TOPIC_TERMS=["hormuz","iran","tehran","persian gulf","gulf of oman"] as const;
export function isHormuzRelevant(text:string):boolean{
 return /\b(?:hormuz|iran(?:ian)?|tehran|persian gulf|gulf of oman)\b/i.test(text);
}

/** Fixed, application-owned terms and columns; filter persisted rows BEFORE the cap. */
export function hormuzTopicFilter(columns:readonly string[]):string{
 return columns.flatMap(column=>HORMUZ_TOPIC_TERMS.map(term=>`${column}.ilike.%${term}%`)).join(",");
}
