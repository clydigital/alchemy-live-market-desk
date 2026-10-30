import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import Link from "next/link";
import { headers } from "next/headers";
import BlueDeskLearnExplorer from "@/components/blue-desk/BlueDeskLearnExplorer";
import { BLUEBELLY_LEARN_DECKS } from "@/lib/bluebelly-learn-decks";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { listConcepts } from "@/lib/concepts";
import { getRegimeDefinition } from "@/lib/regimes";
import desk from "../blue-desk.module.css";
import ui from "./learn.module.css";

export const metadata = {
  title: "Market Education & Glossary | Bluebelly",
  description: "Nine original market education presentations with an accessible slide reader, official references and the governed Bluebelly glossary.",
};

export default async function BlueDeskLearnPage() {
  const host = (await headers()).get("host");
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
          <h1>Learn how markets actually work</h1>
          <p>Original lessons with worked numbers, source reading and practical questions. Browse presentations first, then explore the governed glossary below.</p>
          <p className={ui.caution}>Nine editorial web-text presentations · 152 slides · hypothetical examples, not live signals or trading recommendations.</p>
        </header>
        <section className={ui.deckLibrary} aria-labelledby="bluebelly-deck-library-title">
          <div className={ui.deckLibraryHeader}>
            <div>
              <p className={ui.eyebrow}>COURSES / READ &amp; EXPLORE</p>
              <h2 id="bluebelly-deck-library-title">Nine original presentations</h2>
              <p>Read through the slide-by-slide accessible edition. Source links and the existing market glossary connect each idea to its underlying mechanism.</p>
            </div>
            <span>152 SLIDES · 3 TRACKS</span>
          </div>
          <div className={ui.deckCards}>
            {BLUEBELLY_LEARN_DECKS.map((deck) => <article className={ui.deckCard} key={deck.id}>
              <p className={ui.deckEyebrow}>{deck.id} / {deck.track}</p>
              <h3>{deck.title}</h3>
              <p>{deck.summary}</p>
              <div className={ui.deckCardFooter}>
                <span>{deck.slideCount} slides · {deck.level}</span>
                <Link href={blueDeskPublicHref("/blue-desk/learn/decks/" + deck.id.toLowerCase(), host)}>
                  Read presentation <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>)}
          </div>
          <p className={ui.footnote}>These are text-adapted public editions of the original author-created slides. Original PDF/PPTX artwork and layout are not hosted in this reader. Historical educational examples do not represent live market data.</p>
        </section>
        <div className={ui.glossaryIntro}>
          <p className={ui.eyebrow}>REFERENCE / PUBLIC GOVERNED CONCEPTS</p>
          <h2>Market glossary</h2>
          <p>Definitions are drawn from Bluebelly’s existing governed concept registry, not a separate unreviewed vocabulary database.</p>
        </div>
        <BlueDeskLearnExplorer concepts={concepts} />
      </div>
    </main>
  );
}
