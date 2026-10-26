/**
 * Branch 03: pure, owner-review Creator Intelligence narrative compiler.
 *
 * No DB, HTTP, model execution, transcript consumption watermark, canonical
 * Story/Dossier mutation or public publication. Branch 02 must provide
 * authenticated, source-backed inputs to this deliberately isolated seam.
 */
export const CREATOR_STORY_EDITORIAL_STANDARD =
  "docs/editorial/BLUEBELLY_CREATOR_STORY_SUMMARY_STANDARD.md@1.0" as const;

export type CreatorTranscriptVideo = {
  creatorId: string;
  videoId: string;
  originalUrl: string;
  title: string;
  publishedAt: string;
  transcriptStatus: "complete" | "partial" | "missing" | "discovered";
  transcriptText?: string | null;
  transcriptRetrievedAt?: string | null;
  transcriptProvider?: string | null;
  transcriptSha256?: string | null;
};

export type CreatorSourceClaim = {
  claimId: string;
  creatorId: string;
  videoId: string;
  threadId: string;
  assertion: string;
  transcriptExcerpt: string;
  transcriptSeconds: number | null;
  relationTo?: {
    claimId: string;
    type: "reinforces" | "revises" | "contradicts";
  };
};

export type CreatorStoryInput = {
  creatorId: string;
  asOf: string;
  previousEditionId?: string | null;
  videos: readonly CreatorTranscriptVideo[];
  claims: readonly CreatorSourceClaim[];
};

type TranscriptStatus = CreatorTranscriptVideo["transcriptStatus"];

export type CreatorStorySource = {
  videoId: string;
  url: string;
  title: string;
  publishedAt: string;
  transcriptStatus: TranscriptStatus;
  consumed: boolean;
  transcriptProvider: string | null;
  transcriptRetrievedAt: string | null;
  transcriptSha256: string | null;
};

export type CreatorStoryClaim = Omit<CreatorSourceClaim,"creatorId">;

export type PreparedCreatorStory = {
  creatorId: string;
  asOf: string;
  previousEditionId: string | null;
  coverageStart: string;
  coverageEnd: string;
  inputVideoIds: string[];
  consumedVideoIds: string[];
  pendingTranscriptIds: string[];
  sources: CreatorStorySource[];
  claims: CreatorStoryClaim[];
  thesisChanges: Array<{
    earlierClaimId: string;
    laterClaimId: string;
    type: "reinforces" | "revises" | "contradicts";
    earlierVideoId: string;
    laterVideoId: string;
  }>;
};

export type CreatorStoryModelOutput = {
  headline: string;
  centralTension: string;
  acts: Array<{
    title: string;
    body: string;
    claimIds: string[];
    videoIds: string[];
  }>;
  learningMoments: Array<{
    question: string;
    explanation: string;
    claimIds: string[];
  }>;
  latestCreatorView: string;
  latestClaimId: string;
  watchpoints: Array<{
    question: string;
    claimIds: string[];
  }>;
  limitations: string;
};

export type CreatorStoryDraft = Omit<CreatorStoryModelOutput,"latestClaimId"> & {
  surface: "Bluebelly";
  section: "Creator Intelligence / Creator Summary";
  visibility: "owner";
  status: "draft";
  editorialStandard: typeof CREATOR_STORY_EDITORIAL_STANDARD;
  creatorId: string;
  asOf: string;
  previousEditionId: string | null;
  coverageStart: string;
  coverageEnd: string;
  inputVideoIds: string[];
  consumedVideoIds: string[];
  pendingTranscriptIds: string[];
  thesisChanges: PreparedCreatorStory["thesisChanges"];
  sourceLedger: CreatorStorySource[];
  claimLedger: CreatorStoryClaim[];
  verificationStatus: "creator_attributed_unverified";
  latestClaimId: string;
};

const validTime = (value: string, cutoff: number) =>
  typeof value==="string" && /T\d{2}:\d{2}/.test(value) &&
  Number.isFinite(Date.parse(value)) && Date.parse(value)<=cutoff;

const validText = (value: unknown, min: number, max: number): value is string =>
  typeof value==="string" && value.trim()===value &&
  value.length>=min && value.length<=max && !/[\u0000-\u0008\u000b-\u001f]/.test(value);

const validId = (s: unknown) => typeof s==="string" && /^[a-zA-Z0-9_-]{3,90}$/.test(s);

function validVideoUrl(url: string, id: string): boolean {
  try {
    const u=new URL(url);
    if(u.protocol!=="https:" || u.username || u.password) return false;
    const host=u.hostname.toLowerCase();
    if(host==="youtu.be")return u.pathname==="/"+id;
    if(host!=="youtube.com"&&host!=="www.youtube.com"&&host!=="m.youtube.com")return false;
    return u.pathname==="/watch" && u.searchParams.get("v")===id;
  }catch{return false;}
}

