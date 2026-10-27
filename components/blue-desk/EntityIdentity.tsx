"use client";

import { useState } from "react";
import { COMPANY_IDENTITY, COUNTRY_IDENTITY, publicIdentitySummary,
  type EntityIdentity, type EntityTone } from "@/lib/bluebelly-entity-identity";
import styles from "./EntityIdentity.module.css";

type MarkProps={entity:EntityIdentity;size?:"sm"|"md"|"lg";className?:string};
/** Identity is a visual cue, never verification or evidence. Curated issuer
 * favicons only; failure falls back to readable text without guessing a brand.
 */
export function EntityMark({entity,size="md",className=""}:MarkProps){
  const [error,setError]=useState(false);
  const id=entity.id.toUpperCase();
  const country=entity.kind==="country"
    ? COUNTRY_IDENTITY[id as keyof typeof COUNTRY_IDENTITY] : undefined;
  const company=entity.kind==="company"?COMPANY_IDENTITY[id]:undefined;
  const label=entity.label||country?.label||company?.label||id;
  return <span className={[styles.mark,styles[size],
    entity.kind==="country"?styles.ball:entity.kind==="company"?styles.logo:styles.asset,className].filter(Boolean).join(" ")}
    data-entity-kind={entity.kind} data-entity-id={id} role="img" aria-label={label}>
    {country?<span aria-hidden="true">{country.flag}</span>
      :company&&!error?<img src={company.favicon} alt="" loading="lazy" referrerPolicy="no-referrer"
        onError={()=>setError(true)} />
      :<span aria-hidden="true">{id.length<=3?id:id.slice(0,2)}</span>}
  </span>;
}
function textLabel(entity:EntityIdentity){
  const id=entity.id.toUpperCase();
  return entity.label
    ||(entity.kind==="country"?COUNTRY_IDENTITY[id as keyof typeof COUNTRY_IDENTITY]?.label:undefined)
    ||(entity.kind==="company"?COMPANY_IDENTITY[id]?.label:undefined)
    ||id;
}
export function EntityChip({entity,tone="neutral",compact=false}:{
  entity:EntityIdentity;tone?:EntityTone;compact?:boolean;
}){
  return <span className={[styles.chip,styles["tone_"+tone],compact?styles.compact:""].join(" ")}>
    <EntityMark entity={entity} size="sm"/><span>{textLabel(entity)}</span>
  </span>;
}
/** Show a bounded, explicit scope strip. Do not infer additional connections
 * from text or from the presence of an icon.
 */
export function EntityScopeStrip({entities,label="AFFECTED",limit=5,tone="neutral"}:{
  entities:readonly EntityIdentity[];label?:string;limit?:number;tone?:EntityTone;
}){
  const safe=publicIdentitySummary(entities,limit);
  if(!safe.length)return null;
  return <div className={styles.scope} aria-label={label}>
    <span className={styles.scopeLabel}>{label}</span>
    <span className={styles.scopeItems}>{safe.map(item=><EntityChip key={item.kind+":"+item.id} entity={item} tone={tone} compact />)}</span>
  </div>;
}
/** Colour communicates research status, not asset movement or truth of a thesis.
 * Mirrors Hybrid's ready/warn/risk concept, with Bluebelly visual tokens.
 */
export function ResearchStatus({tone="neutral",children}:{
  tone?:"neutral"|"ready"|"warn"|"risk";children:React.ReactNode;
}){
  return <span className={[styles.status,styles["tone_"+tone]].join(" ")}>{children}</span>;
}
