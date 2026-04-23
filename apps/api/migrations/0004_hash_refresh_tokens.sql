-- S-01: persist refresh tokens as a SHA-256 digest at rest.
-- Forces all users to log in again. Intentional: we cannot derive the SHA-256
-- of a token we never stored in plain form anywhere else. Re-running this
-- migration is a no-op once the table is empty.
DELETE FROM refresh_tokens;
