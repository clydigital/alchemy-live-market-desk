# Bluebelly Global Visual Identity — Hybrid lessons and compatibility contract

**27 October 2026 · Source reviewed:** `components/live-desk/LiveDeskUi.tsx`, `components/live-desk/live-desk-shell.module.css`, `components/live-desk/MarketMotionOverview.tsx`, `components/live-desk/HybridStoryBriefReader.tsx`, the public Bluebelly page components, the V6 supplied visual references, and the existing Branch 04 UX gap register.

## What Hybrid actually did
- **Evidence/status:** `Badge` and `DataState` intentionally separated `ready`, `warn`, `risk` and default; supporting, challenging and next-test records were grouped as distinct reading tasks. These are UI classifications, not factual verdicts.
- **Information hierarchy:** `Panel`, `MetricGrid`, status summary and detail cards made a crowded research page easier to scan. `MarketMotionOverview` used primary/secondary attention, region filters, ticker strips and careful qualification of Motion as non-evidence.
- **Colour:** purple was the old shell identity, mint for supported/ready, amber for unresolved/review, coral for risk. Distinct background and border tint communicated status without changing the underlying data.
- **Limitation:** the legacy purple treatment and repeated badges can get visually noisy. Copy grouping and epistemic boundaries, not the legacy navigation, brand palette or evidence-writing paths.

## Bluebelly standards implemented here
1. **Figtree first:** loaded once in `app/layout.tsx`, self-hosted through Next font build, exposed as `--font-figtree` and `--bb-font-sans`; the main Bluebelly, public report and editorial CSS use it. Controls and SVG labels inherit it globally. No font binary committed to the repository.
2. **Shared identity registry:** `lib/bluebelly-entity-identity.ts` is explicit and display-only. Unknown ticker/country never maps to an invented company/nation. EU label is EU, DAX maps to Germany, country balls are emoji circular marks, and only known issuer domains are candidates for favicons.
3. **Reusable display components:** `EntityMark` (country / issuer / neutral asset), `EntityChip`, `EntityScopeStrip` and `ResearchStatus` are in `components/blue-desk/EntityIdentity.tsx`. Favicons fail closed to text; bounded scope strips deduplicate and cannot invent market relationships.
4. **Different dimensions of colour:** *identity* comes from an issuer or geography, *market category* from macro/earnings/tech/energy/diplomacy, and *research status* uses separate ready/warn/risk treatments. Neither colour nor icon is proof of source verification, causal transmission, live price or Story mutation.
5. **Incremental applications:** existing public Calendar and Earnings Hub, Markets table rows, homepage upcoming events, Story Desk upcoming decisions, and Daily Report forward-watch tiles all use the component. Existing core `MarketIcon` sprite remains for generic action, sector and navigation icons.

## Next candidate destinations — audited but not blindly modified
| Priority | Surface | Reuse | Evidence boundary |
|---|---|---|---|
| P1 | Global Rates Watch, rates charts, private presenter 2Y–30Y checks | `EntityMark(country)` / currency-region tags | Do not pretend a sovereign-index proxy is a national issuer share |
| P1 | Private `/owner/presenter` chart checks and talk slate | `EntityScopeStrip` on existing *explicit* technical instrument keys | Never put private chart notes in public bundles |
| P1 | Markets grouped watchlist and AI component detail | `EntityMark(company)` + source-status labels | No made-up logo for non-equity baskets or private issuers |
| P2 | Newsroom / latest factual headlines | `EntityChip` only from approved publisher/subject assets | A named company in prose is not itself a verified impact |
| P2 | Story detail and historical editions | Scope strip from canonical `subjectAssets` or equivalent approved read model | Do not derive new Story/Regime linkage from decorative tags |
| P2 | Creator transcripts | Creator/source mark distinct from company mention marks | Transcript claims stay hypotheses until canonical verification |
| P3 | Glossary / Learn / Data Library | Sparse section glyphs and country mark where concept is location-specific | Educational concepts do not imply a live event |

## Safety and architecture invariants
- Visual components may **read** public identity strings; they must never write `story_thesis_versions`, `market_events`, Supabase rows, editorial content or evidence.
- No extra scheduler, ingestion pipeline, API, database reasoning table, canonical Story version path, model route or authentication change.
- Preserve Bluebelly public-read host restrictions, Google owner login, `/owner/presenter`, legacy machine-facing APIs and exact immutable edition reads during retirement.
- Keep BMO/AMC separate from earnings-call time, dated market observation separate from published news, and off-calendar leads separate from confirmed appointments.
- Visual regression: mobile, dark contrast, fallback logos, keyboard focus, UTC/MYT not impacted, and old source links.
- Use the existing first-party `MarketIcon` glyph set for generic topics; entity icons are *supplemental*, not a replacement for that existing coding bank.

## Acceptance
Run full `Validate Live Desk` (tests, typecheck, production build), database contracts; verify production deployment and a public reader route plus a private route access gate. Report deployment and visual smoke as separate proofs, never conflate a passing CI with runtime source freshness.
