# MacroPulse → Composio → Editorial Brain → Bluebelly
**Draft-only rollout · 26 October 2026 · no production migration or secrets applied**

## What has already been proved
- The separate ChatGPT Composio Notion integration can search the existing MacroPulse archive and Research Gap.
- It retrieved the **complete 26 Oct 02:00 MYT** MacroPulse post and **25 Oct 20:40 MYT** Research Gap report, including source links.
- The Gate itself reported **PARTIAL** coverage (8 of 35 eligible posts reviewed; 27 overflow). The bridge must never rewrite this as COMPLETE.
- That ChatGPT Composio connection is **not** automatically a token for Bluebelly's Vercel runtime.

## Bounded implementation
1. **Transport:** Private `POST /api/internal/bluebelly-editorial`; dedicated environment secret `BLUEBELLY_MACROPULSE_INGEST_TOKEN` (at least 32 random nonwhitespace characters). The route is private-host only, `application/json`, bearer-authenticated, no CORS, size-capped and idempotent per source page + digest content. It never invokes a model itself.
2. **Editorial contract:** `bluebelly/macropulse-brief/1`. Provide `sourcePageId` (the exact Notion post UUID), `sourcePulseId` (e.g. `2026-10-26-0200-...`), exact Notion page URL, original publication and retrieval UTC clocks, standfirst, what changed, why it matters, countercase, next test, primary region and 1–8 labelled source URLs.
3. **Storage:** `public.blue_desk_macropulse_briefs` contains only versioned editorial delivery. Unique (page UUID, editorial content SHA256). Ingest creates status `review` only. No `story_thesis_versions`, Market Motion, Dossier, Registry, cron or transcript change.
4. **Owner gate:** Signed-in, active `app_access_allowlist` owner opens private `/owner/daily-report` and loads queued briefs. They open and check originals, temporal/causal qualifications, and editorial copy before separate approval `POST /api/owner/macropulse-briefs`.
5. **Publication:** Approved research digests are presented separately on public Bluebelly homepage and `/daily-report` with the label **MACROPULSE-DERIVED / EDITOR REVIEWED**. They are *not* source-verified News, canonical Story/Regime decisions or PDF reports.
6. **Public read:** Anonymous Supabase SELECT goes through RLS `status='published'` with public-safe column grants. The review queue and service-role writer stay private. If the additive migration is not applied, readers fail to empty state rather than fabricate posts.

## LY editorial brain contract (manual ChatGPT stage)
Read complete Notion full-post content via the active Composio Notion connection. Do **not** summarise a day archive's directory stub or the last Gate manifest as though it were a full post.

For each eligible material Pulse (not SKIPPED):
- Use only claims actually supported by the retrieved Pulse text; cite the original links captured there, not invented URLs.
- Lead with the real market event; use plain British English, short paragraphs, one market-relevant angle, no hype or robotic framing.
- Explain the physical/economic causal chain in readable terms; describe **observed price action** only with exact session, units and observation timestamps available. No market reaction if the Pulse says UNKNOWN.
- Separate original publisher statements from independently observed market measurements, third-party reports and social leads. Never turn a cumulative total into a daily rate, a hypothetical into a trade, or an allegation into an occurrence.
- Include the strongest contradicting evidence, the next source to check and the falsifier. Do not infer a Story/Regime transition.
- Every output is **research-derived/unadjudicated**. The model may not set `verificationLabel`, `status`, `storyDecision` or canonical evidence IDs.
- Do not publish automatically until we have source-coverage, idempotency, reviewer and rollback evidence.

**Fixture:** `tests/fixtures/macropulse-centcom-bluebelly-digest.json` is one source-derived working example from an actual 02:00 Pulse. It is **not** a published article and its simulated retrieval timestamp is for deterministic tests.

## Post-merge Composio backend handoff (NOT yet configured)
- Configure a server-side Composio workspace/Notion connection with authorised access to the exact MacroPulse parent and Research Gap data source. The existing *ChatGPT-side* connection cannot be transplanted invisibly.
- Have an existing research workflow or a Notion content trigger invoke a narrow transformer. Confirm Composio Notion trigger support and complete post fetch, including child blocks, before relying on it.
- Transformer emits only the reviewed v1 JSON contract, then posts it to the private URL using the **dedicated** bearer secret. Never put this secret in a Notion page, GitHub file, URL query string, browser JS or model prompt.
- Deduplicate by immutable source page ID and content hash. Preserve the slot's original source timestamp and separately log ingestion/review clocks.
- If Notion is unavailable, return coverage failure. Do not recycle yesterday's post as breaking news.
- A user-approved manual run from ChatGPT can prepare this JSON and submit through an explicitly authorised delivery tool; installing the ChatGPT Composio connection alone does **not** enable server-side HTTP delivery.

## Acceptance before production
- Apply the additive migration to an isolated database or approved target, with database-contract CI success.
- Set `BLUEBELLY_MACROPULSE_INGEST_TOKEN` for private Preview only, confirm unauthorised 401, missing token 503, invalid 422, valid 202, duplicate 200, wrong host 404.
- Confirm owner authenticated review, row promotion only after all three explicit checks, no browser write grants, reader visibility **only after approval**.
- Verify the real 26 Oct Pulse's dated source links, source-vintage corrections, countercase and qualifications in rendered Bluebelly.
- Then arrange an authorised Composio trigger/backend credential for unattended delivery. No new scheduled research task.
- No approval or production release is implied by this draft PR.
