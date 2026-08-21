import { fetchJinaReader, type JinaReaderOptions, type JinaReaderResult } from "../acquisition/jina-reader.ts";
import {
  DEFAULT_MACRO_INDICATORS_URL,
  EXPECTED_MACRO_SECTIONS,
  stableMacroHash,
  type MacroSection,
} from "./macro-indicators-source.ts";
import { buildMacroSnapshot, type MacroSnapshot, type MacroSnapshotTable } from "./macro-snapshot.ts";

export type MacroCaptureStatus = "COMPLETE" | "PARTIAL" | "FAILED" | "UNAVAILABLE";
export type StoredMacroCaptureStatus = "persisting" | "complete" | "partial" | "failed";

export type MacroCaptureResult = {
  status: MacroCaptureStatus;
  attemptSnapshotId: string | null;
  currentSnapshotId: string | null;
  fingerprint: string | null;
  tableCount: number;
  note: string;
};

export type MacroCaptureAttempt = {
  sourceKey: "macro_indicators";
  sourceUrl: string;
  transport: "jina_reader";
  schemaVersion: number;
  captureStartedAt: string;
  captureCompletedAt: string;
  status: StoredMacroCaptureStatus;
  fingerprint: string | null;
  expectedSections: readonly MacroSection[];
  capturedSections: MacroSection[];
  missingSections: MacroSection[];
  missingRequiredTableFamilies: string[];
  tableCount: number;
  rawMarkdown: string | null;
  transportStatus: number | null;
  transportErrorCode: string | null;
  transportErrorMessage: string | null;
  usedAuthentication: boolean;
  authenticationMode: "bearer" | "none";
};

export type MacroSectionManifest = {
  sectionKey: MacroSection;
  status: "captured" | "missing";
  tableCount: number;
  rowCount: number;
  checksum: string;
};

export type MacroCaptureStore = {
  latestCompleteSnapshotId: () => Promise<string | null>;
  createAttempt: (attempt: MacroCaptureAttempt) => Promise<string>;
  insertSections: (snapshotId: string, sections: MacroSectionManifest[]) => Promise<void>;
  insertTables: (snapshotId: string, tables: MacroSnapshotTable[]) => Promise<void>;
  insertRows: (snapshotId: string, tables: MacroSnapshotTable[]) => Promise<void>;
  finalizeAttempt: (snapshotId: string, status: "complete" | "partial") => Promise<void>;
};

export type CaptureMacroIndicatorsOptions = {
  store: MacroCaptureStore;
  apiKey?: string | null;
  sourceUrl?: string;
  now?: () => Date;
  fetchReader?: (options: JinaReaderOptions) => Promise<JinaReaderResult>;
};

function capturedSections(snapshot: MacroSnapshot) {
  return EXPECTED_MACRO_SECTIONS.filter((section) => !snapshot.missingSections.includes(section));
}

export function buildSectionManifests(snapshot: MacroSnapshot): MacroSectionManifest[] {
  return EXPECTED_MACRO_SECTIONS.map((sectionKey) => {
    const tables = snapshot.tables.filter((table) => table.section === sectionKey);
    const rowCount = tables.reduce((sum, table) => sum + table.rows.length, 0);
    const missing = snapshot.missingSections.includes(sectionKey);
    return {
      sectionKey,
      status: missing ? "missing" : "captured",
      tableCount: tables.length,
      rowCount,
      checksum: stableMacroHash(JSON.stringify(tables.map((table) => ({
        tableId: table.tableId,
        fingerprint: table.fingerprint,
      })))),
    };
  });
}

function failedAttempt(input: {
  sourceUrl: string;
  startedAt: string;
  completedAt: string;
  reader: JinaReaderResult;
}): MacroCaptureAttempt {
  return {
    sourceKey: "macro_indicators",
    sourceUrl: input.sourceUrl,
    transport: "jina_reader",
    schemaVersion: 1,
    captureStartedAt: input.startedAt,
    captureCompletedAt: input.completedAt,
    status: "failed",
    fingerprint: null,
    expectedSections: EXPECTED_MACRO_SECTIONS,
    capturedSections: [],
    missingSections: [...EXPECTED_MACRO_SECTIONS],
    missingRequiredTableFamilies: ["calendar-events", "ism-main", "fedwatch", "cot"],
    tableCount: 0,
    rawMarkdown: null,
    transportStatus: input.reader.status,
    transportErrorCode: input.reader.errorCode,
    transportErrorMessage: input.reader.errorMessage,
    usedAuthentication: input.reader.usedAuthentication,
    authenticationMode: input.reader.authenticationMode,
  };
}

