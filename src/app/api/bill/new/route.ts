import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { sql } from '@vercel/postgres';

export async function POST() {
  await initDb();
  const id = crypto.randomUUID();

  await sql`INSERT INTO bill_sessions (id, currency) VALUES (${id}, 'CLP')`;
  await sql`
    INSERT INTO tip_config (session_id, enabled, percentage, distribute_to_all)
    VALUES (${id}, FALSE, 10, TRUE)
    ON CONFLICT (session_id) DO NOTHING
  `;

  return NextResponse.json({ id });
}
