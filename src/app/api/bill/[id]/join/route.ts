import { NextResponse } from 'next/server';
import { initDb, query } from '@/lib/db';
import { z } from 'zod';

const Body = z.object({ name: z.string().trim().min(1).max(40) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await initDb();
  const { id: sessionId } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }

  // Ensure session exists
  const sessionRes = await query(
    'SELECT id FROM bill_sessions WHERE id = $1 AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1',
    [sessionId]
  );
  if (sessionRes.rowCount === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const participantId = crypto.randomUUID();
  await query('INSERT INTO participants (id, session_id, name) VALUES ($1, $2, $3)', [
    participantId,
    sessionId,
    parsed.data.name,
  ]);

  return NextResponse.json({ participantId });
}
