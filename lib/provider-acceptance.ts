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
}) {
  const fred = (result: FredReadResult) => ({
    state: result.state as State,
    httpOrEntitlement: result.note,
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
    fred: {
      DGS10: fred(input.nominal10Y),
      T10YIE: fred(input.breakeven10Y),
    },
    fmp: {
      earningsCalendar: {
        state: fmp.state as State,
        httpOrEntitlement: fmp.note,
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
        bea.state === "unconfigured" ? "BEA_NOT_CONFIGURED" : "BEA_UNAVAILABLE",
      observations: ["gdp", "pcePriceIndex"].flatMap((metric) => {
        const latest = bea.observations.find((item) => item.metric === metric);
        return latest ? [{ metric: latest.metric, period: latest.period, unit: latest.unit }] : [];
      }),
    },
  };
}
