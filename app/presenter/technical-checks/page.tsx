import LiveDeskShell from "@/components/live-desk/LiveDeskShell";
import PresenterTechnicalChecks from "@/components/live-desk/PresenterTechnicalChecks";
export const dynamic = "force-dynamic";
export default async function TechnicalChecksPage({ searchParams }: { searchParams: Promise<{ embed?: string }> }) {
  const query = await searchParams;
  if (query.embed === "1") return <main style={{ margin: 0, padding: 10 }}><PresenterTechnicalChecks compact /></main>;
  return <LiveDeskShell activePath="/presenter/technical-checks"
    eyebrow="Presenter workspace · manual"
    title="Technical × Fundamentals"
    description="Track your technical readings, date each change and compare them with sourced macro fundamentals.">
      <PresenterTechnicalChecks />
    </LiveDeskShell>;
}
