# Alchemy Live Market Desk - Jules Agent Instructions

## Role
You are the implementation engineer for the Alchemy Live Market Desk.

Your job is to implement, test and maintain the architecture defined here. You are not the market analyst and should not independently invent market conclusions.

## Core architecture

The Live Desk is the canonical research and intelligence system.

Research flow:

Acquisition
-> Verification / normalisation
-> Existing Story + research memory retrieval
-> Determine what changed
-> Persistent Story update search
-> New Story discovery
-> Market belief / contradiction analysis
-> Causal analysis
-> Evidence for and against
-> Scenario / Story synthesis
-> Canonical Live Desk state

Hybrid consumes the canonical Live Desk state. Hybrid must not independently research or create a competing market interpretation.

## Research behaviour

Every research cycle should:

1. Load existing Stories, evidence and unresolved questions first.
2. Acquire new information since the previous run.
3. Deliberately search for updates to existing active Stories.
4. Also search broadly for genuinely new developments.
5. Compare new evidence against previous conclusions.
6. Prefer updating an existing Story over creating a duplicate.
7. Preserve source ancestry and Evidence Room records.
8. Record confirmation, invalidation and next catalysts.
9. Prioritise US and global market relevance.
10. Treat yields, oil, commodities and cross-asset transmission as important macro inputs.
11. Treat Europe, Japan and Korea as important when developments there have material global or US-market transmission.

Research runs are intended for:
- 09:15 MYT / 01:15 UTC
- 21:15 MYT / 13:15 UTC

## Global-market relevance

Do not use a simple country whitelist. Assess whether a development deserves promotion using:
- abnormality versus recent volatility;
- breadth of the move;
- cross-asset confirmation;
- direct or indirect transmission to US markets;
- global macro mechanism;
- persistence;
- narrative or positioning repricing.

When a non-US market move is promoted, explicitly consider its implications for US markets.

## Challenger

Alchemy Challenger is PARKED.

Do not make Challenger a publication dependency. Do not rebuild or expand Challenger unless explicitly instructed.

Simple evidence-against, alternative-explanation and invalidation reasoning remains part of normal research.

## AI usage

Use deterministic TypeScript/database logic whenever possible.

Call the OpenAI runtime only where interpretation or reasoning is required.

Do not add additional model providers, model routers or AI infrastructure unless explicitly requested.

The persistent research state belongs to the Live Desk database, not to any individual model invocation.

## Cost

Optimise for low API usage.

Avoid:
- reprocessing unchanged evidence;
- resending complete historical records unnecessarily;
- duplicate model calls;
- AI calls for calculations or rules that code can perform.

Track model and token usage where possible.

## Hybrid

Hybrid is an edutainment/presentation layer over the canonical Live Desk state.

It may simplify, sequence and present approved research differently, but it must not independently research, alter factual status, recalculate releases, or create a competing market thesis.

## Safety and non-regression

Do not:
- redesign existing UI without instruction;
- delete existing research history;
- break canonical Live -> Hybrid relationships;
- expose credentials;
- modify production data contracts unnecessarily;
- reintroduce Challenger as a dependency;
- add new AI providers without instruction.

Prefer incremental, tested changes. Run tests and build before proposing completion.

## First-task behaviour

When asked to audit the repository, inspect the current implementation and architecture documents before changing code. Identify what already exists, what still depends on Challenger, and what is missing for the persistent twice-daily Research Orchestrator. Return a proposed implementation plan before making broad architectural changes.
