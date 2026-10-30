import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import LearnOriginalPptxViewer from "@/components/blue-desk/LearnOriginalPptxViewer";
import { getConcept } from "@/lib/concepts";
import { LEARN_GLOSSARY_ADDITIONS } from "@/lib/bluebelly-learn-glossary";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { BLUEBELLY_LEARN_DECKS, getBluebellyLearnDeck } from "@/lib/bluebelly-learn-decks";
import desk from "../../../blue-desk.module.css";
import ui from "../../learn.module.css";

export const dynamicParams = false;
export function generateStaticParams() {
  return BLUEBELLY_LEARN_DECKS.map((deck) => ({ id: deck.id.toLowerCase() }));
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const record = getBluebellyLearnDeck(id);
  return {
    title: record ? record.meta.title + " | Bluebelly Learn" : "Lesson not found",
    description: record?.meta.summary,
  };
}
export default async function BluebellyLearnDeckPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = getBluebellyLearnDeck(id);
  if (!record) notFound();
  const host = (await headers()).get("host");
  const back = blueDeskPublicHref("/blue-desk/learn", host);
  const verifiedConcepts = record.meta.concepts
    .map((name) => getConcept(name) || LEARN_GLOSSARY_ADDITIONS.find((concept) =>
      [concept.key, concept.label, ...concept.aliases].some((label) => label.toLowerCase() === name.toLowerCase())))
    .filter((concept): concept is NonNullable<typeof concept> => Boolean(concept))
    .filter((concept, index, entries) => entries.findIndex((other) => other.key === concept.key) === index);

  return <main className={desk.page} data-bluebelly-learn-deck={record.meta.id}>
    <BlueDeskHeader activePath="/blue-desk/learn" />
    <div className={ui.content}>
      <p className={ui.breadcrumb}><Link href={back}>Learn library</Link> / {record.meta.course} / {record.meta.id}</p>
      <header className={ui.deckHero}>
        <span>{record.meta.track} · {record.meta.level} · {record.meta.slideCount} slides · edition 30 Oct 2026</span>
        <h1>{record.meta.title}</h1>
        <p>{record.meta.summary}</p>
      </header>
      <LearnOriginalPptxViewer deckId={record.meta.id} title={record.meta.title} />
      <section className={ui.lessonSources} aria-labelledby="learn-source-title">
        <h2 id="learn-source-title">Read the underlying sources</h2>
        <p>These external originals explain the mechanisms. Linking to them does not grant republication or automated ingestion rights.</p>
        <ul>{record.meta.sources.map((source) =>
          <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></li>)}
        </ul>
      </section>
      {verifiedConcepts.length > 0 ? <section className={ui.lessonSources} aria-labelledby="learn-glossary-title">
        <h2 id="learn-glossary-title">Connected glossary terms</h2>
        <div className={ui.glossaryLinks}>{verifiedConcepts.map((concept) =>
          <Link key={concept.key} href={back + "#" + concept.key}>{concept.label}</Link>)}
        </div>
      </section> : null}
      <p className={ui.footnote}>Bluebelly Learn is educational. None of these slides are a market forecast or an executable trade instruction. Current events require dated, independent evidence.</p>
      <p><Link href={back}>Return to all courses and glossary</Link></p>
    </div>
  </main>;
}
