import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  captureMacroIndicatorsWithDependencies,
  type MacroCaptureAttempt,
  type MacroCaptureResult,
  type MacroCaptureStore,
  type MacroSectionManifest,
} from "./macro-capture.ts";
import { type MacroSnapshotTable } from "./macro-snapshot.ts";

const SOURCE_KEY = "macro_indicators";
const ROW_BATCH_SIZE = 500;

function productionStore(): MacroCaptureStore {
  const client = createSupabaseAdminClient();

  return {
    async latestCompleteSnapshotId() {
      const { data, error } = await client
        .from("macro_source_snapshots")
        .select("id")
        .eq("source_key", SOURCE_KEY)
        .eq("status", "complete")
        .order("capture_completed_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>();
      if (error) throw new Error(`Could not read latest complete Macro Indicators snapshot: ${error.message}`);
      return data?.id ?? null;
    },

    async createAttempt(attempt: MacroCaptureAttempt) {
      const { data, error } = await client
        .from("macro_source_snapshots")
        .insert({
          source_key: attempt.sourceKey,
          source_url: attempt.sourceUrl,
          transport: attempt.transport,
          schema_version: attempt.schemaVersion,
          capture_started_at: attempt.captureStartedAt,
          capture_completed_at: attempt.captureCompletedAt,
          status: attempt.status,
          fingerprint: attempt.fingerprint,
          expected_sections: attempt.expectedSections,
          captured_sections: attempt.capturedSections,
          missing_sections: attempt.missingSections,
          missing_required_table_families: attempt.missingRequiredTableFamilies,
          table_count: attempt.tableCount,
          raw_markdown: attempt.rawMarkdown,
          transport_status: attempt.transportStatus,
          transport_error_code: attempt.transportErrorCode,
          used_authentication: attempt.usedAuthentication,
        })
        .select("id")
        .single<{ id: string }>();
      if (error || !data?.id) throw new Error(`Could not persist Macro Indicators capture attempt: ${error?.message || "missing snapshot id"}`);
      return data.id;
    },

    async insertSections(snapshotId: string, sections: MacroSectionManifest[]) {
      if (!sections.length) return;
      const { error } = await client.from("macro_source_snapshot_sections").insert(
        sections.map((section) => ({
          snapshot_id: snapshotId,
          section_key: section.sectionKey,
          status: section.status,
          table_count: section.tableCount,
          row_count: section.rowCount,
          checksum: section.checksum,
        })),
      );
      if (error) throw new Error(`Could not persist Macro Indicators section manifest: ${error.message}`);
    },

    async insertTables(snapshotId: string, tables: MacroSnapshotTable[]) {
      if (!tables.length) return;
      const { error } = await client.from("macro_source_snapshot_tables").insert(
        tables.map((table) => ({
          snapshot_id: snapshotId,
          table_id: table.tableId,
          section_key: table.section,
          table_kind: table.kind,
          context_label: table.contextLabel,
          headers: table.headers,
          row_count: table.rows.length,
          fingerprint: table.fingerprint,
        })),
      );
      if (error) throw new Error(`Could not persist Macro Indicators table manifest: ${error.message}`);
    },

    async insertRows(snapshotId: string, tables: MacroSnapshotTable[]) {
      const rows = tables.flatMap((table) => table.rows.map((row, rowIndex) => ({
        snapshot_id: snapshotId,
        table_id: table.tableId,
        row_key: row.key,
        row_index: rowIndex,
        cells: row.cells,
      })));

      for (let index = 0; index < rows.length; index += ROW_BATCH_SIZE) {
        const { error } = await client
          .from("macro_source_snapshot_rows")
          .insert(rows.slice(index, index + ROW_BATCH_SIZE));
        if (error) throw new Error(`Could not persist Macro Indicators rows: ${error.message}`);
      }
    },

    async finalizeAttempt(snapshotId: string, status: "complete" | "partial") {
      const { error } = await client
        .from("macro_source_snapshots")
        .update({ status })
        .eq("id", snapshotId)
        .eq("status", "persisting");
      if (error) throw new Error(`Could not finalise Macro Indicators snapshot: ${error.message}`);
    },
  };
}

export async function captureMacroIndicatorsSnapshot(options: { now?: Date } = {}): Promise<MacroCaptureResult> {
  const now = options.now ?? new Date();
  try {
    return await captureMacroIndicatorsWithDependencies({
      store: productionStore(),
      apiKey: process.env.JINA_API_KEY,
      now: () => now,
    });
  } catch (error) {
    return {
      status: "UNAVAILABLE",
      attemptSnapshotId: null,
      currentSnapshotId: null,
      fingerprint: null,
      tableCount: 0,
      note: `Macro Indicators capture persistence is unavailable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function attachMacroCaptureToResearchRun(
  researchRunId: string,
  capture: MacroCaptureResult,
) {
  const client = createSupabaseAdminClient();
  const { error } = await client
    .from("research_runs")
    .update({
      macro_snapshot_id: capture.currentSnapshotId,
      macro_capture_attempt_id: capture.attemptSnapshotId,
      macro_capture_status: capture.status.toLocaleLowerCase("en-US"),
      macro_capture_note: capture.note.slice(0, 1_000),
    })
    .eq("id", researchRunId)
    .eq("status", "running");
  if (error) throw new Error(`Could not attach Macro Indicators lineage to research run: ${error.message}`);
}
