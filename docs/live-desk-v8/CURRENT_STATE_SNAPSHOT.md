# Current Production and Repository Snapshot

## Inspection date

6 August 2026, Asia/Kuala_Lumpur.

## Production

- Domain: `alchemy-live-market-desk-rogue-magazine.vercel.app`
- Vercel project ID: `prj_mHZ3Tosmi2iHCFthG4Eok8BLnWlq`
- Production branch: `main`
- Framework: Next.js
- Latest inspected production state: READY
- Inspected production commit: `221cc74474c49759642a9cca9e9a4220d6b1e818`

This is a point-in-time snapshot. Deployment metadata may be newer when implementation begins.

## Current application shape

The production application is still a single large client workspace centred on `components/MarketWorkspace.tsx`.

The initial server page loads the main desk data, Alchemy articles, market data, economic calendar and accuracy report, then passes them into the workspace component.

The current client navigation contains sixteen flat tabs:

- Overview
- Market State
- Research
- Stories
- Articles
- AI News
- Oil
- Breadth
- Macro
- Calendar
- Guidance
- Statements
- Signals
- Earnings
- Charts
- Ledger

The tab state is client-side and can be requested through the `tab` query parameter.

## Existing assets that should be reused

The current application already has useful data contracts for:

- Stories;
- updates;
- chart requests;
- Alchemy articles;
- earnings calls;
- guidance;
- macro releases;
- public statements;
- news threads;
- research sources;
- Story evidence and coverage;
- research registry and rollout;
- macro observations;
- market observations and state records;
- research runs and intake;
- economic calendar events;
- market data and accuracy checks.

It also has specialist runtime components for economic calendar, earnings, market state, macro-series charts, relationship charts, research monitoring and COT positioning.

## Visual compatibility

The existing CSS already uses the core V8 identity:

- deep purple page background;
- rounded dark panels;
- violet and aqua accents;
- dense workspace cards;
- restrained institutional typography.

V8 should therefore be treated as an information-architecture and component-composition refactor, not a total brand replacement.

## Main structural problem

The current product exposes almost every module as an equal top-level tab inside one client component.

This creates:

- navigation overload;
- weak hierarchy between intake, persistent research, data and audit functions;
- difficult route-level loading and ownership;
- a component that is expensive to change safely;
- limited deep-linking to a specific release, Story, article or evidence record.
