import { notFound } from "next/navigation";

import LiveDeskShell from "@/components/live-desk/LiveDeskShell";
import RegimeDetailWorkspace from "@/components/live-desk/RegimeDetailWorkspace";
import { getDeskData } from "@/lib/data";
import { getDossierV2PresentationSelection } from "@/lib/dossier-v2/presentation-reader";
import { getStoryRecordLayer } from "@/lib/persistence/read";
import { getRegimeExplanation } from "@/lib/regime-explanations";
import { routeDossierInvestigations } from "@/lib/regime-investigations";
import { getRegimeLiveReasoning } from "@/lib/regime-live-reasoning";
import { buildRegimeProjection, getRegimeDefinition } from "@/lib/regimes";

export const dynamic = "force-dynamic";

type RegimePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegimePage({ params, searchParams }: RegimePageProps) {
  const [{ slug }, query, data, recordLayer, dossierSelection] = await Promise.all([
    params,
    searchParams,
    getDeskData(),
    getStoryRecordLayer(),
    getDossierV2PresentationSelection(),
  ]);

  if (!getRegimeDefinition(slug)) notFound();

  const regime = buildRegimeProjection({
    stories: data.stories,
    events: recordLayer.events,
    versions: recordLayer.thesisVersions,
    newsThreads: data.newsThreads,
    statements: data.statements,
    dossier: dossierSelection.presentation,
  }).find((item) => item.slug === slug);

  if (!regime) notFound();

  const subgroup = typeof query.subgroup === "string" ? query.subgroup : null;
  const initialView = query.view === "live" ? "live" : "understand";
  const explanation = getRegimeExplanation(regime.slug);
  const liveReasoning = await getRegimeLiveReasoning(regime.durableStories.map((story) => story.id));
  const investigations = routeDossierInvestigations(dossierSelection.presentation?.watchNext ?? [])
    .filter((item) => item.regimeRoutes.some((route) => route.regime === regime.slug));

  return (
    <LiveDeskShell
      activePath="/regimes"
      title={regime.shortTitle}
      description="Understand the causal mechanism, then inspect the live subgroup telemetry, current Stories and the evidence/news nodes contributing to the state."
      meta={`${regime.durableStories.length} durable · ${regime.contextStories.length} context · ${regime.state}`}
    >
      <RegimeDetailWorkspace
        regime={regime}
        initialSubgroup={subgroup}
        initialView={initialView}
        explanation={explanation}
        liveReasoning={liveReasoning}
        investigations={investigations}
      />
    </LiveDeskShell>
  );
}
