# Bluebelly Newsroom — isolated P2 lens slice (27 October 2026)

Branch: feat/bluebelly-newsroom-lenses-20261027
Owner: Newsroom track. Merge owner: Bluebelly single-site consolidation track.
No deployment or changes to existing Today/Stories, shared navigation, report workers, authentication, cron, provider adapter, canonical Story or Supabase.

## Delivered

- lib/blue-desk-newsroom-lenses.ts — deterministic read-only topic projection from the already-admitted NewsBriefV1 public source-verified contract. It is NOT a source intake or verification system.
- components/blue-desk/NewsroomLensExplorer.tsx and NewsroomLensExplorer.module.css — accessible responsive interactive topic selection. Keeps exact original publisher headline, summary, dates and source URL. Shows explicit coverage/empty states.
- tests/bluebelly-newsroom-lenses.test.ts — checks freshness, unique identity, multitag, source provenance, verification, invalid input, no fabricated price reaction and accessibility contracts.

## Boundaries

Three filters: ai-innovations, geopolitics-bonds, stocks-trading.

A report may appear in more than one lens with the SAME source ID, but the topic classification is not another piece of evidence. Original facts continue through existing independent news; persistent Story reasoning remains System 2 controlled.

The projection requires the existing news-brief/1 type, SOURCE_VERIFIED, original valid HTTPS source, an event no older than the existing 48-hour window and neither inverted nor future event/observation timestamps. Empty lanes disclose missing qualifying coverage, not market inactivity. Unmatched events remain in the ordinary Live News feed.

The question displayed for each lens is a PROMPT FOR RESEARCH, not a factual market conclusion. A source fact does not prove a price reaction or causation. Creator transcripts and Shark Tank reasoning remain hypothesis generators upstream. Do not seed a sample Kimi headline as purported verified live data.

## Exact safe integration — owned by Chat A

Today already computes:
  motionNews = selectVerifiedNewsBriefs(verifiedMotions, now, 12)
  verifiedNews = combineQualifiedNews(motionNews, originalPress, 12)

Stories already computes:
  motionNews = selectVerifiedNewsBriefs(raw, now, 18)
  news = combineQualifiedNews(motionNews, originalPress, 18)

Use this import within the existing Today or Stories page AFTER Chat A has completed any concurrent shared-page modifications:

    import NewsroomLensExplorer from "@/components/blue-desk/NewsroomLensExplorer";

In Today, mount this into existing JSX at an editorially appropriate point:
    <NewsroomLensExplorer news={verifiedNews} asOf={now.toISOString()} />

Or in Stories using:
    <NewsroomLensExplorer news={news} asOf={now.toISOString()} />

Choose one main placement first, check layout and mobile, and avoid duplicated cards from mounting the identical feed in both places unnecessarily. DO NOT issue a second source query, create a top-level route or modify BlueDeskHeader. Do not race another branch's page edits; merger/integration is owned by the single-site consolidation chat.

## Acceptance before production

1. Run node --test --experimental-strip-types tests/bluebelly-newsroom-lenses.test.ts. In CI run full npm test, TypeScript and Next production build.
2. With a production-like independently source-qualified live AI report, verify the ORIGINAL issuer headline, source URL and event date render under AI. Do not invent a Kimi live update from Fireship. If no such report exists, show the genuine empty state.
3. One report tagged AI + geopolitics retains ONE original ID and no new canonical Evidence UUID.
4. Inspect 320px mobile and desktop, keyboard buttons, source links, event clocks and no private data.
5. Verify existing private PDF/auth and earnings calendar routes remain unchanged; no added schedules.

## Workstream boundaries

A (consolidation) owns Today/Stories page wiring, public/private hosting, auth, header/nav and legacy retirement.
B (PDF) owns source receipts, report compiling/generation/storage; do not modify PDF workers.
C (Newsroom) owns the new pure projection and reusable reader until integration by A.
Existing Calendar owns earnings expansion, not a duplicate Earnings page or provider.

Bluebelly retirement must still wait for authenticated, real source-checked PDF generation and exact historical-link parity.
