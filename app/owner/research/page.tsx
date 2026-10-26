import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import ResearchLibraryExplorer from "@/components/blue-desk/ResearchLibraryExplorer";
import { fetchTodayNotionResearch } from "@/lib/notion-market-research";
import desk from "@/app/blue-desk/blue-desk.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Research Library | Blue Desk",
  description: "Private source-linked market research archive, topic map and research gaps.",
};

/** Never expose this route via the public Bluebelly allowlist.
 * Middleware enforces private-host owner auth; the Notion reader is owner-only.
 * No canonical Dossier writes, source promotion or research scheduling here.
 */
export default async function OwnerResearchLibraryPage() {
  const intake = await fetchTodayNotionResearch().catch(() => ({
    status: "UNAVAILABLE" as const,
    sources: [],
    warnings: ["Research source retrieval failed; the archive links remain available."],
    fetchedAt: new Date().toISOString(),
  }));
  return (
    <main className={desk.page} data-owner-research-library="private-read-only">
      <BlueDeskHeader activePath="/owner/research" />
      <ResearchLibraryExplorer intake={intake} />
    </main>
  );
}
