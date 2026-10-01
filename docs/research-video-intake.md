# Research video intake

The Live Market Desk owns creator-video discovery and transcript-gated intake. Hybrid consumes only validated Live findings.

## Required YouTube channels

Creator intelligence is intentionally limited to this fixed universe:

1. StockedUp — https://www.youtube.com/@StockedUp/videos
2. Wall Street Truthbombs / Mark Malek — https://www.youtube.com/@wstruthbombs/videos
3. FX Evolution — https://www.youtube.com/@fxevolutionvideo/videos
4. TraderNick — https://www.youtube.com/@TraderNick/videos

Do not add other creators to scheduled discovery or transcript claiming without an explicit workflow change.

## Current monitored-video priority

The scheduled detector checks only the four creators above, in this order:

1. StockedUp
2. Wall Street Truthbombs / Mark Malek
3. FX Evolution
4. TraderNick

Only long-form, non-live uploads enter transcript intake. YouTube video ID is the durable deduplication key. If a video ID already exists in `research_intake_items`, rediscovery records an `already_seen` stage and stops before cache lookup, browser retrieval or transcript-provider work. Transcript retries belong to the leased transcript worker and its cooldown state; discovery must not create a second retry path.

The database also enforces uniqueness for video `external_id` values and restricts transcript-job claims to the same four publishers. This prevents a concurrent run, renamed channel key or stale queue row from creating duplicate provider work.

YouTube does not expose a first-class Shorts flag through the Data API. Scheduled Live intake therefore treats any upload with a YouTube-reported duration of 180 seconds or less as short-form and excludes it from transcript collection. This can intentionally exclude an occasional normal sub-three-minute upload rather than queue Shorts for manual work.

## Optional Chrome transcript operator

When both `CHROME_TRANSCRIPT_OPERATOR_URL` and
`CHROME_TRANSCRIPT_OPERATOR_TOKEN` are configured, scheduled intake uses an
operator running outside Vercel:

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
   and the video remains pending for manual transcript intake. No paid
   fallback is used.

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
2. Classify whether it is a livestream or short-form upload. Livestreams and uploads at or below the 180-second guard do not enter the automated transcript path.
3. Obtain the full existing caption transcript before using the video as evidence. The leased worker uses Supadata native-caption mode and never requests generated transcription. The optional Chrome operator remains available for controlled manual recovery but is not required by the production worker.
4. `transcriptStatus: "ready"` is valid only when `transcriptText` contains genuine transcript text. A title, description, chapter list, thumbnail text, comments or search-result summary is not a transcript.
5. If a native transcript cannot be retrieved, mark it `missing` or `unavailable`. The video may be logged for awareness but must not affect a Story or recalibration until a transcript is ready.
6. Treat creator reasoning as a hypothesis. Independently verify material claims against primary data, filings, official releases and directly verified market data before changing canonical research state.
7. Research unfamiliar jargon or mechanisms raised by a creator before evaluating the claim.
8. Deduplicate by channel identity plus YouTube video ID across research runs.
9. Persist transcript, structured creator review and canonical Evidence as separate checkpoints so a retry resumes at the first missing durable boundary.

The research-update validator enforces the transcript gate: retained video evidence without a ready transcript is blocked from Story recalibration.
