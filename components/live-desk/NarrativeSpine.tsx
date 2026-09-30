import Link from "next/link";

import type { DossierPresentationV1 } from "@/lib/dossier-v2/presentation-adapter";
import type { ProjectedRegime } from "@/lib/regimes";

import styles from "./narrative-spine.module.css";

type Props = {
  dossier: DossierPresentationV1;
  regimes?: ProjectedRegime[];
  surface?: "live" | "dossier";
};

type SpineStep = {
  number: string;
  label: string;
  title: string;
  detail: string;
  supporting?: string | null;
  state: "observed" | "supported" | "unresolved";
};

function findLens(dossier: DossierPresentationV1, key: string) {
  return dossier.regimeStrip.find((lens) => lens.key === key) || null;
}

function epistemicState(value: string | null | undefined): SpineStep["state"] {
  if (!value) return "unresolved";
  if (/observed/i.test(value)) return "observed";
  if (/supported|high|medium|hawkish|dovish|mixed/i.test(value)) return "supported";
  return "unresolved";
}

export default function NarrativeSpine({
  dossier,
  regimes = [],
  surface = "live",
}: Props) {
  const leadStory = dossier.whatMattersNow.stories[0] || null;
  const energyLens = findLens(dossier, "OIL_WAR_INFLATION");
  const fxLens = findLens(dossier, "USD");
  const breadthLens = findLens(dossier, "BREADTH");
  const primaryInvestigation = dossier.watchNext[0] || null;
  const globalRates = regimes.find((regime) => regime.slug === "global-cost-of-capital") || null;
  const globalRatesBranch = globalRates?.subgroups.find((group) => group.key === "global-rates") || null;
  const fxResearch = dossier.researchNow.find((item) =>
    /jgb|japan|yen|usd.?jpy|global.duration|foreign sovereign|bund|gilt/i.test(
      `${item.action} ${item.reason} ${item.expected_information_gain}`,
    ),
  ) || null;

  const steps: SpineStep[] = [
    {
      number: "01",
      label: "BASELINE",
      title: dossier.header.headline,
      detail: dossier.header.answer,
      supporting: dossier.header.regimeImplication,
      state: epistemicState(dossier.header.epistemicLabel),
    },
    {
      number: "02",
      label: "DOMINANT IMPULSE",
      title: leadStory?.title || "No major Story is carrying the current regime",
      detail: leadStory?.whatChanged || "The current Dossier has not promoted a new regime-changing Story.",
      supporting: leadStory?.mechanism || null,
      state: epistemicState(leadStory?.epistemicLabel),
    },
    {
      number: "03",
      label: "ENERGY / INFLATION",
      title: energyLens?.observed ? "Test whether the inflation impulse is fading or persisting" : "Energy transmission remains unresolved",
      detail: energyLens?.interpretation || "No evidence-backed energy/inflation lens is available in the current Dossier.",
      supporting: energyLens?.reaction || energyLens?.unresolvedSignals.join(" · ") || null,
      state: energyLens?.observed ? "observed" : "unresolved",
    },
    {
      number: "04",
      label: "GLOBAL RATES / FX",
      title: globalRatesBranch?.state
        ? `Japan / global-rates branch: ${globalRatesBranch.state}`
        : fxLens?.observed
          ? "Use FX to test whether rates pressure is becoming a broader dollar or yen story"
          : "Global-rates and FX confirmation still needs evidence",
      detail: globalRatesBranch?.nodes[0]?.detail
        || fxLens?.interpretation
        || "The desk should not infer a Japan/yen transmission channel until comparable JGB, UST and FX evidence is available.",
      supporting: fxResearch?.action || fxLens?.unresolvedSignals.join(" · ") || null,
      state: globalRatesBranch?.stateKind === "interpreted" || globalRatesBranch?.stateKind === "system1"
        ? "supported"
        : fxLens?.observed
          ? "observed"
          : "unresolved",
    },
    {
      number: "05",
      label: "RISK TRANSMISSION",
      title: breadthLens?.observed ? "Check whether duration stress is spreading beneath the indices" : "Risk transmission is not fully confirmed",
      detail: breadthLens?.interpretation
        || "Breadth, credit and volatility must confirm whether higher yields are becoming broad market stress.",
      supporting: breadthLens?.reaction || breadthLens?.unresolvedSignals.join(" · ") || null,
      state: breadthLens?.observed ? "observed" : "unresolved",
    },
    {
      number: "06",
      label: "DIVERGENCE / NEXT TEST",
      title: primaryInvestigation?.question || "No priority divergence is currently promoted",
      detail: primaryInvestigation
        ? `Expected: ${primaryInvestigation.expectedReaction || "not preserved"} Actual: ${primaryInvestigation.observedReaction || "not yet measured"}`
        : "The current Dossier has no promoted expected-versus-actual investigation.",
      supporting: primaryInvestigation?.researchNext || dossier.header.whatWouldChangeMind,
      state: primaryInvestigation?.divergence === "NONE"
        ? "observed"
        : primaryInvestigation?.divergence === "PARTIAL" || primaryInvestigation?.divergence === "MATERIAL"
          ? "supported"
          : "unresolved",
    },
  ];

  return (
    <section className={styles.section} data-surface={surface}>
      <header className={styles.header}>
        <div>
          <span>MARKET NARRATIVE SPINE</span>
          <h2>How the current regime fits together</h2>
          <p>Read left to right: baseline → impulse → inflation → global rates / FX → risk transmission → next test.</p>
        </div>
        {surface === "live" ? <Link href="/dossier">Open full Dossier →</Link> : null}
      </header>

      <div className={styles.rail}>
        {steps.map((step) => (
          <article className={styles.step} data-state={step.state} key={step.number}>
            <div className={styles.stepHead}>
              <b>{step.number}</b>
              <span>{step.label}</span>
            </div>
            <h3>{step.title}</h3>
            <p>{step.detail}</p>
            {step.supporting ? <small>{step.supporting}</small> : null}
          </article>
        ))}
      </div>

      <footer className={styles.footer}>
        <div>
          <span>CURRENT VERDICT</span>
          <strong>{dossier.header.regimeImplication}</strong>
        </div>
        <div>
          <span>CHANGE THE VIEW</span>
          <strong>{dossier.header.whatWouldChangeMind}</strong>
        </div>
      </footer>
    </section>
  );
}
