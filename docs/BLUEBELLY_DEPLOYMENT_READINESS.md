# Database dependency readiness

The production app reads Supabase project qdtlrfgxpsnxajiptrno. Staging hckeztdmfqlxinapqyhe and user-identified Marketplace candidate xqpffslpmzdigrsjphts are monitored separately; their actual Vercel attachment is not proven by a healthy database status.

## Setup
Add a GitHub Actions repository secret named SUPABASE_ACCESS_TOKEN from a Supabase account authorized to read all tracked projects (use least privilege available). Never place the token in code, URLs or public logs. The daily workflow explicitly reports missing credentials or denied permissions as UNVERIFIED rather than healthy. Run the workflow manually after setup and check its summary. The app's existing real database read is retained.

## Incident procedure
1. Run Supabase daily keepalive manually before a production redeploy; inspect the separate live database and project states.
2. If a required resource is inactive, resume it through Supabase and confirm ACTIVE_HEALTHY. A management status is not a substitute for an actual application read.
3. In Vercel Storage, confirm the exact attached resource and its readiness. If unused, disconnect only that resource after confirming the canonical production environment variables and testing a deployment. Do not delete the database. If needed, keep a direct app connection with appropriately scoped credentials.
4. Redeploy once using the latest validated commit. If provisioning still fails, stop retries; inspect integration status or contact Vercel/Supabase support with deployment ID. A green health report is not proof that the integration can provision.
5. Verify the production alias and application health after deployment.

This check is external to Supabase, runs daily and on manual request, and does not alter project billing or pause settings. It does not override free-tier inactivity rules. Vercel automatic Git deployments are not gated by this GitHub workflow; a true hard gate would require replacing automatic production deployment with a controlled, authenticated deployment workflow or removing the unnecessary Marketplace dependency.
