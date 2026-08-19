import type {
  MacroSnapshot,
  MacroSnapshotRow,
  MacroSnapshotTable,
  RequiredMacroTableFamily,
} from "./macro-snapshot.ts";
import type { MacroSection, MacroTableKind } from "./macro-indicators-source.ts";

export type MacroChange =
  | {
      type: "CELL_CHANGED";
      tableId: string;
      section: MacroSection | null;
      kind: MacroTableKind;
      rowKey: string;
      column: string;
      oldValue: string;
      newValue: string;
    }
  | {
      type: "ROW_ADDED" | "ROW_REMOVED";
      tableId: string;
      section: MacroSection | null;
      kind: MacroTableKind;
      rowKey: string;
      row: Record<string, string>;
    }
  | {
      type: "TABLE_ADDED";
      tableId: string;
      section: MacroSection | null;
      kind: MacroTableKind;
    };

export type MacroSnapshotComparison = {
  status: "COMPLETE" | "PARTIAL";
  previousFingerprint: string;
  currentFingerprint: string;
  changedTableCount: number;
  changeCount: number;
  missingSections: MacroSection[];
  missingRequiredTableFamilies: RequiredMacroTableFamily[];
  missingTableIds: string[];
  changes: MacroChange[];
};

export type MacroSnapshotTransition = {
  advanced: boolean;
  current: MacroSnapshot | null;
  comparison: MacroSnapshotComparison | null;
  reason: "accepted_complete" | "partial_rejected" | "transport_failure";
};

function tableMap(snapshot: MacroSnapshot) {
  return new Map(snapshot.tables.map((table) => [table.tableId, table]));
}

function rowMap(table: MacroSnapshotTable) {
  return new Map(table.rows.map((row) => [row.key, row]));
}

function changedColumns(previous: MacroSnapshotRow, current: MacroSnapshotRow) {
  const columns = new Set([...Object.keys(previous.cells), ...Object.keys(current.cells)]);
  return [...columns]
    .sort()
    .filter((column) => (previous.cells[column] ?? "") !== (current.cells[column] ?? ""));
}

export function compareMacroSnapshots(
  previous: MacroSnapshot,
  current: MacroSnapshot,
): MacroSnapshotComparison {
  const previousTables = tableMap(previous);
  const currentTables = tableMap(current);
  const changes: MacroChange[] = [];
  const missingTableIds = [...previousTables.keys()].filter((tableId) => !currentTables.has(tableId));

  for (const [tableId, currentTable] of currentTables) {
    const previousTable = previousTables.get(tableId);
    if (!previousTable) {
      changes.push({
        type: "TABLE_ADDED",
        tableId,
        section: currentTable.section,
        kind: currentTable.kind,
      });
      continue;
    }

    if (previousTable.fingerprint === currentTable.fingerprint) continue;

    const previousRows = rowMap(previousTable);
    const currentRows = rowMap(currentTable);

    for (const [rowKey, currentRow] of currentRows) {
      const previousRow = previousRows.get(rowKey);
      if (!previousRow) {
        changes.push({
          type: "ROW_ADDED",
          tableId,
          section: currentTable.section,
          kind: currentTable.kind,
          rowKey,
          row: currentRow.cells,
        });
        continue;
      }

      for (const column of changedColumns(previousRow, currentRow)) {
        changes.push({
          type: "CELL_CHANGED",
          tableId,
          section: currentTable.section,
          kind: currentTable.kind,
          rowKey,
          column,
          oldValue: previousRow.cells[column] ?? "",
          newValue: currentRow.cells[column] ?? "",
        });
      }
    }

    // A partial capture may omit observations because acquisition is incomplete.
    // Never convert that absence into a canonical deletion signal.
    if (current.status === "COMPLETE") {
      for (const [rowKey, previousRow] of previousRows) {
        if (currentRows.has(rowKey)) continue;
        changes.push({
          type: "ROW_REMOVED",
          tableId,
          section: currentTable.section,
          kind: currentTable.kind,
          rowKey,
          row: previousRow.cells,
        });
      }
    }
  }

  const changedTableCount = new Set(changes.map((change) => change.tableId)).size;

  return {
    status: current.status,
    previousFingerprint: previous.fingerprint,
    currentFingerprint: current.fingerprint,
    changedTableCount,
    changeCount: changes.length,
    missingSections: current.missingSections,
    missingRequiredTableFamilies: current.missingRequiredTableFamilies,
    missingTableIds,
    changes,
  };
}

export function evaluateMacroSnapshotCandidate(
  current: MacroSnapshot | null,
  candidate: MacroSnapshot | null,
): MacroSnapshotTransition {
  if (!candidate) {
    return {
      advanced: false,
      current,
      comparison: null,
      reason: "transport_failure",
    };
  }

  if (candidate.status !== "COMPLETE") {
    return {
      advanced: false,
      current,
      comparison: current ? compareMacroSnapshots(current, candidate) : null,
      reason: "partial_rejected",
    };
  }

  return {
    advanced: true,
    current: candidate,
    comparison: current ? compareMacroSnapshots(current, candidate) : null,
    reason: "accepted_complete",
  };
}
