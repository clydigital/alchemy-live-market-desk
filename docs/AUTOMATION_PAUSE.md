# Temporary production automation pause

Automated production cron execution is temporarily paused by a Vercel rewrite that routes every `/api/cron/*` request to `/api/automation-paused`.

The original cron schedule remains declared in `vercel.json` so schedule contracts and handler code are preserved. Manual non-cron research endpoints are unaffected.

To resume automated production runs, remove the `/api/cron/:path*` rewrite and this temporary pause endpoint/test in one reviewed change, then verify the production deployment is READY before relying on the next scheduled slot.
