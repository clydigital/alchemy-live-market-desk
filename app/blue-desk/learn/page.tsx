import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import BlueDeskLearnExplorer from "@/components/blue-desk/BlueDeskLearnExplorer";
import { listConcepts } from "@/lib/concepts";
import { getRegimeDefinition } from "@/lib/regimes";
import desk from "../blue-desk.module.css";
import ui from "./learn.module.css";

export const metadata = {
  title: "Market Glossary | Bluebelly",
  description: "Plain-English definitions, why they matter, and what to check across rates, AI, energy and markets.",
};

export default function BlueDeskLearnPage() {
  // Reuse the governed public Concept registry. No owner research, Dossier,
  // creator transcript or unverified market measurements are read here.
  const concepts = listConcepts()
    .filter((concept) => concept.status === "active")
    .map((concept) => ({
      key: concept.key,
      label: concept.label,
      definition: concept.definition,
      whyItMatters: concept.whyItMatters,
      watch: concept.watch,
      aliases: concept.aliases,
      regimes: concept.regimes.map((slug) => ({
        slug,
        label: getRegimeDefinition(slug)?.shortTitle || slug,
      })),
    }));
  return (
    <main className={desk.page} data-bluebelly-learn="public-governed-glossary">
      <BlueDeskHeader activePath="/blue-desk/learn" />
      <div className={ui.content}>
        <header className={ui.hero}>
          <p className={ui.eyebrow}>BLUEBELLY / LEARN</p>
          <h1>Market glossary</h1>
          <p>Understand the terms behind the headlines. Start with a plain-English
            definition, see why it affects markets, then learn which observations
            can test the idea.</p>
          <p className={ui.caution}>These are evergreen explanations, not live signals or trading recommendations.</p>
        </header>
        <BlueDeskLearnExplorer concepts={concepts} />
      </div>
    </main>
  );
}
