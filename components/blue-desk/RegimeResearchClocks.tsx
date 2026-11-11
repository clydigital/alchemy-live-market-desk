import type { PublicSourceObservation } from "@/lib/blue-desk-source-observations-projector";
import type { RegimeShadowHealth } from "@/lib/regime-engine";
import { projectRegimeResearchClocks } from "@/lib/bluebelly-regime-research-clocks";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";

/** The three clocks are not interchangeable evidence vintages. */
export default function RegimeResearchClocks({
  sources, editorialReviewedOn, shadow,
}: {
  sources: readonly PublicSourceObservation[] | null;
  editorialReviewedOn: string;
  shadow: RegimeShadowHealth | null;
}) {
  const clocks = projectRegimeResearchClocks({ sources, editorialReviewedOn, shadow });
  const cell: React.CSSProperties = {
    flex: "1 1 215px", minWidth: 0,
    padding: "12px 15px", border: "1px solid var(--bb-card-border)", borderRadius: 8,
  };
  const caption: React.CSSProperties = {
    display: "block", color: "var(--bb-muted)", textTransform: "uppercase",
    letterSpacing: ".07em", fontSize: 11, fontWeight: 700, marginBottom: 7,
  };
  const value: React.CSSProperties = { display: "block", fontSize: 14, fontWeight: 650, lineHeight: 1.5 };
  const note: React.CSSProperties = { display: "block", fontSize: 12, opacity: .83, marginTop: 6, lineHeight: 1.5 };
  return (
    <section data-regime-research-clocks="original-editorial-shadow-v1"
      aria-label="Research freshness and interpretation timestamps"
      style={{ margin: "16px 0 22px", padding: "16px", background: "var(--bb-surface)",
        border: "1px solid var(--bb-card-border)", borderRadius: 10 }}>
      <strong style={{display:"block",marginBottom:12,fontSize:13}}>
        Evidence age is not interpretation age
      </strong>
      <div style={{display:"flex",flexWrap:"wrap",gap:9}}>
        <div style={cell} data-regime-clock-source={clocks.sourceState}>
          <span style={caption}>01 / Original source observation</span>
          <span style={value}>{clocks.sourceEventAt
            ? <DualTimestamp value={clocks.sourceEventAt}/>
            : clocks.sourceState === "UNAVAILABLE" ? "Source read unavailable" : "No qualifying source in the 48h public sample"}</span>
          <span style={note}>{clocks.sourceRecordedAt
            ? <>Recorded <DualTimestamp value={clocks.sourceRecordedAt}/> · event time is distinct from ingestion</>
            : "No claim of a new measured market event."}</span>
        </div>
        <div style={cell} data-regime-clock-review={clocks.editorialReviewedOn}>
          <span style={caption}>02 / Reviewed lens outlook</span>
          <span style={value}>{clocks.editorialReviewedOn} MYT</span>
          <span style={note}>{clocks.unreviewedNewSource
            ? "New source input exists after review; the direction meter has not been automatically revised."
            : "This dated judgement is independent of page-view time or new headlines."}</span>
        </div>
        <div style={cell} data-regime-clock-shadow={clocks.shadowState}>
          <span style={caption}>03 / Persisted Regime shadow run</span>
          <span style={value}>{clocks.shadowCompletedAt
            ? <DualTimestamp value={clocks.shadowCompletedAt}/>
            : "No completed shadow run available"}</span>
          <span style={note}>{clocks.shadowCoverage
            ? clocks.shadowCoverage + " persisted snapshots. Individual Regime versions may be older."
            : "Persistent projection coverage unavailable."}</span>
        </div>
      </div>
      <p style={{margin:"11px 2px 0",fontSize:12,lineHeight:1.6,opacity:.83}}>
        These are separate clocks. The source column samples existing tier-1/2 original-source records from the last 48 hours;
        it is not an exhaustive live feed. The reviewed outlook is a dated editorial interpretation.
        The third column is a historical <strong>shadow projection</strong>, not proof of a fresh canonical verdict.
        Source-only collection does not automatically run Story/Regime reasoning.
      </p>
    </section>
  );
}
