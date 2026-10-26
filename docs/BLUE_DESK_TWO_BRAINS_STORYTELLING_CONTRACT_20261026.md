# Blue Desk private briefing — two desks, one evidence packet (26 Oct 2026)

## Decision
Use existing owner-only `/owner/daily-report` and `/api/owner/editorial-generate`. No new scheduler, reasoning engine, canonical table, evidence-admission writer, or public publication. A generator draft is for **owner's own reading only**.

The two desks are roles in one workflow, not separately deployed agents:
1. **Research desk:** the established `/api/owner/daily-research` assembles the current MacroPulse/Research Gap, source-verified News, market observations, calendar and attributed editorial delivery with coverage health. It returns one editable source-dated packet, clearly marking gaps and independent verification limits.
2. **Storytelling desk:** the established authenticated Gemini draft route uses the same packet and `privateNarrativeInstructions(kind)`, formatting its supported contents chronologically. It cannot fetch new market facts or change canonical Story, Regime, Dossier or evidence.

## One read-aloud brief

- **Opening:** one concise big picture grounded in the packet.
- **Setup:** one dominant catalyst, what actually happened, original source and event time.
- **Numerical reveal:** one or two meaningful comparisons, with source, window, unit, previous and latest value. Explain what a number means rather than just reciting it.
- **Teaching moment:** a real-world borrower, business or shareholder, then the economic chain from catalyst to expectations, funding, cost/demand, named assets and observed reaction (or UNKNOWN).
- **Catch:** strongest rival explanation, incomplete source coverage or contrary market behaviour.
- **Next decision:** conditional bull/bear pathways and source-dated falsifier: "what would change my mind".

Follow with up to three supporting stories only when substantive and evidenced. Prefer conversational British English and paragraphs of one to three sentences over rigid sections. COTD remains chart-led; Opening Bell remains news/catalyst-led.

## How comparisons should work

**Illustrative teaching prompts only, NOT current validated market readings:**
- If a hypothetical CCC credit spread changes 1,307 to 1,340 basis points, that's +33 bp; if broad high yield changes 327 to 340 bp over the same window, that's +13 bp. Explain why the lower-rated segment's premium widening faster may matter to a borrower refinancing debt. Never equate a credit spread with total yield or attribute the move to a specific news event without matched evidence.
- If a *properly source-matched* daily flow measurement moves 9.75 to 11.70 million barrels per day, that's +1.95m bpd (+20%). Explain what this does or does not establish about physical shipping; AIS crossing counts are not barrels, and one recovery does not prove full normalisation.

Those numbers are examples of arithmetic and storytelling only. The generator is **not provided** with them as source facts; it must only use figures explicitly present in its current packet with matching as-of/source details.

## Guardrails and proof

- All source material is attributed as primary evidence, observed market data, reporting or social/Notion discovery. The model cannot upgrade a research claim to verified/canonical.
- Verified price reaction and hypothetical mechanism are separate statements, with like-for-like timing and contract definitions.
- Never make a past earnings report an upcoming event. Calendar dates and market sessions must not be inferred.
- Incomplete Research Gap inputs stay incomplete, including overflow; UNKNOWN cannot be coerced into zero.
- The user must review model-generated prose. Copy/export is personal; no automatic public publishing or DB writes.
- The pre-existing source-health panel and selected original-link review remain. No silent switch to Live Desk canonical output.
- Technical-chart statements require actual supplied chart measurements. No invented EMA level or trading call.
- The Live/Bluebelly front-end story cards are separate from this owner-only Daily Report path.

## Source reference
User supplied an example from a private ChatGPT Live Desk conversation on 26 October 2026. Browser access to that exact conversation was unavailable at implementation time; the narrative requirements above are based on the user's previously established preferences and recovered example details, **not a verified verbatim transcript**. The sample's numerical comparisons must be separately sourced before being used as live facts.

## QA
`tests/blue-desk-narrative-playbook.test.ts` covers story spine, exact private generator use, format separation, financial-unit discrimination, and no automatic publication. Runtime Gemini quality and actual live input coverage require a signed-in owner draft and source review; CI cannot establish those.