export async function captureMacroIndicatorsWithDependencies(
  options: CaptureMacroIndicatorsOptions,
): Promise<MacroCaptureResult> {
  const sourceUrl = options.sourceUrl ?? DEFAULT_MACRO_INDICATORS_URL;
  const now = options.now ?? (() => new Date());
  const currentBefore = await options.store.latestCompleteSnapshotId();
  const apiKey = options.apiKey?.trim() ?? "";

  if (!apiKey) {
    return {
      status: "UNAVAILABLE",
      attemptSnapshotId: null,
      currentSnapshotId: currentBefore,
      fingerprint: null,
      tableCount: 0,
      note: "JINA_API_KEY is not configured; the last COMPLETE Macro Indicators snapshot remains canonical.",
    };
  }

  const startedAt = now().toISOString();
  const reader = await (options.fetchReader ?? fetchJinaReader)({
    sourceUrl,
    apiKey,
    timeoutMs: 30_000,
  });
  const completedAt = now().toISOString();

  if (!reader.ok) {
    const attemptSnapshotId = await options.store.createAttempt(failedAttempt({
      sourceUrl,
      startedAt,
      completedAt,
      reader,
    }));
    return {
      status: "FAILED",
      attemptSnapshotId,
      currentSnapshotId: currentBefore,
      fingerprint: null,
      tableCount: 0,
      note: `Jina Macro Indicators acquisition failed (${reader.errorCode ?? "unknown"}); the last COMPLETE snapshot remains canonical.`,
    };
  }

  const snapshot = buildMacroSnapshot(reader.text, completedAt);
  const attemptSnapshotId = await options.store.createAttempt({
    sourceKey: "macro_indicators",
    sourceUrl,
    transport: "jina_reader",
    schemaVersion: 1,
    captureStartedAt: startedAt,
    captureCompletedAt: completedAt,
    status: "persisting",
    fingerprint: snapshot.fingerprint,
    expectedSections: EXPECTED_MACRO_SECTIONS,
    capturedSections: capturedSections(snapshot),
    missingSections: snapshot.missingSections,
    missingRequiredTableFamilies: snapshot.missingRequiredTableFamilies,
    tableCount: snapshot.tableCount,
    rawMarkdown: reader.text,
    transportStatus: reader.status,
    transportErrorCode: null,
    transportErrorMessage: null,
    usedAuthentication: reader.usedAuthentication,
    authenticationMode: reader.authenticationMode,
  });

  await options.store.insertSections(attemptSnapshotId, buildSectionManifests(snapshot));
  await options.store.insertTables(attemptSnapshotId, snapshot.tables);
  await options.store.insertRows(attemptSnapshotId, snapshot.tables);
  await options.store.finalizeAttempt(
    attemptSnapshotId,
    snapshot.status === "COMPLETE" ? "complete" : "partial",
  );

  if (snapshot.status === "PARTIAL") {
    return {
      status: "PARTIAL",
      attemptSnapshotId,
      currentSnapshotId: currentBefore,
      fingerprint: snapshot.fingerprint,
      tableCount: snapshot.tableCount,
      note: `Partial Macro Indicators snapshot stored; missing ${snapshot.missingSections.join(", ") || snapshot.missingRequiredTableFamilies.join(", ")}. The last COMPLETE snapshot remains canonical.`,
    };
  }

  return {
    status: "COMPLETE",
    attemptSnapshotId,
    currentSnapshotId: attemptSnapshotId,
    fingerprint: snapshot.fingerprint,
    tableCount: snapshot.tableCount,
    note: "Complete Macro Indicators snapshot stored and selected as the current canonical macro source snapshot.",
  };
}
