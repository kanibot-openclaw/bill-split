import { NextResponse } from 'next/server';
import { initDb, query } from '@/lib/db';

export async function POST() {
  await initDb();
  const id = crypto.randomUUID();

  await query('INSERT INTO bill_sessions (id, currency) VALUES ($1, $2)', [id, 'CLP']);
  await query(
    `INSERT INTO tip_config (session_id, enabled, percentage, distribute_to_all)
     VALUES ($1, FALSE, 10, TRUE)
     ON CONFLICT (session_id) DO NOTHING`,
    [id]
  );

  return NextResponse.json({ id });
}
