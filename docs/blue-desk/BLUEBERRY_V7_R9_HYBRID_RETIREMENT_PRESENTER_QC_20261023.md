# Blueberry V7 R9 — Retirement of duplicate Hybrid UI and native editorial QC

23 October 2026. Review-only preview stacked on R8.

The primary nav now displays Change Ledger instead of Hybrid Feed. Existing Hybrid feed route, independent legacy Hybrid app, machine API, Story/Dossier archive and owner Presenter remain intact. Do not delete before functional and permission cutover.

Owner-only Change Ledger is based on exact existing Dossier decisionPacket, thesisChanges, reaction watch, researchGaps. It never creates probabilities, reports a thesis mutation based on Motion context or writes to story_thesis_versions.

Owner-only Presenter editorial reads the exact pinned immutable daily brief and frozen Dossier using the existing Presenter selection/source/editorial readers. COTD lane shows existing original-source reporting, explicitly labelled interpretations, missing chart/length verification, and signoff requirements. OB lane shows existing cross-market Story material, expectation tests and MATERIAL blockers. They are source packs, NOT final full articles.

The local browser writing editor for COTD and OB supports actual draft text entry, character/word/paragraph/banned phrase/URL-presence checks and Copy. Text is NOT saved or sent; UI checks do not establish source validity, rights, chart authenticity or author approval.

Retain current research jobs; there is no parallel researcher, extra task or publication path. Dossier stays canonical analytical history. COTD and OB require source re-verification, LY editorial QC and explicit final human approval.

Acceptance: CI green, Vercel preview READY, protected owner and unauthorised/public tests, 360/768/1440 UI, current/old exact edition, degraded Dossier, no Motion-as-evidence, no duplicate publisher. Exact-branch vercel.json preview exception MUST NEVER merge to main.
