# Bluebelly Ocean Editorial — Stories Investor Test (P2 first vertical slice)
27 October 2026. Supersedes only the Story presentation portion of earlier V6/V7 proposals; **no second design system, service or page.**

## Purpose
Make the existing `/key-stories` useful without making every archived canonical research paragraph compete for attention. PowerStack's practical "what would I do next?" hierarchy translates here into "What is the investor underwriting, who pays, what could go wrong and what changes the decision?"

## Shipped bounded slice
- Server-side read-only `selectFlagshipInvestorTest` picks a **genuinely populated** canonical historical Story (AI/funding relevant when available). It never invents a current Story, valuation, company-specific funding terms or live market reaction.
- One editorial flagship `InvestorTest` is rendered within existing `app/blue-desk/key-stories/page.tsx`, using real `thesis`, `support`, `contradiction`, `pricedAssessment`, `nextTest` or `invalidation`. Missing pricing is labelled, not filled.
- Four reusable explanatory dimensions: the opportunity, who funds it, the downside, and the condition changing the view. Hypothetical questions are visibly **questions**.
- Eye-level visual refresh only within Stories: ocean-blue editorial masthead, display typography, readable 2x2 question layout, richer spacing. Existing brand, colour vocabulary, navigation, domain and mobile behaviour retained.
- Existing historical research archive remains fully accessible but card detail is moved into native `details`, reducing the 24-record wall of text without new routes.
- The current original-source updates and upcoming event lane remain separate. The flagship is identified as historical research, not new market news.

## Not changed
- Canonical Dossier/System 2 and `story_thesis_versions`; any immutable edition or historical replay; market price API/observations; research jobs and provider receipts.
- Linked creator transcripts or their evidence authority; automated PDF generation or owner Report/Presenter work; Vercel secrets and Supabase.
- No top-level Investor Test page or Deal Room, new cron, LLM inference, private data exposure, or fake trading verdict.

## Next gates
- CI full suite, DB-contracts, build; actual Vercel READY.
- Browser desktop and mobile review after deployment: hero and archive readable, keyboard opening details, dark colour contrast, stable anchor to full Story.
- Compare against the V6 mockup's whale/underwater visual language and PowerStack's decision hierarchy. The next independent PR can harmonise Today/Briefings with these **same components** after PDF PR #1055 stabilises. No parallel edit to PDF module.
- Use actual canonical evidence UUIDs and as-of proof before labelling a support paragraph "verified". This first read-only feature cannot transform the stored thesis into a fully sourced investor recommendation.

## Kill conditions
If the current Story ledger contains no thesis with support, material countercase/invalidation and a next test, the flagship is **omitted**. The Story archive and upcoming source calendar still work. Never fill missing requirements with a pre-written example or a synthetic investor score.
