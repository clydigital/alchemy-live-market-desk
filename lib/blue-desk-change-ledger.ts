/**
 * Pure, owner-only read model of previously published Dossier judgements.
 * Never calculates its own regime transition, infers a cause from prices, or
 * edits a canonical Story/Thesis. The read is anchored to one exact vintage.
 */
import type { DossierPresentationV1 } from "./dossier-v2/presentation-adapter.ts";

export const BLUEBERRY_CHANGE_LEDGER_VERSION = "blueberry-change-ledger/1" as const;
type LedgerEntry = { key:string; title:string; detail:string; evidenceCount:number; state:string };
const clean = (s: string | null | undefined, max=420) => (s||"").trim().slice(0,max);

export function buildBlueberryChangeLedger(d: DossierPresentationV1 | null) {
  if (!d) return {
    contractVersion:BLUEBERRY_CHANGE_LEDGER_VERSION,
    status:"UNAVAILABLE" as const, asOf:null, dossierId:null,
    previousId:null, regime:null, thesis:[] as LedgerEntry[], reaction:[] as LedgerEntry[],
    blocked:[] as string[], summary:null,
  };
  const changes:LedgerEntry[] = d.thesisChanges.slice(0,10).map(item=>({
    key:item.thesisId, title:clean(item.title,180),
    detail:clean(item.reason), evidenceCount:item.evidenceRefs.length,
    state:item.change==="new"?"NEW_THESIS":item.change==="state_changed"?"STATE_CHANGED":"VERSION_CHANGED",
  }));
  const reaction:LedgerEntry[] = d.watchNext
    .filter(item=>["MATERIAL","PARTIAL","UNRESOLVED"].includes(item.divergence))
    .slice(0,8).map(item=>({
      key:item.id, title:clean(item.question,180),
      detail:clean(item.observedReaction || item.researchNext),
      evidenceCount:item.evidenceRefs.length, state:item.divergence,
    }));
  const blocked = d.health.researchGaps.filter(g=>g.severity==="MATERIAL")
    .map(g=>clean(g.description)).filter(Boolean);
  const decision = d.decisionPacket;
  const regime = decision?.regimeImpact ?? null;
  return {
    contractVersion:BLUEBERRY_CHANGE_LEDGER_VERSION,
    status:d.health.degraded?"DEGRADED" as const:"READY" as const,
    asOf:d.asOf, dossierId:d.dossierId,
    previousId:d.previousDossierId,
    regime:regime ? { prior:regime.previous,current:regime.current,
      changed:regime.changed }:null,
    thesis:changes,reaction,blocked,
    summary:clean(decision?.whatChanged || d.header.answer,700),
  };
}
