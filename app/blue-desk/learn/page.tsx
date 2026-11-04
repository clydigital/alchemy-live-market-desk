import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import BlueDeskLearnExplorer from "@/components/blue-desk/BlueDeskLearnExplorer";
import { assembleLearnGlossary } from "@/lib/bluebelly-learn-glossary";
import { listConcepts } from "@/lib/concepts";
import { getRegimeDefinition } from "@/lib/regimes";
import desk from "../blue-desk.module.css";
import ui from "./learn.module.css";

export const metadata = {
  title: "Learn Market Fundamentals | Bluebelly",
  description: "Searchable explanations of company fundamentals, bonds, macro, valuation, commodities, currencies and trading risk.",
};

export default async function BlueDeskLearnPage() {
  // Governed Regime concepts remain unchanged; additional standalone Learn
  // definitions are educational only and do not feed research/evidence paths.
  const concepts = assembleLearnGlossary(listConcepts().filter((concept)=>concept.status === "active"))
    .map((concept)=>({
      ...concept,
      regimes: concept.regimes.map((slug)=>({
        slug,label:getRegimeDefinition(slug)?.shortTitle || slug,
      })),
    }));
  return (
    <main className={desk.page} data-bluebelly-learn="public-governed-glossary">
      <BlueDeskHeader activePath="/blue-desk/learn"/>
      <div className={ui.content}>
        <header className={ui.hero}>
          <div className={ui.heroContent}>
            <p className={ui.eyebrow}>BLUEBELLY / MARKET INTELLIGENCE FIELD MANUAL — 2026</p>
            <h1>Decode the <em>market.</em><br/>Understand the move.</h1>
            <p className={ui.heroLead}>No textbook fog. Learn what the numbers mean, how one market affects another and what to check before accepting the headline.</p>
            <nav className={ui.heroActions} aria-label="Learn page sections">
              <a href="#glossary">OPEN THE GLOSSARY <span aria-hidden="true">↗</span></a>
            </nav>
          </div>
          <div className={ui.heroDiagram} aria-hidden="true">
            <span className={ui.diagramTop}>// EDUCATION PROTOCOL</span>
            <div className={ui.orbitOuter}><div className={ui.orbitInner}>BB<span>/</span>LEARN</div></div>
            <span className={ui.diagramBottom}>READ. DECODE. VERIFY.</span>
            <div className={ui.diagramIndex}>REFERENCE</div>
          </div>
        </header>
        <section className={ui.glossarySection} id="glossary" aria-labelledby="glossary-heading">
          <div className={ui.glossaryIntro}>
            <div>
              <p className={ui.eyebrow}>01 / THE MARKET REFERENCE TERMINAL</p>
              <h2 id="glossary-heading">The language behind the price.</h2>
              <p>Not sure why yields rise when bond prices fall? Or why good earnings can send a stock lower? Search the mechanism, read a plain-English explanation and check a worked example where available.</p>
            </div>
            <div className={ui.glossaryCount} aria-label={concepts.length+" glossary definitions"}><strong>{concepts.length}</strong><span>TERMS / EXPANDED</span></div>
          </div>
          <BlueDeskLearnExplorer concepts={concepts}/>
        </section>
      </div>
    </main>
  );
}
