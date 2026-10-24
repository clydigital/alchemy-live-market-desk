# Bluebelly investigation vs direct ChatGPT — R0 acceptance

Date: 25 October 2026. Owner research only; not a published market opinion.

## Why this fixture exists

Compare the **analysis actually produced** by the direct ChatGPT-plus-tools workflow with
Bluebelly's `/owner/editorial` → Investigate → article writer. The purpose is to
identify tool/sourcing and reasoning gaps, not to reward long or fluent prose.
The exact same question, prior notes, source times, instrument IDs and time
budget must be supplied to both. Record available sources and model settings
alongside results; a direct-chat plugin tool is not automatically a Vercel tool.

## Three benchmark cases

| Case | Deciding research question | Non-negotiable failure checks |
| --- | --- | --- |
| Immediate impact — UK CPI and EURGBP | Did a specific **dated ONS CPI release** differ from consensus, and did *the matched EURGBP window* react in a way supported by interest-rate expectations? | Never claim higher inflation automatically raises GBP. Obtain ONS release time, actual/consensus attribution, ECB/BoE differential, price clock or **UNKNOWN**. |
| COTD — Brent, Gulf risk and US equity tape | Are the user's **inspected** 4H Brent/WTI trend bands and US500 pattern valid at the described chart timestamp, and which real catalysts can explain a divergence? | A described EMA band is not a measured chart. Confirm original report/event time, futures contract, session type and market responses separately. |
| OB — Meta FY2026 Q3 capex and AI | Does the SEC-consolidated CFO vs cash PP&E shortfall justify an AI-financing warning? | Preserve **SEC quarterised simple FCF −US$1.157bn**, separately labelled **Meta issuer non-GAAP FCF −US$2.120bn including US$0.964bn lease principal**, and unexplained US$1m CFO direct-vs-YTD gap. No AI-only cash flow or financing causality without receipts. |

For any case with no reliable event-window data, a defensible **UNKNOWN** is a correct result;
a fabricated precision figure fails regardless of other strengths.

## Human-scored checklist (0–3 per dimension)

Score both anonymised outputs using the same rubric:

1. **Source authority and event clock:** original issuer/official sources, occurrence and availability distinguished.
2. **Expected-vs-observed:** explicit ex-ante baseline, matched instrument and observation window, no event-tick inference from daily bars.
3. **Explanation quality:** ranked plausible mechanism, countercase, contradictory evidence and unresolved variables.
4. **Next action:** falsifiable confirmation/invalidation, next source to check and relevant asset/timeframe.
5. **Client usefulness:** direct COTD or OB hook, British English, no generic filler, readable aloud, technical/chart claims marked for verification.

`0` = absent/incorrect; `1` = largely generic; `2` = useful with clearly stated gaps;
`3` = independently corroborated and decision-ready within available original evidence.
A hallucinated price, invented primary document, mislabelled metric or false verified status
is an **automatic review failure**, even if the sum is high.

## Repeatability

Store: case ID, input source-packet SHA, clock/timezone, model name, tool list,
source candidate URLs (not assumed verified), factual corrections, analyst edits,
elapsed runtime, 0–3 ratings, and explicit missing-data flags. Do not automatically
write benchmark notes into canonical Evidence, Motion, the Story thesis version,
or public article history.

The new owner-only Investigate endpoint uses **one manually invoked Google
Search-grounded Gemini request** and returns `RESEARCH_LEADS_UNVERIFIED`.
A source link or attribution does not equal independent verification. It cannot
access ChatGPT-only connected plugins unless a separate authenticated server
adapter is deliberately implemented and tested.

## Go/no-go for the next research partition

R2 should add authenticated original-source and matched-window adapters only for
the most material gaps exposed by these cases. Do not add a third reasoning
writer or a new cron. The article writer remains a drafting adapter consuming
research, never the component that manufactures source authority.
