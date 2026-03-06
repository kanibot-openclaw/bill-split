import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { sql } from '@vercel/postgres';
import { z } from 'zod';

const Body = z.object({
  itemId: z.string().min(1),
  participantIds: z.array(z.string().min(1)),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await initDb();
  const { id: sessionId } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { itemId, participantIds } = parsed.data;

  const itemRes = await sql`SELECT id FROM bill_items WHERE id=${itemId} AND session_id=${sessionId} LIMIT 1`;
  if (itemRes.rowCount === 0) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  // Replace assignments
  await sql`DELETE FROM item_assignments WHERE item_id=${itemId}`;
  for (const pid of participantIds) {
    // Ensure participant belongs to session
    const pRes = await sql`SELECT id FROM participants WHERE id=${pid} AND session_id=${sessionId} LIMIT 1`;
    if (pRes.rowCount === 0) continue;
    await sql`INSERT INTO item_assignments (item_id, participant_id) VALUES (${itemId}, ${pid}) ON CONFLICT DO NOTHING`;
  }

  return NextResponse.json({ ok: true });
}
