# Blue Desk V6 P−1 — gated public Story evidence contract

**Status:** staged, **not publicly exposed**; release gate #834 remains open. 20 October 2026.

## Why a new projection is needed

The old `dossier-presentation/1` and `market-intelligence-snapshot/v1` responses contain nested source diagnostics, research gaps, Dossier memories, calibration, thesis-change metadata and other owner-focused fields. Hybrid Journey and Live mobile have real consumers of these legacy contracts. Blocking the old routes or spreading their payloads into V6 would either break callers or publish unapproved data.

The separately versioned pure `blue-desk-public-story-evidence/1` builder admits only exact edition-pinned, directly source-linked first-tier facts *already admitted by the existing editorial reader*. This builder is **not an endpoint, route, published permission decision, or System 2 reasoning path**. It imports no database client.

## Fields which could eventually be published (pending licences and approval)

| Field | Provenance and constraints |
| --- | --- |
| `contractVersion` | fixed string |
| `editionId`, `articleId` | exact UUID-bearing archived Story identity; no fallback to latest |
| `publishedAt` | immutable edition publication timestamp |
| `interpretation`, `storyAdmission` | `UNRESOLVED / NOT_ADJUDICATED` unless exact article has existing canonical approval |
| `evidenceAvailability`, `facts[]` | at most 12 unique canonical evidence UUIDs; original direct HTTPS URL; issuer claim, source name and availability <= edition timestamp |
| `marketReaction`, `causalAttribution` | explicit `NOT_VERIFIED`, null observation/explanation; no Dossier causal extrapolation |
| `confirmation` | `NOT_ADMITTED`, empty list; do not forward internal research tasks |
| `unavailableReason` | explicit source-gap reason when no qualifying record |

**Excluded by construction:** raw Dossier, research gap, diagnostic, creator verification, memory, source tier, unfiltered provenance arrays, thesis versions/changes, unpublished causal links, rendered reactions and arbitrary parent-object properties. Unit tests inspect exact output keys and check blocked names.

## Exact archived acceptance fixture

- Frozen 19 October AI edition: `fcea17ef-f575-4283-a363-7d5fa9c918c7`.
- Story: `6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e`.
- Four independently sourced original issuer claims: two TSMC Q3 2026 reported numbers, two CoreWeave Q2 2026 cash/capex observations, direct issuer URLs.
- No accepted canonical Dossier UUID for this edition; resulting interpretation **UNRESOLVED**, not a completed AI financing causal mechanism.
- Rates CPI/yield reversal and crude backwardation have **zero** direct qualifying first-tier claims in this edition; display source gaps rather than reconstruct a Story thesis from nearby mutable versions.

## Remaining release requirements

1. Resolve public redistribution permission for each issuer/original-source excerpt and final legal/product approval for each allowed field.
2. Prove exact provider source timestamps and claims on a second current live edition; do not automatically enrich an older edition with later rows.
3. Decide whether the V6 route belongs to its own Vercel public project or a new path on an approved host. Bluebelly's existing middleware blocks all `/api/*` routes. **Do not weaken that allowlist blindly.**
4. Before *exposing*, add HTTP black-box tests that reject extra fields, arbitrary edition IDs, unapproved owner content and malformed URLs; retain legacy Hybrid/mobile APIs until migrated.
5. Positive owner OAuth/expired-token tests, positive machine bearer tests and the platform-owned `supabase_admin` default-privilege issue #849 remain outstanding.

**No DB migration, no new thesis-version write path, no Motion-as-evidence promotion, no production API change.**