import Link from "next/link";

import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { DataState, Panel } from "@/components/live-desk/LiveDeskUi";

export const dynamic = "force-dynamic";

export default function PositioningPage() {
  return (
    <LiveDeskShell
      activePath="/data/positioning"
      title="Positioning"
      description="The Original Live Desk remains canonical for CFTC-derived positioning. PR 1 establishes the route without inventing report vintages or copying illustrative heatmap values."
      meta="Canonical positioning feed not yet exposed to this route"
    >
      <div className={styles.grid}>
        <DataState
          state="warn"
          title="Positioning route installed, data contract pending"
          detail="The audited loader does not currently return a complete report-vintage contract with report date, publication date, participant group, raw Commercial index, inverted display score and five-year percentage-of-open-interest history."
        />

        <div className={styles.gridTwo}>
          <Panel title="Alchemy institutional view" description="Target contract for official TFF and Disaggregated categories.">
            <div className={styles.recordList}>
              <article className={styles.record}><h3>Required before activation</h3><p>Official CFTC source, contract mapping, report vintage, participant definition, net position, percentage of open interest, historical percentile, weekly lag and exact Story relevance.</p></article>
              <article className={styles.record}><h3>Interpretation rule</h3><p>Positioning may support, contradict, amplify, remain neutral or be stale. It cannot become a standalone directional trade signal.</p></article>
            </div>
          </Panel>

          <Panel title="COTSignal-style Legacy view" description="Presentation may follow the approved method only after the raw data contract exists.">
            <div className={styles.recordList}>
              <article className={styles.record}><h3>52-week heatmap</h3><p>Commercials, Large Specs and Small Specs require a visible methodology legend and weekly lag.</p></article>
              <article className={styles.record}><h3>Commercial inversion</h3><p>The interface must store raw and inverted values separately and disclose the formula: 100 minus the raw Commercial index.</p></article>
            </div>
          </Panel>
        </div>

        <Link className={styles.link} href="/legacy?tab=Signals">Open the current legacy Signals and positioning runtime</Link>
      </div>
    </LiveDeskShell>
  );
}
