# Bluebelly independent encrypted backups — activation and recovery

**Status:** Code installed, not activated until a separate PRIVATE GitHub repository and credentials are configured. Never store an unencrypted database dump, private key or database password in Git.

## One-time setup

1. Create a separate **private** repository, e.g. `clydigital/bluebelly-secure-backups`. Keep it separate from application code. Disable public visibility and restrict collaborators. Configure repository rules to prevent public conversion.
2. Generate an age X25519 identity **offline**: `age-keygen -o bluebelly-backup-key.txt`. Store this PRIVATE identity in an offline password manager and a second secure offline copy. The line starting `age1` is the public recipient. **Never put the identity in GitHub Actions**.
3. Create a dedicated Supabase backup DB connection string. Prefer a dedicated minimally privileged PostgreSQL login with SELECT on backed-up schemas; ensure `pg_dump` has all required read permissions. Use SSL and verify the database is the intended production project. Backing up only accessible schemas does not constitute a complete cluster recovery.
4. In the **application repository** Actions secrets configure:
   - `BLUEBELLY_BACKUP_DATABASE_URL` — direct/pooler PostgreSQL connection string with SSL
   - `BLUEBELLY_BACKUP_AGE_RECIPIENT` — the public `age1...` key
   - `BLUEBELLY_BACKUP_REPO_TOKEN` — fine-grained token restricted to the private backup repository, Contents read/write
   Configure Actions variable `BLUEBELLY_BACKUP_REPO` as `clydigital/bluebelly-secure-backups` (or actual owner/name).
5. Run the workflow manually, check successful encrypted release upload, and separately download/decrypt one archive with the offline key. Test restoring into an **independent** temporary PostgreSQL instance. Confirm expected schema, representative row counts and application-read behaviour.

## Schedule, integrity, retention

- GitHub Actions daily 03:40 UTC (11:40 MYT), after the existing keepalive.
- `pg_dump` custom format; `pg_restore --list` and isolated `pg_restore --exit-on-error` run before upload.
- age X25519 encryption; SHA256 of ciphertext is uploaded alongside it. The checksum detects accidental corruption; age's authenticated encryption protects against tampering.
- Keep 30 days of backup releases, deleting older matching releases/tags. **GitHub Releases are not immutable/WORM storage.** GitHub repository deletion, token compromise or account lockout can still affect all backups.
- A release upload failure fails the workflow. The workflow does not silently mark an empty export successful.
- Keep Actions secrets and logs free of credentials; audit repository collaborators and token scope periodically.

## Scope limitations

This workflow exports a PostgreSQL database, not Supabase Auth external-provider configuration, Vault secrets, Storage object bytes, GitHub repositories, Vercel environment settings, or Notion content. Those require separate backups. Restore tests run on a disposable DB, not production. The archive's restore test validates structural restoration, not application-level completeness or historical accuracy.

If the production database exceeds GitHub release asset size limits or the runner's disk quota, move ciphertext to low-cost object storage and keep the same age encryption and restore-test process.

## Offline recovery

Download `bluebelly-<timestamp>.dump.age` and corresponding `.sha256` from the private backup release. Verify checksum, then run:

```bash
sha256sum -c bluebelly-<timestamp>.sha256
age -d -i /secure/offline/bluebelly-backup-key.txt -o bluebelly.dump bluebelly-<timestamp>.dump.age
pg_restore --list bluebelly.dump
# Restore only into an isolated fresh test database first:
pg_restore --no-owner --no-acl --exit-on-error --dbname="$TEST_DATABASE_URL" bluebelly.dump
```

Before any production restore: take a new snapshot, verify target identity, assess RLS/auth/storage dependencies, and obtain explicit approval. Never overwrite production as part of an automated backup run.
