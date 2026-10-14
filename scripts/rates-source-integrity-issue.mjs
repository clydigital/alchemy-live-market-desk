import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const URL = "https://alchemy-live-market-desk.vercel.app/api/rates/source-integrity";
const STATES = new Set(["OK", "WATCH", "ACTION_REQUIRED"]);

function statusProjection(data, http) {
  const structurallyValid = http === 200 && data && typeof data === "object"
    && data.contractVersion === "rates-source-integrity/1"
    && STATES.has(data.operationalStatus)
    && Array.isArray(data.alerts)
    && Array.isArray(data.treasury?.states) && data.treasury.states.length === 5
    && data.requiredRateInputs?.required === 5
    && typeof data.dossier?.id === "string" && data.dossier.id.length > 0;
  if (!structurallyValid) return {
    status: "ACTION_REQUIRED",
    alerts: [{ code: "SOURCE_INTEGRITY_CONTRACT_UNAVAILABLE", severity: "ACTION_REQUIRED",
      detail: `Source integrity API returned an invalid response or HTTP ${http}.` }],
    sourceVintages: {},
  };
  const alerts = data.alerts.map((alert) => ({
    code: String(alert?.code ?? "UNNAMED_ALERT"),
    severity: String(alert?.severity ?? "ACTION_REQUIRED"),
    detail: String(alert?.detail ?? "Missing alert detail."),
  })).sort((a, b) => a.code.localeCompare(b.code) || a.severity.localeCompare(b.severity));
  const badSeverity = alerts.some((a) => !["WATCH", "ACTION_REQUIRED"].includes(a.severity));
  const inconsistent = badSeverity
    || (data.operationalStatus === "OK" && alerts.length > 0)
    || (data.operationalStatus === "WATCH" && alerts.some((a) => a.severity === "ACTION_REQUIRED"));
  if (inconsistent) return {
    status: "ACTION_REQUIRED",
    alerts: [{ code: "SOURCE_INTEGRITY_CONTRACT_INCONSISTENT", severity: "ACTION_REQUIRED",
      detail: "Response status disagrees with its alert severity or payload." }],
    sourceVintages: {},
  };
  const codes = alerts.map((alert) => alert.code);
  const sourceVintages = {
    ...(codes.some((code) => code.startsWith("NY_FED_PRIMARY_DEALERS_"))
      ? { dealerAsOf: data.primaryDealers?.asOf ?? null } : {}),
    ...(codes.some((code) => code.includes("MOVE"))
      ? { moveAsOf: data.move?.observationDate ?? null, moveState: data.move?.state ?? null } : {}),
    ...(codes.some((code) => code.startsWith("RATE_") || code.includes("TREASURY"))
      ? { affectedTreasury: (data.treasury?.states ?? [])
        .filter((item) => item.state !== "COMPLETE")
        .map((item) => ({ id: item.id, state: item.state, date: item.observationDate ?? null }))
        .sort((a, b) => String(a.id).localeCompare(String(b.id))) } : {}),
    ...(codes.some((code) => code.startsWith("REQUIRED_RATE_") || code === "PERSISTED_RATE_COVERAGE_INCOMPLETE")
      ? { requiredMissing: [...(data.requiredRateInputs?.missing ?? [])].sort(),
        requiredDiagnostics: (data.requiredRateInputs?.diagnostics ?? [])
          .map((item) => ({ label: item.label, state: item.state, date: item.sourceDate }))
          .sort((a, b) => String(a.label).localeCompare(String(b.label))) } : {}),
    ...(codes.includes("TREASURY_FIVE_SESSION_MOVEMENT_LOST")
      ? { curveLatest: data.fiveSessionCurve?.latestDate ?? null,
        missingMaturities: [...(data.fiveSessionCurve?.missingMaturities ?? [])].sort() } : {}),
  };
  return { status: data.operationalStatus, alerts, sourceVintages };
}

/** A deterministic issue fingerprint: no run clock, latest page time or ephemeral Dossier ID. */
export function projectRatesSourceIssue(data, http = 200) {
  const projection = statusProjection(data, http);
  const alertLines = projection.alerts.map((a) => `${a.severity} ${a.code}: ${a.detail}`);
  const fingerprint = createHash("sha256").update(JSON.stringify({
    status: projection.status, alerts: projection.alerts,
    sourceVintages: projection.sourceVintages,
  })).digest("hex");
  const vintageLines = Object.entries(projection.sourceVintages)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  const body = [
    `Source integrity state: ${projection.status}`,
    "",
    "## Active alerts",
    alertLines.join("\n") || "None.",
    ...(vintageLines.length ? ["", "## Affected source vintages", ...vintageLines] : []),
    "",
    `Read-only evidence: ${URL}`,
    "",
    "Do not force healthy or fabricate unavailable provider observations.",
    `<!-- rates-source-watch-fingerprint=${fingerprint} -->`,
  ].join("\n");
  return { status: projection.status, fingerprint, alertLines, body };
}

if (process.argv[1]?.endsWith("/rates-source-integrity-issue.mjs")) {
  const http = Number(process.argv[2]);
  let data = null;
  try { data = JSON.parse(readFileSync(0, "utf8")); } catch { /* fail closed */ }
  process.stdout.write(JSON.stringify(projectRatesSourceIssue(data, http)) + "\n");
}
