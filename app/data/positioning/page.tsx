import LiveDeskShell from "@/components/live-desk/LiveDeskShell";
import PositioningWorkspace from "@/components/live-desk/PositioningWorkspace";
import { getCotSnapshots } from "@/lib/cot";
import { getDeskData } from "@/lib/data";

export const dynamic = "force-dynamic";

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export default async function PositioningPage() {
  const [snapshots, data] = await Promise.all([getCotSnapshots(), getDeskData()]);
  const storyBySlug = new Map(data.stories.map((story) => [story.slug, story]));

  const storyLink = (slug: string) => {
    const story = storyBySlug.get(slug);
    return story ? { title: story.title, href: `/stories/${story.slug}` } : undefined;
  };

  const storyLinks = {
    "13874A": storyLink("market-breadth-health") || storyLink("earnings-market-support"),
    "209742": storyLink("ai-capex-cash-conversion") || storyLink("market-breadth-health"),
    "043602": storyLink("fed-long-end-stress") || storyLink("fed-rate-repricing"),
    "097741": storyLink("yen-carry-unwind"),
    "067651": storyLink("oil-physical-disruption"),
    "088691": storyLink("fed-long-end-stress"),
  };

  const latestReport = snapshots.map((snapshot) => snapshot.reportDate).filter(Boolean).sort().at(-1);

  return (
    <LiveDeskShell
      activePath="/data/positioning"
      title="Positioning"
      description="Official CFTC positioning with a raw Alchemy view and a clearly disclosed COTSignal-style 52-week scan."
      meta={latestReport ? `Latest report ${dateLabel(latestReport)}` : "CFTC feed updating"}
    >
      <PositioningWorkspace snapshots={snapshots} storyLinks={storyLinks} />
    </LiveDeskShell>
  );
}
