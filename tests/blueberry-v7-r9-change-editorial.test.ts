import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { blueDeskHostAccess } from "../lib/blue-desk-host.ts";
import { checkLyPresenterDraft } from "../lib/presenter-ly-writing-qc.ts";
import { buildBlueberryChangeLedger } from "../lib/blue-desk-change-ledger.ts";
import { buildPresenterEditorialLanes } from "../lib/presenter-cotd-ob-lanes.ts";
import type { DossierPresentationV1 } from "../lib/dossier-v2/presentation-adapter.ts";
import type { PrepEditorialReadiness } from "../lib/presenter-prep-editorial-readiness.ts";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const old="11111111-1111-4111-8111-111111111111",now="22222222-2222-4222-8222-222222222222";
const edition="33333333-3333-4333-8333-333333333333";
const dossier={
 dossierId:now,previousDossierId:old,asOf:"2026-10-22T16:00:00Z",
 header:{headline:"Rates and oil test equity risk",answer:"Some markets remain mixed.",regimeImplication:"Conditional",whatWouldChangeMind:"Confirmed breadth recovery"},
 health:{degraded:true,researchGaps:[{id:"gap-rates",category:"DATA",severity:"MATERIAL",description:"Missing intraday yields"}]},
 decisionPacket:{whatChanged:"The last analysis changed duration risk.",regimeImpact:{previous:"RATES_LED_TIGHTENING",current:"RATES_LED_TIGHTENING",changed:false}},
 thesisChanges:[{thesisId:"thesis-1",title:"Oil demand stress",reason:"Verified cash-market tension",change:"version_changed",evidenceRefs:[old]}],
 watchNext:[{id:"investigation-1",question:"Does oil pressure yields?",divergence:"UNRESOLVED",observedReaction:null,researchNext:"Check 2Y reaction",evidenceRefs:[]}],
 whatMattersNow:{stories:[{id:"s",title:"Oil and supply",whatChanged:"Reported stress",whyItMatters:"Conditional pressure",epistemicLabel:"MIXED",evidenceRefs:[old]}]},
} as unknown as DossierPresentationV1;

test("Change Ledger replaces primary Hybrid Feed nav, retaining legacy feed route",()=>{
 const h=read("components/blue-desk/BlueDeskHeader.tsx");
 assert.match(h,/\["Change Ledger", "\/blue-desk\/changes"\]/);
 const privateNav=h.slice(h.indexOf("const PRIVATE_NAV"),h.indexOf("const PUBLIC_NAV"));
 assert.doesNotMatch(privateNav,/Hybrid Feed/);
 const publicNav=h.slice(h.indexOf("const PUBLIC_NAV"),h.indexOf("const NAV_ICONS"));
 assert.doesNotMatch(publicNav,/Change Ledger|dossier|\/blue-desk\/presenter|Hybrid Feed/);
 assert.match(read("app/blue-desk/page.tsx"),/href="\/blue-desk\/changes"/);
 assert.match(read("app/blue-desk/presenter/page.tsx"),/COTD \/ OB editorial preview/);
 assert.match(read("app/blue-desk/feed/page.tsx"),/export|import/);
});
test("Change Ledger is owner only and never invents a state change",()=>{
 const p=read("app/blue-desk/changes/page.tsx");
 assert.match(p,/if\(isBlueDeskPublicReaderHost\(host\)&&!bluebelly\)notFound\(\)/);
 assert.match(p,/getDossierV2PresentationSelectionById\(id\)/);
 assert.match(p,/isValidUuid\(id\)/);
 assert.doesNotMatch(p,/\.upsert\(|\.insert\(|createSupabaseAdminClient\(/);
 for(const host of ["bluebelly-desk.vercel.app","alchemy-live-market-desk.vercel.app"])
   assert.notEqual(blueDeskHostAccess("/blue-desk/changes",host),"public");
 const model=buildBlueberryChangeLedger(dossier);
 assert.equal(model.status,"DEGRADED");
 assert.equal(model.previousId,old);
 assert.equal(model.regime?.changed,false);
 assert.equal(model.thesis.length,1);
 assert.equal(model.reaction[0]?.state,"UNRESOLVED");
 assert.deepEqual(model.blocked,["Missing intraday yields"]);
 assert.equal(buildBlueberryChangeLedger(null).status,"UNAVAILABLE");
});
test("COTD/OB source packs never imply publication approval or use mismatched editions",()=>{
 const editorial:PrepEditorialReadiness={
  contractVersion:"presenter-prep-editorial-read/1",status:"HAS_EDITORIAL",selectedEditionId:edition,
  items:[{kind:"FULL_ARTICLE",storyId:"s",headline:"Oil Tension",asOf:"2026-10-22T16:00:00Z",materialChangeAt:null,
    reporting:[{text:"Original report",sourceName:"Source",sourceUrl:"https://www.example.org/report",availableAt:"2026-10-22T15:00:00Z"}],
    implications:[{text:"Conditional implication",basis:"CONDITIONAL"}],gaps:["Check chart"],marketReaction:"NOT_ESTABLISHED_BY_EDITORIAL"}]
 };
 const linked=buildPresenterEditorialLanes({editorial,dossier,exactDossierId:now,pinnedEditionId:edition});
 assert.deepEqual(linked.lanes.map(x=>x.kind),["COTD","OB"]);
 assert.equal(linked.lanes[0].state,"SOURCE_PACK_AVAILABLE");
 assert.ok(linked.lanes.every(x=>x.publishable===false&&x.checks.some(c=>!c.pass)));
 const broken=buildPresenterEditorialLanes({editorial,dossier,exactDossierId:old,pinnedEditionId:edition});
 assert.ok(broken.lanes.every(x=>x.state==="RESEARCH_NEEDED"&&x.snippets.length===0));
 const p=read("app/blue-desk/presenter/editorial/page.tsx");
 assert.match(p,/resolvePresenterPrepExactSelection\(/);
 assert.match(p,/getHybridDirectDailyBriefSuperseders\(requested\)/);
 assert.match(p,/buildPresenterPrepEditorialReadiness\(/);
 assert.match(p,/PresenterEditorialDraftEditor/);
 assert.doesNotMatch(p,/\.upsert\(|\.insert\(|createSupabaseAdminClient\(/);
});
test("LY COTD copy check measures length, title, meta, forbidden clichés and sources",()=>{
 const empty=checkLyPresenterDraft("COTD","","","");
 assert.equal(empty.words,0);
 assert.equal(empty.checks.find(x=>x.key==="body")?.pass,false);
 const body=Array(650).fill("word").join(" ")+"\n\nhttps://www.example.org/original";
 const full=checkLyPresenterDraft("COTD","Oil Tests US Rates",body,"Brent pressure and bonds.");
 assert.equal(full.checks.find(x=>x.key==="body")?.pass,true);
 assert.equal(full.checks.find(x=>x.key==="original-sources")?.pass,true);
 assert.equal(checkLyPresenterDraft("OB","Test","cleaner read","").checks.find(x=>x.key==="banned")?.pass,false);
});
