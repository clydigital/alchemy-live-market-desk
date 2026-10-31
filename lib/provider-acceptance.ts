import type { BeaSnapshot } from "./providers/bea.ts";
import type { FredReadResult } from "./providers/fred-api-v1.ts";
import type { FmpReadResult } from "./providers/fmp-rest.ts";

type State = "ready" | "unconfigured" | "unavailable" | "restricted";

/** Safe operational receipt. Never include request URLs, keys, raw values or records. */
export function providerAcceptanceReceipt(input: {
  at: string;
  nominal10Y: FredReadResult;
  breakeven10Y: FredReadResult;
  earningsCalendar: FmpReadResult;
  bea: BeaSnapshot;
  // Process-env availability observed by the deployed server, never a Vercel
  // team/project Shared Environment Variable inventory.
  runtimeKeys?: { fred: boolean; fmp: boolean; bea: boolean };
}) {
  const credentialState = (visible: boolean | undefined) =>
    visible === undefined ? "not_checked" :
      visible ? "visible_at_runtime" : "not_visible_at_runtime";
  const fred = (result: FredReadResult) => ({
    state: result.state as State,
    httpOrEntitlement: result.state === "unconfigured"
      ? "FRED_CREDENTIAL_NOT_VISIBLE_AT_RUNTIME" : result.note,
    observationDate: result.observations[0]?.date ?? null,
    unit: "percent",
  });
  const fmp = input.earningsCalendar;
  const dates = fmp.records
    .map((record) => record.date)
    .filter((date): date is string => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
  const bea = input.bea;
  return {
    kind: "provider_acceptance_v1",
    checkedAt: input.at,
    canonicalEvidenceWritten: false,
    // An absent key here does NOT establish absence from Vercel Team Shared
    // Environment Variables; the deployment may lack the project attachment,
    // Production target, or a redeploy after a key change.
    credentialDiagnostics: {
      inspectionScope: "deployed_server_runtime_only",
      teamSharedEnvironmentVariables: "not_inspected",
      sharedVariableProjectLinkage: "not_verified",
      fred: credentialState(input.runtimeKeys?.fred),
      fmp: credentialState(input.runtimeKeys?.fmp),
      bea: credentialState(input.runtimeKeys?.bea),
      missingFromVercelClaimSupported: false,
      nextAction: input.runtimeKeys && Object.values(input.runtimeKeys).some(value => !value)
        ? "CHECK_TEAM_SHARED_ENV_PROJECT_LINK_PRODUCTION_SCOPE_AND_REDEPLOY"
        : "CHECK_PROVIDER_HTTP_STATUS_ENTITLEMENT_LIMITS_AND_OBSERVATION_DATES",
    },
    fred: {
      DGS10: fred(input.nominal10Y),
      T10YIE: fred(input.breakeven10Y),
    },
    fmp: {
      earningsCalendar: {
        state: fmp.state as State,
        httpOrEntitlement: fmp.state === "unconfigured"
          ? "FMP_CREDENTIAL_NOT_VISIBLE_AT_RUNTIME" : fmp.note,
        firstDate: dates[0] ?? null,
        lastDate: dates.at(-1) ?? null,
        unit: "calendar event",
      },
    },
    bea: {
      state: bea.state as State,
      // BEA prose errors must never enter logs or the response; some transport
      // errors can embed the credential-bearing request URL.
      httpOrEntitlement: bea.state === "ready" ? null :
        bea.state === "unconfigured" ? "BEA_CREDENTIAL_NOT_VISIBLE_AT_RUNTIME" : "BEA_UNAVAILABLE",
      observations: ["gdp", "pcePriceIndex"].flatMap((metric) => {
        const latest = bea.observations.find((item) => item.metric === metric);
        return latest ? [{ metric: latest.metric, period: latest.period, unit: latest.unit }] : [];
      }),
    },
  };
}
