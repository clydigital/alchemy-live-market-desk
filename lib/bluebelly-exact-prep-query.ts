/**
 * Owner-only exact Presenter query boundary.
 *
 * A bare URL may show a deliberate private edition picker, but may NEVER
 * attach a Story/Motion/Regime/Event focus to the newest edition implicitly.
 * Any pinned view must identify its immutable edition explicitly.
 */
export type BluebellyExactPrepQuery = Record<string,string|string[]|undefined>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FOCUS=["story","motion","regime","event"] as const;
type FocusKey=typeof FOCUS[number];
export type BluebellyExactPrepSelection =
  | {state:"invalid"}
  | {state:"picker"}
  | {state:"exact"; editionId:string; focus:Partial<Record<FocusKey,string>>};

export function parseBluebellyExactPrepQuery(
  query:BluebellyExactPrepQuery,
):BluebellyExactPrepSelection {
  const allowed=new Set<string>(["edition",...FOCUS]);
  if(Object.keys(query).some(key=>!allowed.has(key)))return {state:"invalid"};

  const raw=query.edition;
  if(raw===undefined){
    return FOCUS.some(key=>query[key]!==undefined)
      ?{state:"invalid"}:{state:"picker"};
  }
  if(typeof raw!=="string"||!UUID.test(raw))return {state:"invalid"};

  const focus:Partial<Record<FocusKey,string>>={};
  for(const key of FOCUS){
    const value=query[key];
    if(value===undefined)continue;
    if(typeof value!=="string"||!value.trim()||value.length>180
      ||/[\x00-\x1f\x7f]/.test(value))return {state:"invalid"};
    focus[key]=value.trim();
  }
  return {state:"exact",editionId:raw.toLowerCase(),focus};
}
