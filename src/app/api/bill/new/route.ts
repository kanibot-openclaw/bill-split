import { NextResponse } from 'next/server';
import { initDb, query } from '@/lib/db';

export async function POST() {
  await initDb();
  const id = crypto.randomUUID();

  // Guest bills expire automatically (default: 30 minutes).
  await query('INSERT INTO bill_sessions (id, currency, expires_at) VALUES ($1, $2, NOW() + interval \'30 minutes\')', [
    id,
    'CLP',
  ]);
  await query(
    `INSERT INTO tip_config (session_id, enabled, percentage, distribute_to_all)
     VALUES ($1, FALSE, 10, TRUE)
     ON CONFLICT (session_id) DO NOTHING`,
    [id]
  );

  return NextResponse.json({ id });
}
