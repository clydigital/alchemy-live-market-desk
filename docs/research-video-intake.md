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

Creator discovery remains broad. The transcript work list has a fixed maximum
of six long-form uploads per run, in this order:

1. StockedUp
2. Wall Street Truthbombs
3. Traders Reality
4. Kevin Gerrity
5. ClearValue Tax
6. FX Evolution

The first three are the creator channels the desk handoff explicitly requires.
They are included within the pre-existing six-attempt budget; the change does
not increase the maximum scheduled Supadata credit spend.

Only long-form, non-live uploads from those channels enter an automated
transcript path. Current, upcoming and archived livestreams are classified from
YouTube video/live-stream metadata and are excluded before any provider request
is made.

YouTube does not expose a first-class Shorts flag through the Data API. Scheduled Live intake therefore uses a conservative spend guard: any upload with a YouTube-reported duration of 180 seconds or less is treated as short-form and excluded before Supadata. This can intentionally exclude an occasional normal sub-three-minute upload rather than risk spending transcript credits on Shorts.

Supadata is called with `mode=native`, `text=false` and `lang=en`. `mode=auto` and `mode=generate` are not permitted in scheduled Live intake. If an existing caption track is unavailable, the item remains blocked/revalidatable; Live does not ask Supadata to generate a transcript with AI.

The server-side fallback credential is `SUPADATA_API_KEY`. Persist its provenance
as `supadata`, while its transcript metadata records
`transcriptSource: native_caption` and the returned billable-request count when
Supadata supplies it.

## Optional Chrome transcript operator

When both `CHROME_TRANSCRIPT_OPERATOR_URL` and
`CHROME_TRANSCRIPT_OPERATOR_TOKEN` are configured, scheduled intake uses an
operator running outside Vercel before it spends a Supadata request:

1. It discovers new uploads with the official YouTube Data API.
2. If a YouTube API channel call fails because of missing API access, quota,
   rate limiting or a request failure, it asks the Chrome operator to inspect
   that public channel's `/videos` page. Relative timestamps from this recovery
   path are retained as browser-derived operational provenance.
3. For each newly admitted video, the operator opens the public YouTube watch
   page, then opens
   `https://youtubetotranscript.com/transcript?v=<video-id>&current_language_code=en`
   and returns only non-empty timestamped transcript segments.
4. If Chrome or YouTubeToTranscript is unavailable, including a browser
   verification / Cloudflare challenge, the failed browser attempt is recorded
   and the existing native-caption Supadata path is used as the fallback.

The operator never uses a personal Chrome profile, saved sign-in, browser
extension, CAPTCHA solver or verification bypass. A challenge is an explicit,
retryable research-debt condition, not a reason to manufacture a transcript.

Run the companion on a controlled machine with Node 22+ and Chrome installed:

```powershell
$env:CHROME_TRANSCRIPT_OPERATOR_TOKEN = "a-long-random-shared-secret"
$env:CHROME_EXECUTABLE_PATH = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
npm run chrome:transcript-operator
```

It binds to `127.0.0.1:4317` by default and uses a dedicated temporary Chrome
profile. A Vercel deployment cannot reach that loopback service directly: expose
only its `/v1/transcript` endpoint through an authenticated private HTTPS
connector or controlled worker, then set the matching deployment values:

```text
CHROME_TRANSCRIPT_OPERATOR_URL=https://<controlled-operator>/v1/transcript
CHROME_TRANSCRIPT_OPERATOR_TOKEN=<same-long-random-shared-secret>
```

Do not expose the local operator openly to the public internet. It accepts only
token-authenticated requests, serialises browser work, and should remain behind
your private network boundary.

## Transcript gate

For every video admitted to transcript intake:

1. Discover the video from the channel's official uploads feed and record the channel, video ID, URL and publication time.
2. Classify whether it is a livestream or short-form upload. Livestreams and uploads at or below the 180-second spend guard do not enter the automated transcript provider path.
3. Obtain the full existing caption transcript before using the video as evidence. A configured Chrome operator is preferred; otherwise scheduled Supadata intake must use `mode=native` and must not trigger AI transcript generation.
4. `transcriptStatus: "ready"` is valid only when `transcriptText` contains genuine transcript text. A title, description, chapter list, thumbnail text, comments or search-result summary is not a transcript.
5. If a native transcript cannot be retrieved, mark it `missing` or `unavailable`. The video may be logged for awareness but must not affect a Story or recalibration until a transcript is ready.
6. Treat creator reasoning as a hypothesis. Independently verify material claims against primary data, filings, official releases and directly verified market data before changing canonical research state.
7. Research unfamiliar jargon or mechanisms raised by a creator before evaluating the claim.
8. Deduplicate by channel identity plus YouTube video ID across research runs.

The research-update validator enforces the transcript gate: retained video evidence without a ready transcript is blocked from Story recalibration.
