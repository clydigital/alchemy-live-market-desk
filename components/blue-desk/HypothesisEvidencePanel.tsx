import type {RegistryRead} from "@/lib/bluebelly-hypothesis-registry";
import styles from "./hypothesis-evidence.module.css";
import {assessArgumentQuality} from "@/lib/bluebelly-argument-quality";
const label=(s:string)=>s.replaceAll("_"," ").toLowerCase();
const age=(n:number|null)=>n===null?"unknown":n+"d";
function ArgumentQuality({quality:q}:{quality:ReturnType<typeof assessArgumentQuality>}){
 return <details className={styles.gem} data-argument-quality={q.status} open={q.status==="STALE_REVIEW"||q.status==="NO_MATCHED_DIRECTIONAL_GROUP"?true:undefined}>
 <summary><strong>Argument quality · {label(q.status)}</strong></summary>
 <p>{q.gemCount} saved gems → {q.groupCount} possible-dependence groups. {q.receiptBacked} dated retained gems have matched canonical receipts.</p>
 <p><strong>Directional coverage:</strong> {q.support} supporting · {q.challenge} challenging · {q.mixed} mixed groups. {q.modifiers} modifier-only · {q.unverified} without qualifying receipts.</p>
 <p className={styles.meta}>Review age: {age(q.reviewAgeDays)} · source ages: {age(q.newestSourceAgeDays)} to {age(q.oldestSourceAgeDays)} · undated: {q.undated}. Age is not a universal freshness verdict.</p>
 <p>Counterargument {q.counterargumentRecorded?"recorded":"not recorded"} · conditional mechanism {q.conditionalRecorded?"recorded":"not recorded"} · next test {q.nextTestRecorded?"recorded":"not recorded"}. Presence is not validation.</p>
 {q.groups.length?<ul>{q.groups.map(g=><li key={g.ids.join("|")}>{label(g.status)} · {g.labels.join(" / ")} · {g.receiptBacked} matched retained receipt(s)</li>)}</ul>:null}
 <p className={styles.meta}>Same normalized source URL or exact premise groups potential duplicates. Distinct groups are not proof of independent evidence. Causal relevance, economic magnitude, regime dependence and predictive performance remain unvalidated. No calculated probability or conviction upgrade.</p>
 </details>;
}
export default function HypothesisEvidencePanel({read}:{read:RegistryRead}){
 return <section id="hypothesis-evidence" data-hypothesis-evidence="private-registry-readonly" className={styles.panel} aria-labelledby="hypothesis-heading">
 <header><small>PRIVATE RESEARCH / COMPOSABLE HYPOTHESES</small><h2 id="hypothesis-heading">Hypotheses &amp; evidence gems</h2><p>Existing research questions, their latest saved conditional assessments and linked evidence. These are analyst interpretations, not automatically verified market facts or investment instructions.</p></header>
 <p className={styles.meta}>Registry {label(read.status)}{read.retrievedAt?" · retrieved "+read.retrievedAt.slice(0,16).replace("T"," ")+" UTC":""}{read.truncated?" · bounded selection, not complete registry":""}. Source dates and review dates are distinct from retrieval. Canonical receipt matching checks persistence and provenance, not independent corroboration or a SQL hypothesis–evidence link. Dossier references use exact receipt identities; a reference does not prove agreement with the private hypothesis.</p>
 {read.diagnostic?<p role="status" className={styles.meta}>{read.diagnostic}{/HTTP (403|404)/.test(read.diagnostic)?" · Share the existing private Research Gap Registry with the existing Vercel integration (Notion page menu → Connections). Do not enable public sharing.":""}</p>:null}
 {read.rows.length?<div className={styles.grid}>{read.rows.map(row=><article key={row.id} className={styles.card}>
 <div className={styles.meta}>{row.theme||"Research question"} · {label(row.state)} · {row.id}</div><h3>{row.title}</h3>
 <p><strong>Current read:</strong> {row.currentRead||"Not recorded"}</p><p><strong>Recorded confidence:</strong> {row.confidence?label(row.confidence):"Not recorded"}</p>{row.decisionImpact?<p><strong>Decision impact:</strong> {row.decisionImpact}</p>:null}
 {row.snapshot?<><p className={styles.meta}>Saved assessment {row.snapshot.reviewedOn}</p><p className={styles.logic}>{row.snapshot.conditional}</p><ArgumentQuality quality={assessArgumentQuality(row,read.retrievedAt)}/><div className={styles.gems}>{row.snapshot.gems.map(g=><div key={g.id} className={styles.gem}><small data-role={g.role}>{label(g.role)} · {label(g.state)}</small><strong>{g.label}</strong><p>{g.observation}</p><p className={styles.meta}>{g.premise}</p><a href={g.sourceUrl} target="_blank" rel="noopener noreferrer">Source · {g.sourceDate||"date unverified"} ↗</a><p className={styles.meta}>{g.canonicalReceipt?<>Canonical evidence receipt: {label(g.canonicalReceipt.status)}{g.canonicalReceipt.receivedAt?" · received "+g.canonicalReceipt.receivedAt:""} · {g.id}</>:"No canonical evidence UUID readback in this snapshot."}</p>{g.canonicalReceipt?.dossierReference?<p className={styles.meta}>Latest Dossier: {label(g.canonicalReceipt.dossierReference.status)}{g.canonicalReceipt.dossierReference.asOf?" · as of "+g.canonicalReceipt.dossierReference.asOf:""}{g.canonicalReceipt.dossierReference.dossierId?" · "+g.canonicalReceipt.dossierReference.dossierId:""}</p>:null}</div>)}</div><p><strong>Next discriminator:</strong> {row.snapshot.nextTest}</p></>:<p className={styles.meta}>Structured evidence snapshot unavailable or not aligned with the current registry read; inspect the original record.</p>}
 <p><strong>Registry next test:</strong> {row.nextTrigger||"Not recorded"}</p><p className={styles.meta}>Last source check recorded: {row.lastChecked||"unknown"}</p><a href={"https://www.notion.so/"+row.pageId} target="_blank" rel="noopener noreferrer">Open original hypothesis and history ↗</a>
 </article>)}</div>:<p role="status">No readable active hypothesis records in this bounded request. This does not indicate no active research.</p>}
 <a href="https://app.notion.com/p/f0eb01304c684dce95696f32671dc55a" target="_blank" rel="noopener noreferrer">Open complete Research Gap Registry ↗</a>
 </section>;
}
