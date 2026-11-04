import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import BlueDeskLearnExplorer from "@/components/blue-desk/BlueDeskLearnExplorer";
import { assembleLearnGlossary } from "@/lib/bluebelly-learn-glossary";
import { BLUEBELLY_LEARN_RESOURCES } from "@/lib/bluebelly-learn-resources";
import { listConcepts } from "@/lib/concepts";
import { getRegimeDefinition } from "@/lib/regimes";
import desk from "../blue-desk.module.css";
import ui from "./learn.module.css";

export const metadata = {
  title: "Learn Market Fundamentals | Bluebelly",
  description: "Searchable explanations of company fundamentals, bonds, macro, valuation, commodities, currencies and trading risk.",
};

const LEARNING_TRACKS = [
  { id: "financials", title: "Understand the business", detail: "Financial statements, P/E, the balance sheet and cash conversion." },
  { id: "valuation", title: "Decide what it is worth", detail: "Intrinsic value, growth, valuation multiples and investment philosophies." },
  { id: "psychology", title: "Protect the trading account", detail: "Risk limits, trading behaviour and prop-trading psychology." },
] as const;

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
              <a href="#resources">LEARNING MATERIALS <span aria-hidden="true">↗</span></a>
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
        <section className={ui.deckLibrary} id="resources" aria-labelledby="learn-resources-heading">
          <header className={ui.deckLibraryHeader}>
            <div>
              <p className={ui.eyebrow}>01 / EXTERNAL LEARNING LIBRARY</p>
              <h2 id="learn-resources-heading">Read the documents. Learn the numbers.</h2>
              <p>Publisher-hosted PDF slides, PowerPoint lecture packets and practical courses. The nine older Bluebelly decks are no longer featured. Open original sources rather than reconstructed copies.</p>
            </div>
            <span>{BLUEBELLY_LEARN_RESOURCES.length} VERIFIED REFERENCES</span>
          </header>
          {LEARNING_TRACKS.map((track,index)=><div className={ui.sourceTrack} key={track.id}>
            <div className={ui.sourceTrackHeading}>
              <span>{String(index+1).padStart(2,"0")} / {track.title.toUpperCase()}</span>
              <p>{track.detail}</p>
            </div>
            <div className={ui.deckCards}>
              {BLUEBELLY_LEARN_RESOURCES.filter((resource)=>resource.track===track.id)
                .map((resource)=><article className={ui.deckCard} key={resource.id}>
                  <p className={ui.deckEyebrow}>{resource.publisher} · {resource.level}</p>
                  <h3>{resource.title}</h3>
                  <p>{resource.summary}</p>
                  <div className={ui.resourceTerms}>
                    {resource.concepts.map((key)=>{
                      const term=concepts.find((item)=>item.key===key);
                      return term ? <a href={"#"+term.key} key={key}>{term.label}</a> : null;
                    })}
                  </div>
                  <div className={ui.deckCardFooter}>
                    <span>{resource.format.toUpperCase()}</span>
                    <a href={resource.url} target="_blank" rel="noopener noreferrer">
                      OPEN ORIGINAL <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                </article>)}
            </div>
          </div>)}
          <p className={ui.footnote}>Materials are linked on their publishers' sites, not rehosted. Historical presentations explain methods, not current stock values. Some publisher PDF/PPTX download buttons may be access-restricted; the lecture index remains available.</p>
        </section>

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
