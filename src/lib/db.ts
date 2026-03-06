import { sql } from '@vercel/postgres';

let inited = false;

// Creates tables if they don't exist. Safe to call multiple times.
export async function initDb() {
  if (inited) return;

  // bill_sessions
  await sql`
    CREATE TABLE IF NOT EXISTS bill_sessions (
      id TEXT PRIMARY KEY,
      currency TEXT NOT NULL DEFAULT 'CLP',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // participants
  await sql`
    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES bill_sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // bill_items
  await sql`
    CREATE TABLE IF NOT EXISTS bill_items (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES bill_sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // item_assignments (many-to-many)
  await sql`
    CREATE TABLE IF NOT EXISTS item_assignments (
      item_id TEXT NOT NULL REFERENCES bill_items(id) ON DELETE CASCADE,
      participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      PRIMARY KEY (item_id, participant_id)
    );
  `;

  // tip_config (1 per session)
  await sql`
    CREATE TABLE IF NOT EXISTS tip_config (
      session_id TEXT PRIMARY KEY REFERENCES bill_sessions(id) ON DELETE CASCADE,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      percentage REAL NOT NULL DEFAULT 10,
      distribute_to_all BOOLEAN NOT NULL DEFAULT TRUE
    );
  `;

  // tip_config_participants: only used when distribute_to_all=false
  await sql`
    CREATE TABLE IF NOT EXISTS tip_config_participants (
      session_id TEXT NOT NULL REFERENCES bill_sessions(id) ON DELETE CASCADE,
      participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      PRIMARY KEY (session_id, participant_id)
    );
  `;

  inited = true;
}
