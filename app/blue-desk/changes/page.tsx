import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { isBluebellyReaderHost,isBlueDeskPublicReaderHost } from "@/lib/blue-desk-host";
import { getDossierV2PresentationSelection,getDossierV2PresentationSelectionById } from "@/lib/dossier-v2/presentation-reader";
import { isValidUuid } from "@/lib/dossier-v2/validation";
import { buildBlueberryChangeLedger } from "@/lib/blue-desk-change-ledger";
import { withinTimeout } from "@/lib/async-timeout";
import styles from "../blue-desk.module.css";
export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata={title:"What Changed | Blueberry",description:"Exact-version Dossier decisions and contradictory evidence."};
export default async function BlueberryChangesPage({searchParams}:{
  searchParams:Promise<Record<string,string|string[]|undefined>>;
}) {
  const host=(await headers()).get("host");
  const bluebelly=isBluebellyReaderHost(host);
  if(isBlueDeskPublicReaderHost(host)&&!bluebelly)notFound();
  const query=await searchParams;
  const raw=query.id;
  const id=typeof raw==="string"?raw:null;
  const valid=raw===undefined || (id!==null&&isValidUuid(id));
  const selection=valid
    ?await withinTimeout("Blueberry Change Ledger",
      ()=>id?getDossierV2PresentationSelectionById(id):getDossierV2PresentationSelection(),
      6500).catch(()=>null)
    :null;
  const result=buildBlueberryChangeLedger(selection?.presentation??null);
  const exact=Boolean(id);
  return <main className={styles.page} data-blueberry-change-ledger="canonical">
    <BlueDeskHeader activePath="/blue-desk/changes"/>
    <div className={styles.content}>
      <section className={styles.dailyMapHeading}>
        <div>
          <p className={styles.kicker}>PRIVATE · IMMUTABLE MARKET-REASONING CHANGES</p>
          <h1>What changed in our view?</h1>
          <p>Canonical thesis revisions, expected versus observed reactions and material gaps. No new probability engine or invented causal story.</p>
        </div>
        <Link className={styles.primaryAction} href={bluebelly?"/presenter/dossier":"/blue-desk/dossier"}>Dossier archive →</Link>
      </section>
      {result.status==="UNAVAILABLE" ? <section className={styles.secondaryPanel} role="status">
        <h2>{exact?"Requested historical ledger unavailable":"Canonical ledger unavailable"}</h2>
        <p>{valid?"No validated canonical Dossier available.": "Invalid or repeated Dossier ID."} No other edition was substituted.</p>
      </section> : <>
        <section className={styles.secondaryPanel} aria-label="Ledger edition identity">
          <p className={styles.kicker}>{exact?"EXACT ARCHIVED EDITION":"LATEST CANONICAL EDITION"} · {result.status}</p>
          <h2>{result.regime?.changed?"Regime changed":"Regime not confirmed to have changed"}</h2>
          <p>{result.regime
            ?String(result.regime.prior||"Unknown previous regime")+" → "+result.regime.current
            :"No independently verified regime comparison was included in the selected edition."}</p>
          <p>{result.summary}</p>
          <p className={styles.dossierNote}>Frozen Dossier <code>{result.dossierId}</code>
            {" · "}<DualTimestamp value={result.asOf!} sourceDate={result.asOf!}/>
          </p>
          {result.previousId?<Link href={(bluebelly?"/presenter/changes":"/blue-desk/changes")+"?id="+result.previousId}>Read previous Dossier's own ledger →</Link>:null}
        </section>
        <div className={styles.dailyMapGrid}>
          <section className={styles.secondaryPanel}>
            <h2>Thesis changes · {result.thesis.length}</h2>
            {result.thesis.length?result.thesis.map(item=><article key={item.key} className={styles.dossierGap}>
              <p className={styles.kicker}>{item.state} · {item.evidenceCount} canonical evidence references</p>
              <h3>{item.title}</h3><p>{item.detail||"No explanation was recorded for this change."}</p>
            </article>):<p>No published thesis revision was recorded in this exact edition. This is not a new bullish or bearish signal.</p>}
          </section>
          <section className={styles.secondaryPanel}>
            <h2>Unresolved market reactions · {result.reaction.length}</h2>
            {result.reaction.length?result.reaction.map(item=><article key={item.key} className={styles.dossierGap}>
              <p className={styles.kicker}>{item.state} · {item.evidenceCount} referenced items</p>
              <h3>{item.title}</h3><p>{item.detail||"No verifiable reaction recorded."}</p>
            </article>):<p>No material or unresolved reaction comparison was recorded here.</p>}
          </section>
        </div>
        <section className={styles.secondaryPanel}>
          <h2>Evidence that blocks stronger claims</h2>
          {result.blocked.length?result.blocked.map((message,i)=><p key={i}>{message}</p>)
            :<p>No MATERIAL research gap was recorded in this edition. This is not a guarantee that every claim is correct.</p>}
          <p className={styles.dossierNote}>Use the Dossier archive for source lineage; the ledger does not automatically accept Motion context or rewrite Story history.</p>
        </section>
      </>}
    </div>
  </main>;
}
