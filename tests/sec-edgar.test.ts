import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSecCompanyFactsUrl,
  buildSecSubmissionsUrl,
  fetchSecCompanySnapshot,
  normalizeSecCik,
  parseSecCompanyFactsPayload,
  parseSecSubmissionsPayload,
} from "../lib/providers/sec-edgar.ts";

test("SEC CIK and official data.sec.gov URLs are deterministic", () => {
  assert.equal(normalizeSecCik(320193), "0000320193");
  assert.equal(buildSecSubmissionsUrl("320193"), "https://data.sec.gov/submissions/CIK0000320193.json");
  assert.equal(buildSecCompanyFactsUrl("0000320193"), "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json");
  assert.throws(() => normalizeSecCik("not-a-cik"), /1-10 digits/);
});

test("SEC submissions parser preserves filing identity and archive URL", () => {
  const result = parseSecSubmissionsPayload({
    name: "Example Corp",
    filings: {
      recent: {
        accessionNumber: ["0000320193-26-000001", "0000320193-26-000002"],
        filingDate: ["2026-08-01", "2026-08-05"],
        reportDate: ["2026-06-30", "2026-06-30"],
        acceptanceDateTime: ["20260801120000", "20260805130000"],
        form: ["10-Q", "8-K"],
        primaryDocument: ["example-20260630.htm", "example-8k.htm"],
        items: ["", "2.02"]
      }
    }
  }, "320193");

  assert.equal(result.entityName, "Example Corp");
  assert.equal(result.filings.length, 2);
  assert.equal(result.filings[0].form, "8-K");
  assert.equal(result.filings[0].items, "2.02");
  assert.equal(
    result.filings[0].primaryDocumentUrl,
    "https://www.sec.gov/Archives/edgar/data/320193/000032019326000002/example-8k.htm",
  );
});

test("SEC companyfacts parser selects stable concepts and latest/previous observations", () => {
  const result = parseSecCompanyFactsPayload({
    entityName: "Example Corp",
    facts: {
      "us-gaap": {
        RevenueFromContractWithCustomerExcludingAssessedTax: {
          label: "Revenue",
          description: "Revenue from contracts with customers.",
          units: {
            USD: [
              { start: "2025-01-01", end: "2025-12-31", val: 100, filed: "2026-02-01", form: "10-K", fy: 2025, fp: "FY", accn: "a" },
              { start: "2026-01-01", end: "2026-06-30", val: 60, filed: "2026-08-01", form: "10-Q", fy: 2026, fp: "Q2", accn: "b" }
            ]
          }
        },
        PaymentsToAcquirePropertyPlantAndEquipment: {
          label: "Capital Expenditures",
          description: "Cash paid for property plant and equipment.",
          units: {
            USD: [
              { start: "2025-01-01", end: "2025-12-31", val: 20, filed: "2026-02-01", form: "10-K", fy: 2025, fp: "FY", accn: "c" },
              { start: "2026-01-01", end: "2026-06-30", val: 14, filed: "2026-08-01", form: "10-Q", fy: 2026, fp: "Q2", accn: "d" }
            ]
          }
        }
      }
    }
  });

  assert.equal(result.entityName, "Example Corp");
  assert.equal(result.metrics.revenue?.concept, "RevenueFromContractWithCustomerExcludingAssessedTax");
  assert.equal(result.metrics.revenue?.latest.value, 60);
  assert.equal(result.metrics.revenue?.previous?.value, 100);
  assert.equal(result.metrics.capex?.latest.value, 14);
  assert.equal(result.metrics.capex?.latest.unit, "USD");
});

test("SEC fetch is explicitly unconfigured without a compliant user agent", async () => {
  const result = await fetchSecCompanySnapshot("320193", "");
  assert.equal(result.state, "unconfigured");
  assert.equal(result.cik, "0000320193");
  assert.match(result.note || "", /SEC_USER_AGENT/);
});

test("SEC fetch normalizes submissions and XBRL using an injected fetch", async () => {
  const seen: Array<{ url: string; userAgent: string | null }> = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    seen.push({ url, userAgent: headers.get("user-agent") });
    if (url.includes("/submissions/")) {
      return new Response(JSON.stringify({
        name: "Example Corp",
        filings: {
          recent: {
            accessionNumber: ["0000320193-26-000002"],
            filingDate: ["2026-08-05"],
            reportDate: ["2026-06-30"],
            acceptanceDateTime: ["20260805130000"],
            form: ["8-K"],
            primaryDocument: ["example-8k.htm"],
            items: ["2.02"]
          }
        }
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({
      entityName: "Example Corp",
      facts: {
        "us-gaap": {
          NetIncomeLoss: {
            label: "Net Income",
            description: "Net income.",
            units: { USD: [{ start: "2026-01-01", end: "2026-06-30", val: 5, filed: "2026-08-01", form: "10-Q", fy: 2026, fp: "Q2", accn: "b" }] }
          }
        }
      }
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  const result = await fetchSecCompanySnapshot("320193", "Alchemy Live Desk test@example.com", fetchImpl);
  assert.equal(result.state, "ready");
  assert.equal(result.entityName, "Example Corp");
  assert.equal(result.filings[0].form, "8-K");
  assert.equal(result.metrics.netIncome?.latest.value, 5);
  assert.equal(seen.length, 2);
  assert.ok(seen.every((request) => request.userAgent === "Alchemy Live Desk test@example.com"));
});
