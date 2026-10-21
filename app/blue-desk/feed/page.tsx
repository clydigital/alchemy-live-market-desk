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
  const feed = {
    ...publication.body,
    connected: publication.body.source === "alchemy-live-market-desk",
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
