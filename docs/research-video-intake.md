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

## Transcript gate

For every new or materially relevant video:

1. Discover the video from the channel's official uploads page and record the channel, video ID, URL and publication time.
2. Obtain the full transcript before using the video as evidence. Prefer an official YouTube transcript/caption when it is accessible. If that is unavailable, use the configured transcript fallback such as YouTubeToTranscript.com.
3. `transcriptStatus: "ready"` is valid only when `transcriptText` contains the transcript. A title, description, chapter list, thumbnail text, comments or search-result summary is not a transcript.
4. If a transcript cannot be retrieved, mark it `missing` or `unavailable`. The video may be logged for awareness but must not affect a Story or recalibration until a transcript is ready.
5. Treat creator reasoning as a hypothesis. Independently verify material claims against primary data, filings, official releases and directly verified market data before changing canonical research state.
6. Research unfamiliar jargon or mechanisms raised by a creator before evaluating the claim.
7. Deduplicate by channel identity plus YouTube video ID across research runs.

The research-update validator enforces the transcript gate: retained video evidence without a ready transcript is blocked from Story recalibration.
