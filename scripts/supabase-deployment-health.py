#!/usr/bin/env python3
"""Read-only external readiness checks. Never resumes or modifies databases."""
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

PRODUCTION = "qdtlrfgxpsnxajiptrno"
STAGING = "hckeztdmfqlxinapqyhe"
MARKETPLACE_CANDIDATE = "xqpffslpmzdigrsjphts"
HEALTH_URL = "https://bluebelly-desk.vercel.app/api/health/supabase-keepalive"

def fetch(url, token=None):
    headers = {"Accept": "application/json", "Cache-Control": "no-cache"}
    if token:
        headers["Authorization"] = "Bearer " + token
    try:
        with urlopen(Request(url, headers=headers), timeout=15) as response:
            return response.status, json.load(response)
    except HTTPError as exc:
        return exc.code, {}
    except (URLError, TimeoutError, ValueError, OSError):
        return 0, {}

def project_state(ref, token, getter=fetch):
    if not token:
        return "UNVERIFIED", "SUPABASE_ACCESS_TOKEN not configured"
    code, data = getter("https://api.supabase.com/v1/projects/" + ref, token)
    if code != 200:
        return "UNVERIFIED", "Management API HTTP " + str(code)
    state = data.get("status")
    if state == "ACTIVE_HEALTHY":
        return "HEALTHY", state
    if isinstance(state, str) and state in {"INACTIVE", "COMING_UP", "RESTORING", "PAUSING", "UNKNOWN", "ACTIVE_UNHEALTHY", "GOING_DOWN", "INIT_FAILED", "REMOVED", "RESTARTING", "UPGRADING"}:
        return "NOT_READY", state
    return "UNVERIFIED", "Unexpected management status"

def evaluate(token, getter=fetch):
    code, data = getter(HEALTH_URL)
    live = code == 200 and data.get("database") == "reachable"
    results = [("Live production database read", "HEALTHY" if live else "NOT_READY", "HTTP " + str(code))]
    for label, ref in (("Production project", PRODUCTION), ("Staging project (dependency unconfirmed)", STAGING), ("Marketplace project (dependency to verify)", MARKETPLACE_CANDIDATE)):
        state, detail = project_state(ref, token, getter)
        results.append((label, state, detail))
    return results

def main():
    results = evaluate(os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip())
    lines = ["## Bluebelly database dependency check", "", "| Check | State | Detail |", "| --- | --- | --- |"]
    lines += ["| " + " | ".join(row) + " |" for row in results]
    lines += ["", "A green database check does not guarantee Vercel Marketplace provisioning. If provisioning fails despite all checks passing, inspect the connected resource in Vercel; do not repeatedly redeploy.", "", "This monitor does not automatically resume projects, change billing, disconnect resources, or gate Vercel's native Git deployments."]
    report = "\n".join(lines)
    print(report)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(report + "\n")
    failed = [row for row in results if row[1] != "HEALTHY"]
    if failed:
        print("::error title=Database dependency check incomplete::One or more dependencies are not ready or not verifiable. See job summary.")
    return int(bool(failed))

if __name__ == "__main__":
    sys.exit(main())
