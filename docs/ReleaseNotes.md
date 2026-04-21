# Release Notes

## Unreleased

### Security Notes
- **S-01 — Refresh tokens hashed at rest.** Refresh tokens are now persisted as a
  SHA-256 digest. Deploying migration `0004_hash_refresh_tokens.sql` truncates the
  `refresh_tokens` table, forcing all active sessions to re-authenticate on next
  refresh.
- **S-04 — Login rate limiting & lockout.** `POST /auth/login` now tracks failed
  attempts per `(email, ip)` tuple and returns `429 Too Many Requests` with a
  `Retry-After` header after 5 failures in 10 minutes (15-minute lockout). A new
  `RATE_LIMIT_KV` KV namespace binding is required — provision with
  `wrangler kv:namespace create RATE_LIMIT_KV` before deploying and update the
  placeholder `id` in `wrangler.jsonc`. The limiter fails open on KV errors.
