import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import LiveDeskFeed from "@/components/blue-desk/hybrid-feed/LiveDeskFeed";
import { getCanonicalPublicationPayload } from "@/lib/intelligence/publication-feed-route";
import { getHybridFeedData } from "@/lib/intelligence/publication-feed-data";
import "./hybrid-feed.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Hybrid Feed | Blue Desk",
  description: "The existing Hybrid research, market state, calendar and earnings feed in the private Blue Desk shell.",
};

/**
 * Owner-only surface: reuses the actual Hybrid feed component, its four tabs,
 * source stylesheet and canonical Live feed instead of inventing a new layout.
 * Host middleware must never allow this path to public Bluebelly readers.
 */
export default async function BlueDeskHybridFeedPage() {
  const [publication, upstream] = await Promise.all([
    getCanonicalPublicationPayload(),
    getHybridFeedData(),
  ]);
  // Do not serialize the entire upstream research publication into a client
  // component. Preserve only the already established Hybrid /feed fields.
  const published = publication.body;
  const canonical = published.canonical && typeof published.canonical === "object"
    ? published.canonical as Record<string, unknown> : {};
  const research = published.research && typeof published.research === "object"
    ? published.research as Record<string, unknown> : {};
  const feed = {
    connected: published.source === "alchemy-live-market-desk",
    generatedAt: published.generatedAt,
    marketUpdatedAt: published.marketUpdatedAt,
    marketState: Array.isArray(published.marketState) ? published.marketState : [],
    calendar: Array.isArray(published.calendar) ? published.calendar : [],
    earnings: Array.isArray(published.earnings) ? published.earnings : [],
    accuracy: published.accuracy,
    materialDeltas: Array.isArray(published.materialDeltas) ? published.materialDeltas : [],
    canonical: { storyStates: Array.isArray(canonical.storyStates) ? canonical.storyStates : [] },
    research: { divergences: Array.isArray(research.divergences) ? research.divergences : [] },
  };
  const data = {
    stories: upstream.stories || [],
    updates: upstream.updates || [],
    newsThreads: [],
    macroObservations: upstream.macroObservations || [],
    marketObservations: upstream.marketObservations || [],
  };

  return (
    <main>
      <BlueDeskHeader activePath="/blue-desk/feed" />
      <div className="hybridFeedMount">
        <LiveDeskFeed feed={feed} data={data} initialTab="research" />
      </div>
    </main>
  );
}
