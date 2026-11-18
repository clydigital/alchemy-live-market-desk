#!/usr/bin/env bash
set -euo pipefail
umask 077
work="$(mktemp -d)"
trap 'docker rm -f bluebelly-backup-restore-test >/dev/null 2>&1 || true; rm -rf "$work"' EXIT
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump="$work/bluebelly.dump"
# The official Postgres client avoids mismatched local pg_dump versions.
docker run --rm -e DATABASE_URL postgres:17 bash -c 'pg_dump --no-owner --no-acl --format=custom --dbname="$DATABASE_URL"' > "$dump"
test -s "$dump"
docker run --rm -i postgres:17 pg_restore --list < "$dump" > "$work/toc.txt"
grep -q 'TABLE DATA' "$work/toc.txt"
# Actual isolated restore test, not just archive listing.
docker run -d --name bluebelly-backup-restore-test -e POSTGRES_PASSWORD=temporary-local-only postgres:17 >/dev/null
for i in $(seq 1 35); do
  if docker exec bluebelly-backup-restore-test pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -i bluebelly-backup-restore-test pg_restore --no-owner --no-acl --exit-on-error -U postgres -d postgres < "$dump"
# Validate tables materialized.
docker exec bluebelly-backup-restore-test psql -U postgres -Atqc "select count(*) from information_schema.tables where table_schema='public'" | grep -Eq '^[1-9][0-9]*$'
age -r "$BACKUP_AGE_RECIPIENT" -o "$work/bluebelly-$stamp.dump.age" "$dump"
sha256sum "$work/bluebelly-$stamp.dump.age" > "$work/bluebelly-$stamp.sha256"
export GH_TOKEN="$BACKUP_REPO_TOKEN"
tag="bluebelly-backup-$stamp"
gh release create "$tag" "$work/bluebelly-$stamp.dump.age" "$work/bluebelly-$stamp.sha256" --repo "$BACKUP_REPO" --title "$tag" --notes "Encrypted database backup; full isolated restore verified. UTC $stamp."
# Retain 30 days. Release deletion removes release assets; use separate repository and restrict access.
cutoff="$(date -u -d '30 days ago' +%s)"
gh api --paginate "repos/$BACKUP_REPO/releases?per_page=100" --jq '.[] | [.tag_name,.created_at] | @tsv' |
while IFS=$'\t' read -r old_tag created; do
  [[ "$old_tag" == bluebelly-backup-* ]] || continue
  epoch="$(date -u -d "$created" +%s)"
  if (( epoch < cutoff )); then gh release delete "$old_tag" --repo "$BACKUP_REPO" --yes --cleanup-tag; fi
done
echo "Encrypted backup uploaded, integrity checked, restored in isolation, and retention applied."
