import { NextResponse } from 'next/server';
import { initDb, query } from '@/lib/db';

export const runtime = 'nodejs';

// MVP cleanup endpoint.
//
// Local: call manually: curl -X POST http://localhost:3000/api/cron/cleanup
// Deployed: wire this to Vercel Cron (later).
export async function POST(req: Request) {
  await initDb();

  // Optional poor-man protection: allow setting a shared secret.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const got = req.headers.get('x-cron-secret');
    if (got !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const res = await query(
    'DELETE FROM bill_sessions WHERE expires_at IS NOT NULL AND expires_at < NOW() RETURNING id',
    []
  );

  const ids = (res.rows as Array<{ id: string }>).map((r) => r.id);
  return NextResponse.json({ deleted: res.rowCount ?? 0, ids });
}