function sameSet(left: readonly string[],right: readonly string[]): boolean {
  return new Set(left).size===left.length &&
    new Set(right).size===right.length &&
    left.length===right.length &&
    left.every(value=>right.includes(value));
}

/**
 * Validate and reduce a trusted adapter packet to a read-only, transcript-
 * anchored model input. Returns null if no complete transcript-backed claim
 * exists. Incomplete videos stay pending; a source watermark is NEVER advanced.
 *
 * All claims are commentary by the creator. Even a perfect transcript does
 * not verify the market facts asserted inside it.
 */
export function prepareCreatorStory(input: CreatorStoryInput): PreparedCreatorStory | null {
  if(!validId(input.creatorId)||!Number.isFinite(Date.parse(input.asOf))) throw Error("INVALID_CREATOR_PACKET");
  const cutoff=Date.parse(input.asOf);
  if(!Array.isArray(input.videos)||input.videos.length>25||
     !Array.isArray(input.claims)||input.claims.length>160)throw Error("UNBOUNDED_CREATOR_PACKET");
  const videos=new Map<string,CreatorTranscriptVideo>();
  for(const v of input.videos){
    if(v.creatorId!==input.creatorId||!validId(v.videoId)||v.videoId.length!==11||
      videos.has(v.videoId)||!validVideoUrl(v.originalUrl,v.videoId)||
      !validText(v.title,3,180)||!validTime(v.publishedAt,cutoff)||
      !["complete","partial","missing","discovered"].includes(v.transcriptStatus))
      throw Error("INVALID_VIDEO_PROVENANCE");
    videos.set(v.videoId,v);
  }
  const ordered=[...videos.values()].sort((a,b)=>
    Date.parse(a.publishedAt)-Date.parse(b.publishedAt) || a.videoId.localeCompare(b.videoId));
  const consumed=ordered.filter(v=>v.transcriptStatus==="complete" &&
    typeof v.transcriptText==="string" && v.transcriptText.trim().length>=60 &&
    v.transcriptText.length<=1_000_000 &&
    !!v.transcriptRetrievedAt && validTime(v.transcriptRetrievedAt,cutoff));
  const acceptedIds=new Set(consumed.map(v=>v.videoId));
  const claims=new Map<string,CreatorSourceClaim>();
  for(const claim of input.claims){
    if(claim.creatorId!==input.creatorId||!validId(claim.claimId)||
      claims.has(claim.claimId)||!videos.has(claim.videoId)||
      !validId(claim.threadId)||!validText(claim.assertion,12,1000)||
      !validText(claim.transcriptExcerpt,12,1000)||
      !(claim.transcriptSeconds===null ||
        (Number.isInteger(claim.transcriptSeconds)&&claim.transcriptSeconds>=0)))
      throw Error("INVALID_CREATOR_CLAIM");
    claims.set(claim.claimId,claim);
  }
  // An incomplete transcript cannot back a claim, regardless of a creator
  // model's confidence or any earlier discovery-only record.
  const eligible=[...claims.values()].filter(c=>acceptedIds.has(c.videoId));
  for(const c of eligible){
    const source=videos.get(c.videoId)!;
    if(!source.transcriptText!.includes(c.transcriptExcerpt))
      throw Error("CLAIM_EXCERPT_NOT_IN_TRANSCRIPT");
  }
  if(eligible.length===0)return null;
  const orderClaim=(a:CreatorSourceClaim,b:CreatorSourceClaim)=>{
    const av=videos.get(a.videoId)!,bv=videos.get(b.videoId)!;
    return Date.parse(av.publishedAt)-Date.parse(bv.publishedAt) ||
      a.videoId.localeCompare(b.videoId) ||
      (a.transcriptSeconds??Number.MAX_SAFE_INTEGER)-(b.transcriptSeconds??Number.MAX_SAFE_INTEGER) ||
      a.claimId.localeCompare(b.claimId);
  };
  eligible.sort(orderClaim);
  const eligibleById=new Map(eligible.map(c=>[c.claimId,c]));
  const changes: PreparedCreatorStory["thesisChanges"]=[];
  for(const c of eligible){
    if(!c.relationTo)continue;
    const prev=eligibleById.get(c.relationTo.claimId);
    if(!prev||prev.threadId!==c.threadId||orderClaim(prev,c)>=0||
      !["reinforces","revises","contradicts"].includes(c.relationTo.type))
      throw Error("INVALID_THESIS_CHANGE_LINEAGE");
    changes.push({earlierClaimId:prev.claimId,laterClaimId:c.claimId,
      type:c.relationTo.type,earlierVideoId:prev.videoId,laterVideoId:c.videoId});
  }
  return {
    creatorId:input.creatorId,asOf:input.asOf,
    previousEditionId:input.previousEditionId??null,
    coverageStart:consumed[0].publishedAt,
    coverageEnd:consumed[consumed.length-1].publishedAt,
    inputVideoIds:ordered.map(v=>v.videoId),
    consumedVideoIds:consumed.map(v=>v.videoId),
    pendingTranscriptIds:ordered.filter(v=>!acceptedIds.has(v.videoId)).map(v=>v.videoId),
    sources:ordered.map(v=>({
      videoId:v.videoId,url:v.originalUrl,title:v.title,
      publishedAt:v.publishedAt,transcriptStatus:v.transcriptStatus,
      consumed:acceptedIds.has(v.videoId),
      transcriptProvider:v.transcriptProvider??null,
      transcriptRetrievedAt:v.transcriptRetrievedAt??null,
      transcriptSha256:v.transcriptSha256??null,
    })),
    claims:eligible.map(({creatorId:_,...claim})=>claim),
    thesisChanges:changes,
  };
}

