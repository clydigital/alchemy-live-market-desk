# Bluebelly visual-status clarity audit · 14 November 2026 (MYT)

## Objective
Make essential direction, operational uncertainty, source freshness and decision
readiness readable in under five seconds, **without** turning a market proxy, a
news headline or a research lead into a canonical Regime/Story/trade verdict.

## Evidence and reach
- Inspected current public-page content of `/`, `/markets`, `/key-stories`,
  `/newsroom`, `/regime-watch`, `/hormuz`, `/calendar`, `/research`,
  `/learn`, and `/crash-opportunity`; inspected associated source components and CSS.
- Public `/power-stack`, `/my-reports`, and `/market-tools` visits redirected to
  sign-in. Their authenticated screens were **not** visually inspected; source
  review was available for Power Stack's owner-only decision hub.
- `/whats-new`, `/regimes`, `/stories`, and `/data/macro` return 404 on this
  public hostname. Historical/internal route status is not itself evidence
  of a regression and needs a separate navigation and routing check.
- Prices/quotes in these screens have differing source-session clocks. Colour
  applies to **a named observation**, and never carries across unmatched clocks.

## Implemented in this PR

| Surface | Before | Change | Guardrail |
| --- | --- | --- | --- |
| Market Compass: top Risk-On/Mixed/Risk-Off selector | The selected cell always used cyan | Risk-off red, risk-on green, mixed amber and missing neutral | Still an ordinal 1D four-ETF read, not a fundamental Regime |
| Market Compass: five market checks | Every blue card looked equally benign | Semantically tinted borders/backgrounds, directional text, source scope/date and legend | Higher rates/oil = pressure; higher chips/breadth = strengthening proxy |
| Homepage Market Conditions | Six cards shared one accent, despite opposing outcomes | Four market proxies and jobs/source-coverage fractions get sign-aware colour plus explicit state label | Jobs = share of sectors; source health = retrieval coverage, not source credibility |
| Homepage Decision Whiteboard | “Defensive equity session” had same background as unrelated news/thesis/catalyst | Only the market-tape cell gets a risk-coloured state label | Other cells intentionally remain neutral; editorial text not scored |
| Power Stack owner-only candidate queue | Financing-risk and pending-confirmation cards were visually identical | Red material risk, amber pending validation, grey research-only status | **No green / buy** classification when 0 trade triggers are verified |

## Remaining page-by-page findings and priorities

| Priority | Surface | Finding / next precise fix |
| --- | --- | --- |
| P1 | Newsroom | Source-verified, source-reported, editorial and archived cards can look similar. Add a provenance stripe + timestamp/state key to the feed, distinct from directional opportunity colours; do not treat “source verified” as “bullish.” |
| P1 | Key Stories | Lead is prominent, but topical follow-ups, dated manual research and provisional incident cards share near-identical neutral styling. Visually separate **confirmed fact / reported event / hypothesis / stale incident**, not arbitrary sentiment. |
| P1 | Calendar | Current coloured lanes distinguish Fed, earnings, diplomacy and energy **category**, not confirmed/upcoming/time-unknown or surprise direction. Add a second independent status chip with distinct geometry; keep category colours intact. |
| P1 | Markets | Table price changes and sparklines already colour raw **up vs down**. Yield increases are not equivalent to stock gains. Add an explicit per-class interpretation key and stale-data status above table; avoid recolouring raw price changes as investment advice. The very long catalogue should not displace the primary watch table. |
| P1 | Hormuz | A useful separate diplomacy/physical-safety assessment and source-dated evidence already exist. Add one slim side-by-side scorecard with last-reviewed state and freshness so contradictions are legible without scrolling; never imply a peace probability. |
| P2 | Crash vs Opportunity | Three different source/review/shadow clocks and a long scenario narrative are well caveated but visually dense. Put the **observed / contested / unmeasured** evidence triage above the long text, explicitly source-dated. |
| P2 | Research Archive | Archive stories are deliberately historical, not current. Add an archive-vs-current reading banner rather than green/red market judgements. |
| P2 | My Reports / private workspaces | Needs authenticated visual inspection to identify which report cards, review queues and data-readiness states are still monochrome. Do not change owner permissions or simulate access. |
| No change | Learn | Reference/index content: directional market colours are not appropriate. |
| No change | Sector price charts | Existing red/green on exact returns is legitimate as **raw price direction**, but should not be reused to claim a positive/negative fundamental thesis. |

## Shared style contract
- **Green**: less pressure or improving **named** observation, or complete source checks when explicitly scoped.
- **Red**: more pressure, deteriorating **named** observation, or material verified research risk.
- **Amber**: mixed/flat/partial coverage, or research awaiting an explicit deciding trigger.
- **Grey**: unavailable, stale, not comparable or research-only with no current directional measurement.
- Every colour carries visible text, source date/time window and scope; colour alone is insufficient for accessibility.
- The source layer is immutable here: no new scheduler, canonical Regime scoring, automated portfolio recommendations or trade execution.

## Verification
- Repository unit/type/build and public-page visual smoke must pass.
- Verify exact merge SHA reaches Vercel production READY, then uncached readback of
  `/`, `/regime-watch` (the five Market Compass cards) and the public Regime lens
  evidence surface. Authenticated Power Stack cannot be asserted visually without a valid owner session.
