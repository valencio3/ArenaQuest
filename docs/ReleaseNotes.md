# Release Notes

## Unreleased

### Security Notes
- **S-01 — Refresh tokens hashed at rest.** Refresh tokens are now persisted as a
  SHA-256 digest. Deploying migration `0004_hash_refresh_tokens.sql` truncates the
  `refresh_tokens` table, forcing all active sessions to re-authenticate on next
  refresh.
