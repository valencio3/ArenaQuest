/**
 * check-no-dev-seed.ts
 *
 * Pre-deploy guard: fails loudly (exit 1) if the known dev-seed password hash
 * is present in the target database. Run this before every production or
 * staging deploy.
 *
 * Usage:
 *   tsx scripts/check-no-dev-seed.ts --db <database-name> [--env staging] [--local]
 *
 * Flags:
 *   --db <name>    D1 database name (e.g. arenaquest-db, arenaquest-db-staging)
 *   --env <name>   Wrangler environment (e.g. staging). Omit for production.
 *   --local        Query the local D1 replica instead of the remote database.
 *
 * Exit codes:
 *   0  No dev hash found — safe to deploy.
 *   1  Dev hash found — abort deploy; listed emails are printed to stderr.
 *   2  Usage error or unexpected wrangler failure.
 */

import { execSync } from 'node:child_process';

// The first 8 hex bytes of the known dev-seed password_hash are enough to
// match exactly these rows while avoiding false positives on user-generated
// hashes. Update this constant if the seed SQL ever changes.
const DEV_PASSWORD_HASH_PREFIX =
  'pbkdf2:100000:e83835066ab015b5ed4449b68a349b38:8baf9add';

// ---------------------------------------------------------------------------
// Argument parsing (no external deps)
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): {
  db: string | null;
  env: string | null;
  local: boolean;
} {
  let db: string | null = null;
  let env: string | null = null;
  let local = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--db' && argv[i + 1]) {
      db = argv[++i];
    } else if (argv[i] === '--env' && argv[i + 1]) {
      env = argv[++i];
    } else if (argv[i] === '--local') {
      local = true;
    }
  }

  return { db, env, local };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.db) {
    // Default DB names match wrangler.jsonc bindings.
    args.db = args.env === 'staging' ? 'arenaquest-db-staging' : 'arenaquest-db';
  }

  const remoteFlag = args.local ? '--local' : '--remote';
  const envFlag = args.env ? `--env ${args.env}` : '';

  const query = `SELECT email FROM users WHERE password_hash LIKE '${DEV_PASSWORD_HASH_PREFIX}%'`;

  const cmd = [
    'pnpm exec wrangler d1 execute',
    args.db,
    remoteFlag,
    envFlag,
    '--json',
    `--command "${query}"`,
  ]
    .filter(Boolean)
    .join(' ');

  let output: string;
  try {
    output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[check-no-dev-seed] wrangler error:\n${msg}\n`);
    process.exit(2);
  }

  let rows: Array<{ email: string }>;
  try {
    // wrangler --json returns an array of result sets; each has a `results` array.
    const parsed = JSON.parse(output) as Array<{ results: Array<{ email: string }> }>;
    rows = parsed.flatMap(r => r.results ?? []);
  } catch {
    process.stderr.write(`[check-no-dev-seed] failed to parse wrangler output:\n${output}\n`);
    process.exit(2);
  }

  if (rows.length === 0) {
    process.stdout.write('[check-no-dev-seed] OK — no dev-seed hashes found.\n');
    process.exit(0);
  }

  const emails = rows.map(r => `  • ${r.email}`).join('\n');
  process.stderr.write(
    `[check-no-dev-seed] BLOCKED — dev-seed password hash found in database "${args.db}".\n` +
    `Affected accounts:\n${emails}\n\n` +
    `Remove or re-hash these accounts before deploying.\n` +
    `See docs/product/api/bootstrap-first-admin.md for the correct procedure.\n`,
  );
  process.exit(1);
}

main();
