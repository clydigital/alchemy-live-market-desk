import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import Link from "next/link";
import { headers } from "next/headers";
import BlueDeskLearnExplorer from "@/components/blue-desk/BlueDeskLearnExplorer";
import { BLUEBELLY_LEARN_DECKS } from "@/lib/bluebelly-learn-decks";
import { assembleLearnGlossary } from "@/lib/bluebelly-learn-glossary";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { listConcepts } from "@/lib/concepts";
import { getRegimeDefinition } from "@/lib/regimes";
import desk from "../blue-desk.module.css";
import ui from "./learn.module.css";

export const metadata = {
  title: "Learn Market Mechanics | Bluebelly",
  description: "Nine original market lessons and a searchable expanded glossary of bonds, macro, companies, commodities, currencies and trading risk.",
};

export default async function BlueDeskLearnPage() {
  const host = (await headers()).get("host");
  // Governed Regime concepts remain unchanged; additional standalone Learn
  // definitions are educational only and do not feed research/evidence paths.
  const concepts = assembleLearnGlossary(listConcepts().filter((concept)=>concept.status==="active"))
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
              <a href="#courses">EXPLORE LESSON FILES <span aria-hidden="true">↗</span></a>
              <a href="#glossary">OPEN THE GLOSSARY <span aria-hidden="true">↗</span></a>
            </nav>
          </div>
          <div className={ui.heroDiagram} aria-hidden="true">
            <span className={ui.diagramTop}>// EDUCATION PROTOCOL</span>
            <div className={ui.orbitOuter}><div className={ui.orbitInner}>BB<span>/</span>LEARN</div></div>
            <span className={ui.diagramBottom}>READ. DECODE. VERIFY.</span>
            <div className={ui.diagramIndex}>001—009</div>
          </div>
        </header>
        <div className={ui.learningStrip} aria-label="Learning library highlights">
          <div><span>01 / COURSES</span><strong>09</strong><small>ORIGINAL LESSON FILES</small></div>
          <div><span>02 / CONTENT</span><strong>152</strong><small>SLIDES IN WEB-TEXT FORM</small></div>
          <div><span>03 / REFERENCE</span><strong>{concepts.length}</strong><small>EXPLAINED MARKET TERMS</small></div>
          <p>Start with the basics, follow the mechanism and use the glossary when a market term stops making sense.</p>
        </div>

        <section className={ui.deckLibrary} id="courses" aria-labelledby="bluebelly-deck-library-title">
          <div className={ui.deckLibraryHeader}>
            <div>
              <p className={ui.eyebrow}>01 / THE LEARNING ARCHIVE</p>
              <h2 id="bluebelly-deck-library-title">Pick a lesson. Follow the story.</h2>
              <p>Three tracks, nine original presentations. Each file walks through a real market mechanism with worked, hypothetical numbers and source reading.</p>
            </div>
            <span>09 MODULES / 03 TRACKS</span>
          </div>
          <div className={ui.trackRail} aria-label="Available learning tracks">
            <div><span>01</span><strong>MACRO FOUNDATIONS</strong><small>Bonds, inflation, central banks</small></div>
            <div><span>02</span><strong>CROSS-ASSET MECHANICS</strong><small>Oil, FX and AI economics</small></div>
            <div><span>03</span><strong>TRADING &amp; RISK</strong><small>Position sizing and chart behaviour</small></div>
          </div>
          <div className={ui.deckCards}>
            {BLUEBELLY_LEARN_DECKS.map((deck,index)=><article className={ui.deckCard} key={deck.id}>
              <div className={ui.deckHead}>
                <span className={ui.deckNumber}>{String(index+1).padStart(2,"0")}</span>
                <span className={ui.deckGlyph} aria-hidden="true">{deck.track==="Macro foundations"?"◈":deck.track==="Cross-asset mechanics"?"⌁":"⟁"}</span>
              </div>
              <p className={ui.deckEyebrow}>{deck.id} / {deck.track}</p>
              <h3>{deck.title}</h3>
              <p>{deck.summary}</p>
              <div className={ui.deckCardFooter}>
                <span>{deck.slideCount} SLIDES · {deck.level.toUpperCase()}</span>
                <Link href={blueDeskPublicHref("/blue-desk/learn/decks/"+deck.id.toLowerCase(),host)}>
                  OPEN FILE <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </article>)}
          </div>
          <p className={ui.footnote}>Original author-created educational slide content, adapted for accessible web reading. The original artwork is not hosted here. Historical and hypothetical examples are not live signals.</p>
        </section>

        <section className={ui.glossarySection} id="glossary" aria-labelledby="glossary-heading">
          <div className={ui.glossaryIntro}>
            <div>
              <p className={ui.eyebrow}>02 / THE MARKET REFERENCE TERMINAL</p>
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
