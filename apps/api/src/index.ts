/**
 * ArenaQuest — Cloudflare Worker entry point
 *
 * Phase 1: foundation scaffolding.
 * The ports (IStorageAdapter, IDatabaseAdapter) are defined but concrete
 * adapter implementations will be wired in Phase 2 via dependency injection.
 */

import type { IDatabaseAdapter, IStorageAdapter } from '@arenaquest/shared/ports';

// Extend the Cloudflare Worker Env with the adapter bindings.
// Concrete implementations will be injected here once Phase 2 adapters exist.
export interface AppEnv extends Env {
  // Will be populated after Phase 2 adapter implementations are built.
  // DB?: IDatabaseAdapter;
  // STORAGE?: IStorageAdapter;
}

export default {
  async fetch(request: Request, env: AppEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        phase: 1,
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        adapters: {
          database: 'not_wired',  // pending Phase 2
          storage: 'not_wired',   // pending Phase 2
        },
      });
    }

    return Response.json(
      { error: 'Not Found', path: url.pathname },
      { status: 404 },
    );
  },
} satisfies ExportedHandler<AppEnv>;