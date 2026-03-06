import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { sql } from '@vercel/postgres';

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  await initDb();
  const { id: sessionId, itemId } = await ctx.params;

  const existing = await sql`SELECT id FROM bill_items WHERE id=${itemId} AND session_id=${sessionId} LIMIT 1`;
  if (existing.rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await sql`DELETE FROM bill_items WHERE id=${itemId}`;
  return NextResponse.json({ ok: true });
}
