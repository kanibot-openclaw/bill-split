import { NextResponse } from 'next/server';
import { initDb, query } from '@/lib/db';

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  await initDb();
  const { id: sessionId, itemId } = await ctx.params;

  const existing = await query('SELECT id FROM bill_items WHERE id=$1 AND session_id=$2 LIMIT 1', [itemId, sessionId]);
  if (existing.rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await query('DELETE FROM bill_items WHERE id=$1', [itemId]);
  return NextResponse.json({ ok: true });
}
