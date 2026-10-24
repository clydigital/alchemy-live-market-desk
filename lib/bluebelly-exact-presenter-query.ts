/**
 * Owner Presenter only. Parse exact immutable edition references without
 * converting malformed, duplicated or unbounded parameters into "latest".
 * This is not a new Story/version reader and does not query production.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FOCUS=["story","motion","regime","event"] as const;
type FocusKey=typeof FOCUS[number];
export type PresenterExactQuery=Record<string,string|string[]|undefined>;
export type ParsedPresenterExactQuery=
  | {state:"invalid";editionId:null;focus:Record<string,never>}
  | {state:"picker";editionId:null;focus:Record<string,never>}
  | {state:"exact";editionId:string;focus:Partial<Record<FocusKey,string>>};

export function parseBluebellyExactPresenterQuery(query:PresenterExactQuery):ParsedPresenterExactQuery{
  const invalid=():ParsedPresenterExactQuery=>({state:"invalid",editionId:null,focus:{}});
  const allowed=new Set<string>(["edition",...FOCUS]);
  if(Object.keys(query).some(key=>!allowed.has(key)))return invalid();
  const raw=query.edition;
  if(raw===undefined){
    return FOCUS.some(key=>query[key]!==undefined)
      ?invalid():{state:"picker",editionId:null,focus:{}};
  }
  if(typeof raw!=="string"||!UUID.test(raw))return invalid();
  const focus:Partial<Record<FocusKey,string>>={};
  for(const key of FOCUS){
    const value=query[key];
    if(value===undefined)continue;
    if(typeof value!=="string"||!value.trim()||value.length>180
      ||/[\x00-\x1f\x7f]/.test(value))return invalid();
    focus[key]=value;
  }
  return {state:"exact",editionId:raw.toLowerCase(),focus};
}