/** Build only an editorial request. Branch 02 owns authorised read access;
 * the caller owns model execution, persistence, editorial review and release. */
export function buildCreatorStoryPrompt(prepared: PreparedCreatorStory): string {
  return JSON.stringify({
    editorialStandard:CREATOR_STORY_EDITORIAL_STANDARD,
    instruction:[
      "Return strict JSON with headline, centralTension, acts, learningMoments, latestCreatorView, latestClaimId, watchpoints, limitations.",
      "You are writing ONE creator's evolving market argument for Bluebelly owner review, not a market fact report.",
      "Open with a genuine tension; develop Act 1 onward in publication order, following whether later claims reinforce, revise or contradict earlier ones.",
      "Only use the supplied transcript-anchored creator claims. Cite source claimIds and matching videoIds in every act and source claimIds in each learning moment/watchpoint.",
      "Deduplicate repeated views without erasing their cited source videos. Never merge speakers or invent a motive, quote, market observation, event time or causal relationship.",
      "Place brief plain-English finance lessons at the point the reader needs them, with counterforces; use British English and short readable paragraphs.",
      "Latest view must identify the latest documented claim, not an invented new position. All creator claims remain unverified market commentary unless independently corroborated elsewhere.",
      "Videos in pendingTranscriptIds are not read evidence; do not summarise or quote them from titles.",
      "No new numbers beyond supplied claims; no unverifiable chart levels, facts or trading commands.",
      "This is an unverified owner-review draft. Never claim it is canonical Dossier evidence, approved or published.",
    ],
    creatorId:prepared.creatorId,asOf:prepared.asOf,
    coverageStart:prepared.coverageStart,coverageEnd:prepared.coverageEnd,
    consumedVideoIds:prepared.consumedVideoIds,
    pendingTranscriptIds:prepared.pendingTranscriptIds,
    videos:prepared.sources.filter(s=>s.consumed),
    claims:prepared.claims,
    thesisChanges:prepared.thesisChanges,
    outputShape:{
      headline:"string",centralTension:"string",
      acts:[{title:"string",body:"string",claimIds:["claim_id"],videoIds:["video_id"]}],
      learningMoments:[{question:"string",explanation:"string",claimIds:["claim_id"]}],
      latestCreatorView:"string",latestClaimId:"claim_id",
      watchpoints:[{question:"string",claimIds:["claim_id"]}],
      limitations:"string",
    },
  });
}

const numbers=(text:string)=>new Set(
  (text.match(/\b\d+(?:[.,]\d+)*%?\b/g)||[]).map(s=>s.replaceAll(",",""))
);

/**
 * Fail closed on unknown citations and unsupported numeric magnitudes.
 * The returned ledger is reconstructed from validated inputs, not model claims.
 * Content still needs human editorial/independent source checks.
 */
