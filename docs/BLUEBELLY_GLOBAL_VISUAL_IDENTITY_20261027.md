# Bluebelly shared visual identity and typography · 27 October 2026

## Canonical design rules

- **Figtree is the root application font.** Loaded once via \`next/font/google\`, self-hosted by Next at build time and inherited by both public Bluebelly and owner screens. Only source-code/text blocks keep their monospace type.
- **An entity icon is identity, not evidence.** Tickers, canonical geography and issuer-admitted assets may be displayed. Never infer a company's relevance from an article headline, fill an empty Story with guessed subjects or equate an icon with market transmission.
- **Single reusable entry:** \`components/blue-desk/EntityIdentity.tsx\` with \`EntityMark\`, \`EntityChip\`, \`EntityStack\`, \`ScopeStrip\`, \`EntityRow\`. Registry \`lib/bluebelly-entity-identity.ts\`. Optional icons stay absent when an asset identity is missing.
- **Mark hierarchy:** company = approved issuer-domain favicon with an automatic neutral monogram fallback; country = circular flag ball; institution = country-linked institutional identity where recorded; commodity/index = compact asset glyph. Country-pair stacks only when BOTH parties are explicit in source metadata.
- **Sizes:** xs 22px for compact tables; sm 30px for tiles; md 38px for feature cards; lg 46px for hero. Avoid marks inside long body paragraphs or repeating the same mark in every nested child.
- **Color:** use existing Bluebelly navy; cyan for macro, violet for earnings, gold for geopolitics, steel blue for product/AI. Do not convert unconfirmed status into an urgent color.
- **No data contract mutations:** visual metadata reads existing source-authored asset arrays and published source data. Article projection adds an optional read-only \`affectedAssets\` field from already-recorded Story assets; no new evidence assertion, Story writer, scheduler or database table.

## Route and component rollout

| Surface | Implementation | Provenance |
| --- | --- | --- |
| Global public + owner typography | Next root layout + globals + page/editorial CSS | Identical type, no changed access policy |
| Calendar + Catalyst Radar | Shared country/company marks | Source-qualified event, no inferred time |
| Earnings week grid | Same issuer logo and fallback | Confirmed release-session rules unchanged |
| Public Markets and Treasury yield chart | Source symbol → deterministic mark | Original date/market measurements unchanged |
| Homepage US rates and upcoming cards | US sovereign icon and affected-asset scope strip | Source-listed assets only |
| Key Stories upcoming decision cards | Source affected-asset scope strip | Context, not causal evidence |
| Historical Deep Dive | Optional exact-edition source-authored asset strip | No content inference or edition mutation |
| Private Presenter price table | Shared symbol marks | Same protected owner view and dated comparisons |
| Research Library | Curated editorial topic marks only | Raw Notion research is not automatically entity-tagged |

## Later adapters (not fabricated in this pass)

- Company logo for **unrecognised tickers** requires a new verified issuer domain; until approved, use neutral ticker monogram.
- Country-pair marks for peace/ceasefire events require each participant's explicit country code. Do not infer from a conflict title or geopolitical geography.
- Creator transcripts need explicit per-video entity/issuer tagging from admitted transcript metadata. Do not create topic claims from unverified transcript text.
- Public evergreen Story ledger lacks a canonical exposed entity list. Do not fabricate a scope strip from a Story title.
- Extended country identifiers and third-party icon packs require licence and contrast review.

## Acceptance

Run \`npm test\`, typecheck and production Next build in repo validation. Smoke-check public routes \`/\`, \`/markets\`, \`/calendar\`, \`/key-stories\`, \`/daily-report\`; owner routes remain private and unchanged. Confirm favicon failures fall back without layout shift, exact-times remain source-bound, and Google font loading does not block release.
