# Japan MOF weekly portfolio-flow sensor

`lib/providers/japan-mof-weekly-flows.ts` is a deterministic, keyless specialist sensor for Japan Ministry of Finance **International Transactions in Securities (Weekly; based on reports from designated major investors)**.

Source: `https://www.mof.go.jp/policy/international_policy/reference/itn_transactions_in_securities/week.csv`

The official file is Shift-JIS/CP932 and reports values in `JPY 100 million`; the adapter converts numeric net fields to `JPY bn` while preserving the source period label. The proven weekly table exposes eight net series: outward equity, outward long-term debt, outward short-term debt, outward total, inward equity, inward long-term debt, inward short-term debt, and inward total.

## Outward sign convention

The Ministry of Finance states that the sign convention for **foreign securities transactions by residents** changed in January 2014. Before 2014, positive outward net meant net sales and negative meant net purchases. From January 2014 onward, positive outward net means net purchases and negative means net sales.

The adapter therefore preserves the raw outward net values and also emits normalized `*NetPurchaseJpyBn` fields when the observation year can be inferred from the source period label. It never applies the 2014 rule when the year is unknown.

## Failure semantics

HTTP/network failures return `unavailable`. Schema drift or a response with no rows matching the proven weekly table shape also returns `unavailable`; no local substitute is fabricated. This first implementation is sensor-only: no cron, persistence migration, Brain/Story Finder, or Hybrid activation is included.