export function parseCreatorStoryDraft(raw:unknown,prepared:PreparedCreatorStory):CreatorStoryDraft|null {
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
  const r=raw as Record<string,unknown>;
  // A response must not be able to relabel incomplete videos as consumed,
  // or suppress a video from the immutable source ledger.
  if(!sameSet(prepared.sources.map(s=>s.videoId),prepared.inputVideoIds) ||
     !sameSet(prepared.sources.filter(s=>s.consumed).map(s=>s.videoId),prepared.consumedVideoIds) ||
     !sameSet(prepared.sources.filter(s=>!s.consumed).map(s=>s.videoId),prepared.pendingTranscriptIds) ||
     prepared.claims.some(c=>!prepared.consumedVideoIds.includes(c.videoId)))return null;
  if(!validText(r.headline,12,120)||!validText(r.centralTension,35,500)||
     !validText(r.latestCreatorView,45,1200)||!validText(r.limitations,30,900)||
     !validId(r.latestClaimId))return null;
  const claimed=new Map(prepared.claims.map(c=>[c.claimId,c]));
  const latest=prepared.claims[prepared.claims.length-1];
  // Latest documented assertion must be the ending, never a manufactured update.
  if(r.latestClaimId!==latest.claimId)return null;
  if(!Array.isArray(r.acts)||r.acts.length<1||r.acts.length>6||
    !Array.isArray(r.learningMoments)||r.learningMoments.length>3||
    !Array.isArray(r.watchpoints)||r.watchpoints.length>8)return null;
  const checkClaims=(ids:unknown): ids is string[] =>
    Array.isArray(ids)&&ids.length>=1&&ids.length<=10&&
    new Set(ids).size===ids.length&&ids.every(x=>typeof x==="string"&&claimed.has(x));
  const acts: CreatorStoryModelOutput["acts"]=[];
  const covered=new Set<string>();
  for(const item of r.acts){
    if(!item||typeof item!=="object"||Array.isArray(item))return null;
    const a=item as Record<string,unknown>;
    if(!validText(a.title,6,110)||!validText(a.body,80,2400)||
      !checkClaims(a.claimIds)||!Array.isArray(a.videoIds))return null;
    const videoIds=[...new Set(a.claimIds.map(id=>claimed.get(id)!.videoId))];
    if(!sameSet(a.videoIds,videoIds))return null;
    a.claimIds.forEach(id=>covered.add(id));
    acts.push({title:a.title,body:a.body,claimIds:a.claimIds,videoIds});
  }
  if(!covered.has(latest.claimId))return null;
  const moments: CreatorStoryModelOutput["learningMoments"]=[];
  for(const item of r.learningMoments){
    if(!item||typeof item!=="object"||Array.isArray(item))return null;
    const m=item as Record<string,unknown>;
    if(!validText(m.question,12,180)||!validText(m.explanation,40,700)||!checkClaims(m.claimIds))return null;
    moments.push({question:m.question,explanation:m.explanation,claimIds:m.claimIds});
  }
  const watchpoints: CreatorStoryModelOutput["watchpoints"]=[];
  for(const item of r.watchpoints){
    if(!item||typeof item!=="object"||Array.isArray(item))return null;
    const w=item as Record<string,unknown>;
    if(!validText(w.question,15,300)||!checkClaims(w.claimIds))return null;
    watchpoints.push({question:w.question,claimIds:w.claimIds});
  }
  const allowed=numbers([
    prepared.asOf,prepared.coverageStart,prepared.coverageEnd,
    ...prepared.claims.map(c=>c.assertion+" "+c.transcriptExcerpt),
  ].join(" "));
  const prose=[
    r.headline,r.centralTension,r.latestCreatorView,r.limitations,
    ...acts.flatMap(a=>[a.title.replace(/^Act [1-6]\s*[—:\-]?\s*/i,""),a.body]),
    ...moments.flatMap(m=>[m.question,m.explanation]),
    ...watchpoints.map(w=>w.question),
  ].join(" ");
  if([...numbers(prose)].some(n=>!allowed.has(n)))return null;
  return {
    surface:"Bluebelly",section:"Creator Intelligence / Creator Summary",
    visibility:"owner",status:"draft",
    editorialStandard:CREATOR_STORY_EDITORIAL_STANDARD,
    creatorId:prepared.creatorId,asOf:prepared.asOf,
    previousEditionId:prepared.previousEditionId,
    coverageStart:prepared.coverageStart,coverageEnd:prepared.coverageEnd,
    inputVideoIds:[...prepared.inputVideoIds],
    consumedVideoIds:[...prepared.consumedVideoIds],
    pendingTranscriptIds:[...prepared.pendingTranscriptIds],
    sourceLedger:prepared.sources.map(s=>({...s})),
    claimLedger:prepared.claims.map(c=>({...c})),
    thesisChanges:prepared.thesisChanges.map(x=>({...x})),
    verificationStatus:"creator_attributed_unverified",
    headline:r.headline,centralTension:r.centralTension,acts,
    learningMoments:moments,latestCreatorView:r.latestCreatorView,
    latestClaimId:r.latestClaimId,watchpoints,
    limitations:r.limitations,
  };
}
