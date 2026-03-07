import { Pool } from 'pg';

function getConnectionString() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL;
}

function getPool() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    // Don't throw at import time (Next build may load API routes).
    throw new Error(
      'Missing database connection string. Set POSTGRES_URL (recommended) or DATABASE_URL in your environment.'
    );
  }

  // In dev, Next.js can hot-reload modules, so we stash the pool on global.
  const globalForPg = globalThis as unknown as { __pgPool?: Pool };
  const existing = globalForPg.__pgPool;
  if (existing) return existing;

  const pool = new Pool({
    connectionString,
    // Local Docker Postgres typically has no SSL.
    // Hosted providers (Neon) require SSL.
    ssl:
      connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? undefined
        : { rejectUnauthorized: false },
  });

  if (process.env.NODE_ENV !== 'production') globalForPg.__pgPool = pool;
  return pool;
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
) {
  const pool = getPool();
  // pg types are a bit loose; this cast keeps our app code strict.
  const res = await pool.query<T>(text, params as unknown as never[]);
  return res;
}

let inited = false;

// Creates tables if they don't exist. Safe to call multiple times.
export async function initDb() {
  if (inited) return;

  await query(`
    CREATE TABLE IF NOT EXISTS bill_sessions (
      id TEXT PRIMARY KEY,
      currency TEXT NOT NULL DEFAULT 'CLP',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NULL
    );
  `);

  // If the table already existed (older versions), ensure the column is present.
  await query(`ALTER TABLE bill_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;`);

  await query(`
    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES bill_sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Helps cleanup queries.
  await query(`CREATE INDEX IF NOT EXISTS bill_sessions_expires_at_idx ON bill_sessions(expires_at);`);

  await query(`
    CREATE TABLE IF NOT EXISTS bill_items (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES bill_sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS item_assignments (
      item_id TEXT NOT NULL REFERENCES bill_items(id) ON DELETE CASCADE,
      participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      PRIMARY KEY (item_id, participant_id)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS tip_config (
      session_id TEXT PRIMARY KEY REFERENCES bill_sessions(id) ON DELETE CASCADE,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      percentage REAL NOT NULL DEFAULT 10,
      distribute_to_all BOOLEAN NOT NULL DEFAULT TRUE
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS tip_config_participants (
      session_id TEXT NOT NULL REFERENCES bill_sessions(id) ON DELETE CASCADE,
      participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      PRIMARY KEY (session_id, participant_id)
    );
  `);

  inited = true;
}
