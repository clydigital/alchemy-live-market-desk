/**
 * COTD/OB *source-pack* and suitability assessment, not an autonomous writer.
 * Input is the exact selected immutable edition and Dossier projection only.
 * No fresh web data, speculative price claims or cross-edition enrichment.
 */
import type { PrepEditorialReadiness, PrepEditorialItem } from "./presenter-prep-editorial-readiness.ts";
import type { DossierPresentationV1 } from "./dossier-v2/presentation-adapter.ts";
export const PRESENTER_EDITORIAL_LANES_CONTRACT="presenter-editorial-lanes/1" as const;
type Check={name:string;pass:boolean;reason:string};
export type PresenterEditorialLane={
  kind:"COTD"|"OB";
  state:"SOURCE_PACK_AVAILABLE"|"RESEARCH_NEEDED";
  headline:string|null;
  sourceAsOf:string|null;
  dossierId:string|null;
  editionId:string|null;
  checks:Check[];
  snippets:Array<{label:string;text:string;sourceUrl:string|null;sourceName:string|null;basis:string}>;
  unresolved:string[];
  /** Explicitly never a final, signed off article. */
  publishable:false;
};
const words=(text:string)=>text.trim()?text.trim().split(/\s+/).length:0;
const validUrl=(raw:string)=>{try{const u=new URL(raw);return u.protocol==="https:"&&!u.username&&!u.password&&Boolean(u.hostname.includes("."));}catch{return false;}};
const itemSources=(item:PrepEditorialItem)=>item.reporting.filter(r=>validUrl(r.sourceUrl));
export function buildPresenterEditorialLanes(input:{
  editorial:PrepEditorialReadiness;
  dossier:DossierPresentationV1|null;
  exactDossierId:string|null;
  pinnedEditionId:string|null;
}):{contractVersion:typeof PRESENTER_EDITORIAL_LANES_CONTRACT;lanes:PresenterEditorialLane[]} {
  const {editorial,dossier,exactDossierId,pinnedEditionId}=input;
  const pinned=Boolean(pinnedEditionId&&exactDossierId&&dossier?.dossierId===exactDossierId
    &&editorial.selectedEditionId===pinnedEditionId&&editorial.status!=="UNAVAILABLE");
  const item=pinned ? editorial.items.find(x=>x.kind==="FULL_ARTICLE"&&itemSources(x).length>0)
    || editorial.items.find(x=>x.kind==="FACTUAL_BRIEF"&&itemSources(x).length>0) :null;
  const reporting=item?itemSources(item):[];
  const angles=item?.implications||[];
  const snippetWordCount=words([...reporting.map(r=>r.text),...angles.map(r=>r.text)].join(" "));
  const headline=item?.headline||null;
  const cotdChecks:Check[]=[
    {name:"Exact frozen edition and Dossier",pass:pinned,reason:"No later market copy is substituted for a requested edition"},
    {name:"Original source-backed opening",pass:reporting.length>0,reason:"Every factual report needs a valid original HTTPS source"},
    {name:"Interpretation distinguished from fact",pass:angles.length>0,reason:"Context and conditional implications remain explicitly labelled"},
    {name:"LY headline ≤63 characters",pass:Boolean(headline&&headline.length<=63),reason:"Long titles require an editorial rewrite"},
    {name:"Client article 600–800 words",pass:snippetWordCount>=600&&snippetWordCount<=800,reason:"Source excerpts alone are not a finished Chart of the Day"},
    {name:"Technical chart and time-matched reaction independently verified",pass:false,reason:"The frozen editorial record does not establish a chart, its 4H/1D EMA band or an intraday reaction"},
    {name:"Human editorial approval",pass:false,reason:"No approval has been given in this read-only view"},
  ];
  const cotd:PresenterEditorialLane={
    kind:"COTD",state:pinned&&reporting.length?"SOURCE_PACK_AVAILABLE":"RESEARCH_NEEDED",
    headline,sourceAsOf:item?.asOf||null,dossierId:exactDossierId,editionId:pinnedEditionId,
    checks:cotdChecks,publishable:false,
    snippets:[
      ...reporting.slice(0,3).map(r=>({label:"Original reporting",text:r.text,sourceUrl:r.sourceUrl,sourceName:r.sourceName,basis:"SOURCE_VERIFIED"})),
      ...angles.slice(0,3).map(r=>({label:"Interpretation / market implication",text:r.text,sourceUrl:null,sourceName:null,basis:r.basis})),
    ],
    unresolved:[
      ...(item?.gaps||[]),
      "Verify an actual dated price chart, supported mechanism and conditional invalidation before publication.",
      "Source-pack excerpts are not an approved 600–800-word LY COTD.",
    ],
  };
  const stories=pinned&&dossier?dossier.whatMattersNow.stories.slice(0,4):[];
  const material=pinned&&dossier?dossier.health.researchGaps.filter(g=>g.severity==="MATERIAL"):[];
  const cases=pinned&&dossier?dossier.watchNext.slice(0,4):[];
  const obSnippets:PresenterEditorialLane["snippets"]=[
    ...stories.map(s=>({label:"Canonical Story · "+s.epistemicLabel,text:s.whyItMatters||s.whatChanged,sourceUrl:null,sourceName:null,basis:"FROZEN_DOSSIER_CONTEXT"})),
    ...cases.map(x=>({label:"Counterargument / next proof · "+x.divergence,text:x.researchNext,sourceUrl:null,sourceName:null,basis:"INVESTIGATION_NOT_CONCLUSION"})),
  ];
  const obChecks:Check[]=[
    {name:"Exact source vintage and immutable Dossier",pass:pinned,reason:"Dossier must match the selected editorial edition"},
    {name:"Multiple competing market angles",pass:stories.length>=2,reason:"An OB should be more than a single Story headline"},
    {name:"Open questions and scenario tests",pass:cases.length>0,reason:"Include meaningful countercases and what changes the view"},
    {name:"No material unresolved source blocker",pass:pinned&&material.length===0,reason:"MATERIAL gaps must be acknowledged rather than claimed resolved"},
    {name:"Independent current-date numerical verification",pass:false,reason:"Historical source packets cannot prove today's yields, earnings or price"},
    {name:"LY narrative, actual charts and human approval",pass:false,reason:"This is an OB research pack, not an edited publication"},
  ];
  const ob:PresenterEditorialLane={
    kind:"OB",state:pinned&&stories.length?"SOURCE_PACK_AVAILABLE":"RESEARCH_NEEDED",
    headline:pinned?dossier?.header.headline??null:null,sourceAsOf:pinned?dossier?.asOf??null:null,
    dossierId:exactDossierId,editionId:pinnedEditionId,checks:obChecks,publishable:false,
    snippets:obSnippets,
    unresolved:[
      ...material.map(g=>g.description),
      "Re-verify present-tense macro figures, oil/yield reactions, issuer filings and competing scenarios.",
      "No final Opening Bell article has been approved in this view.",
    ],
  };
  return {contractVersion:PRESENTER_EDITORIAL_LANES_CONTRACT,lanes:[cotd,ob]};
}
