import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import RegimeBoard from "@/components/live-desk/RegimeBoard";
import { Badge, DataState, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";
import { getDossierV2PresentationSelection } from "@/lib/dossier-v2/presentation-reader";
import { getRegimeShadowHealth } from "@/lib/regime-engine";
import { getStoryRecordLayer } from "@/lib/persistence/read";
import { buildRegimeProjection } from "@/lib/regimes";

export const dynamic = "force-dynamic";

function formatAge(minutes: number | null) {
  if (minutes === null) return "age unavailable";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hr`;
  return `${Math.floor(hours / 24)} days`;
}

export default async function RegimesPage() {
  const [data, recordLayer, dossierSelection, shadowHealth] = await Promise.all([
    getDeskData(),
    getStoryRecordLayer(),
    getDossierV2PresentationSelection(),
    getRegimeShadowHealth(),
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
            { value: shadowHealth.currentProjectionCount, label: "Persisted shadow Regimes" },
            { value: shadowHealth.unassignedStoryCount, label: "Unassigned active Stories" },
            { value: shadowHealth.quarantinedStoryCount, label: "Domain-quarantined Stories" },
          ]}
        />

        <DataState
          state={recordLayer.available ? "ready" : "warn"}
          title="Read-only Regime projection"
          detail={recordLayer.available
            ? "Regimes are being projected from current immutable Story versions/events plus the existing deterministic Dossier rate and liquidity sensors. Raw headlines cannot directly rewrite a Regime."
            : "Regimes are available from current Stories, but immutable Story-event history is unavailable. The interface will not infer missing historical state."}
        />

        <DataState
          state={
            shadowHealth.available
              && shadowHealth.latestRunStatus === "completed"
              && shadowHealth.currentProjectionCount === shadowHealth.expectedProjectionCount
              ? "ready"
              : "warn"
          }
          title={shadowHealth.available ? "Persistent shadow engine" : "Persistent shadow engine awaiting first run"}
          detail={shadowHealth.available
            ? `${shadowHealth.currentProjectionCount}/${shadowHealth.expectedProjectionCount} persisted Regime projections · ${shadowHealth.contractVersion || "unknown contract"} · last completed ${shadowHealth.lagMinutes === null ? "time unavailable" : `${shadowHealth.lagMinutes} min ago`}. Shadow state is auditable but does not yet replace the live read model.`
            : `The persistence schema is deployed, but no shadow projector run has completed yet. ${shadowHealth.warning || "The next canonical Story or Dossier write will create the bootstrap projection."}`}
        />

        <DataState
          state={shadowHealth.unassignedStoryCount === 0 ? "ready" : "warn"}
          title={shadowHealth.unassignedStoryCount === 0 ? "Story routing health" : "Story routing debt is open"}
          detail={shadowHealth.unassignedStoryCount === 0
            ? "Every market-admissible active Story currently clears a governed Regime route. No weak fallback mapping is required."
            : `${shadowHealth.unassignedStoryCount} active ${shadowHealth.unassignedStoryCount === 1 ? "Story remains" : "Stories remain"} intentionally unassigned · ${shadowHealth.highSeverityUnassignedStoryCount} high/critical · oldest open ${formatAge(shadowHealth.oldestUnassignedAgeMinutes)}. These Stories remain visible in Stories and are not forced into a weak Regime mapping.`}
        />

        <DataState
          state={shadowHealth.quarantinedStoryCount === 0 ? "ready" : "warn"}
          title={shadowHealth.quarantinedStoryCount === 0 ? "Story domain health" : "Story domain quarantine is open"}
          detail={shadowHealth.quarantinedStoryCount === 0
            ? "Every active Story currently describes a market, economic, corporate or policy mechanism."
            : `${shadowHealth.quarantinedStoryCount} active ${shadowHealth.quarantinedStoryCount === 1 ? "Story is" : "Stories are"} preserved but quarantined from Regime routing · ${shadowHealth.highSeverityQuarantinedStoryCount} high/critical · oldest open ${formatAge(shadowHealth.oldestQuarantinedAgeMinutes)}. Quarantine is a governance scope flag, not evidence that the Story thesis is false.`}
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
