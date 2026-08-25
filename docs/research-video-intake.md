# Research video intake

The Live Market Desk owns creator-video discovery and transcript-gated intake. Hybrid consumes only validated Live findings.

## Required YouTube channels

- FX Evolution — https://www.youtube.com/@fxevolutionvideo/videos
- Trade Brigade — https://www.youtube.com/@TradeBrigade/videos
- Kevin Gerrity — https://www.youtube.com/@Kevin.Gerrity/videos
- ClearValue Tax — https://www.youtube.com/@clearvaluetax9382/videos
- StockedUp — https://www.youtube.com/@StockedUp/videos
- Wall Street Truthbombs — https://www.youtube.com/@wstruthbombs/videos
- TraderNick — https://www.youtube.com/@TraderNick/videos
- Traders Reality — https://www.youtube.com/@TradersReality/videos
- Beginner Trading — https://www.youtube.com/@BeginnerTrading/videos
- Eurodollar University — https://www.youtube.com/@eurodollaruniversity/videos

## Current automated transcript budget

Creator discovery remains broad, but automated Supadata transcript spend is deliberately restricted to:

1. StockedUp
2. Kevin Gerrity
3. ClearValue Tax

Only non-live uploads from those three channels enter the Supadata transcript path. Current, upcoming and archived livestreams are classified from YouTube video/live-stream metadata and are excluded before a Supadata request is made.

Supadata is called with `mode=native`, `text=false` and `lang=en`. `mode=auto` and `mode=generate` are not permitted in scheduled Live intake. If an existing caption track is unavailable, the item remains blocked/revalidatable; Live does not ask Supadata to generate a transcript with AI.

The provider credential is server-side `SUPADATA_API_KEY`. Persist provider provenance as `supadata`, while transcript metadata records `transcriptSource: native_caption` and the returned billable-request count when Supadata supplies it.

## Transcript gate

For every video admitted to transcript intake:

1. Discover the video from the channel's official uploads feed and record the channel, video ID, URL and publication time.
2. Classify whether it is a livestream. Livestreams do not enter the automated transcript provider path.
3. Obtain the full existing caption transcript before using the video as evidence. Scheduled Supadata intake must use `mode=native`; it must not trigger AI transcript generation.
4. `transcriptStatus: "ready"` is valid only when `transcriptText` contains genuine transcript text. A title, description, chapter list, thumbnail text, comments or search-result summary is not a transcript.
5. If a native transcript cannot be retrieved, mark it `missing` or `unavailable`. The video may be logged for awareness but must not affect a Story or recalibration until a transcript is ready.
6. Treat creator reasoning as a hypothesis. Independently verify material claims against primary data, filings, official releases and directly verified market data before changing canonical research state.
7. Research unfamiliar jargon or mechanisms raised by a creator before evaluating the claim.
8. Deduplicate by channel identity plus YouTube video ID across research runs.

The research-update validator enforces the transcript gate: retained video evidence without a ready transcript is blocked from Story recalibration.
