/**
 * lib/db.ts
 *
 * Reusable PostgreSQL connection pool using the `pg` package.
 * All credentials are read from environment variables — never hardcoded.
 *
 * We use a Pool (not a single Client) so that Next.js Route Handlers
 * can share connections efficiently across concurrent requests.
 */

import { Pool } from 'pg';

// Singleton pool stored on the Node.js global object in development
// to survive hot-module reloads without opening new connections each time.
declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function createPool(): Pool {
  return new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE || 'helpdesk_db',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    // Keep alive idle connections; max 10 is fine for a dev project
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

// In production, always create a fresh pool.
// In development, reuse the pool across hot reloads.
const pool: Pool =
  process.env.NODE_ENV === 'production'
    ? createPool()
    : (global._pgPool ?? (global._pgPool = createPool()));

export default pool;
