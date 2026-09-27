import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import RegimeBoard from "@/components/live-desk/RegimeBoard";
import { Badge, DataState, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";
import { getDossierV2PresentationSelection } from "@/lib/dossier-v2/presentation-reader";
import { getStoryRecordLayer } from "@/lib/persistence/read";
import { buildRegimeProjection } from "@/lib/regimes";

export const dynamic = "force-dynamic";

export default async function RegimesPage() {
  const [data, recordLayer, dossierSelection] = await Promise.all([
    getDeskData(),
    getStoryRecordLayer(),
    getDossierV2PresentationSelection(),
  ]);

  const regimes = buildRegimeProjection({
    stories: data.stories,
    events: recordLayer.events,
    versions: recordLayer.thesisVersions,
    newsThreads: data.newsThreads,
    statements: data.statements,
    dossier: dossierSelection.presentation,
  });

  const mappedStoryIds = new Set(regimes.flatMap((regime) => regime.stories.map((story) => story.id)));
  const pendingNodes = regimes.flatMap((regime) => regime.subgroups.flatMap((subgroup) => subgroup.nodes))
    .filter((node) => node.state === "interpretation_pending").length;
  const system1Subgroups = regimes.flatMap((regime) => regime.subgroups).filter((subgroup) => subgroup.telemetry.length).length;

  return (
    <LiveDeskShell
      activePath="/regimes"
      title="Market Regimes"
      description="The durable market environments behind today’s Stories: what matters, which driver is active, what changed, and how the pieces connect."
      meta={`${regimes.length} governed Regimes`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: regimes.length, label: "Governed Regimes" },
            { value: mappedStoryIds.size, label: "Mapped Stories" },
            { value: system1Subgroups, label: "System 1 subgroup sensors" },
            { value: pendingNodes, label: "Observed · interpretation pending" },
          ]}
        />

        <DataState
          state={recordLayer.available ? "ready" : "warn"}
          title="Read-only Regime projection"
          detail={recordLayer.available
            ? "Regimes are being projected from current immutable Story versions/events plus the existing deterministic Dossier rate and liquidity sensors. Raw headlines cannot directly rewrite a Regime."
            : "Regimes are available from current Stories, but immutable Story-event history is unavailable. The interface will not infer missing historical state."}
        />

        <Panel
          title="Regime board"
          description="Regimes are stable. Story headlines can change with accepted thesis versions; What’s New remains the dated delta layer. Open a Regime to inspect coloured drivers, System 1 telemetry and contributing news/evidence nodes."
          action={<Badge tone="ready">Production read model</Badge>}
        >
          <RegimeBoard regimes={regimes} />
        </Panel>
      </div>
    </LiveDeskShell>
  );
}
