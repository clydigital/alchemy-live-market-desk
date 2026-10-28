"use client";

import { useState, type ReactNode } from "react";
import {
  BLUEBELLY_COMPANIES, BLUEBELLY_COUNTRIES, ASSET_CODES,
  companyFavicon, entityPortrait, entityName, identitiesFromAssets, institutionCountry,
  normaliseEntityCode, type EntityIdentity, type EntityKind,
} from "@/lib/bluebelly-entity-identity";
import styles from "./EntityIdentity.module.css";

type Size="xs"|"sm"|"md"|"lg";
export function EntityMark({kind,code,size="sm",className="",label}:{
  kind:EntityKind;code:string;size?:Size;className?:string;label?:string;
}){
  const normalized=normaliseEntityCode(code);
  const [brokenUrl,setBrokenUrl]=useState<string|null>(null);
  const [brokenPortrait,setBrokenPortrait]=useState<string|null>(null);
  const portrait=entityPortrait(kind,normalized);
  const companyUrl=kind==="company"?companyFavicon(normalized):null;
  const flagCountry=kind==="institution"?institutionCountry(normalized):kind==="country"?normalized:null;
  const country=flagCountry?BLUEBELLY_COUNTRIES[flagCountry]:null;
  const name=label||entityName({kind,code:normalized});
  const mark=kind==="company"?"issuer":kind==="country"?"country":kind==="institution"?"institution":"asset";
  const assetSymbol=normalized==="GOLD"||normalized==="XAUUSD"?"Au":normalized==="BRENT"||normalized==="WTI"?"Oil"
    :normalized==="SILVER"?"Ag":normalized==="BTC"?"₿":normalized==="SPX"?"SP":normalized.slice(0,3);
  const initial=kind==="company"?normalized.slice(0,2):kind==="institution"?normalized.slice(0,3):assetSymbol;
  return <span className={[styles.mark,styles[mark],styles[size],className].filter(Boolean).join(" ")}
    title={name} data-entity-kind={kind} data-entity-code={normalized} role="img" aria-label={name}>
    {portrait&&brokenPortrait!==portrait?<img className={styles.portrait} src={portrait} alt="" width="40" height="44" loading="lazy" onError={()=>setBrokenPortrait(portrait)}/>:country?country.flag:companyUrl&&brokenUrl!==companyUrl?
      <img src={companyUrl} alt="" width="22" height="22" loading="lazy" referrerPolicy="no-referrer"
        onError={()=>setBrokenUrl(companyUrl)}/>:initial||"•"}
  </span>;
}
export function EntityChip({identity,size="sm",compact=false}:{
  identity:EntityIdentity;size?:Size;compact?:boolean;
}){
  return <span className={styles.chip} data-entity-chip={identity.kind}>
    <EntityMark kind={identity.kind} code={identity.code} label={identity.label} size={size}/>
    {compact?<span className={styles.chipText}>{identity.code}</span>:
      <span className={styles.chipText}>{entityName(identity)}</span>}
  </span>;
}
export function EntityStack({identities,max=5,label="Related entities",size="sm"}:{
  identities:readonly EntityIdentity[];max?:number;label?:string;size?:Size;
}){
  const shown=identities.slice(0,Math.max(1,Math.min(8,max)));
  if(!shown.length)return null;
  return <span className={styles.stack} role="group" aria-label={label} data-entity-stack>
    {shown.map((entity,i)=><EntityMark key={entity.kind+":"+entity.code+":"+i}
      kind={entity.kind} code={entity.code} label={entity.label} size={size}/>)}
    {identities.length>shown.length?<small>+{identities.length-shown.length}</small>:null}
  </span>;
}
export function ScopeStrip({assets,max=5,label="In focus"}:{
  assets:readonly string[];max?:number;label?:string;
}){
  const identities=identitiesFromAssets(assets,max);
  if(!identities.length)return null;
  return <div className={styles.scope} data-entity-scope>
    <span className={styles.scopeLabel}>{label}</span>
    <span className={styles.scopeChips}>{identities.map(identity=><EntityChip key={identity.kind+":"+identity.code}
      identity={identity} compact size="xs"/>)}</span>
  </div>;
}
export function EntityRow({identity,title,subtitle,trailing,className=""}:{
  identity:EntityIdentity;title:string;subtitle?:string;trailing?:ReactNode;className?:string;
}){
  return <span className={[styles.row,className].filter(Boolean).join(" ")} data-entity-row>
    <EntityMark kind={identity.kind} code={identity.code} label={identity.label}/>
    <span className={styles.rowCopy}><strong>{title}</strong>{subtitle?<small>{subtitle}</small>:null}</span>
    {trailing?<span className={styles.trailing}>{trailing}</span>:null}
  </span>;
}
