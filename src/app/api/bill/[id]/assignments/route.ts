import { NextResponse } from 'next/server';
import { initDb, query } from '@/lib/db';
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

  const itemRes = await query('SELECT id FROM bill_items WHERE id=$1 AND session_id=$2 LIMIT 1', [itemId, sessionId]);
  if (itemRes.rowCount === 0) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  // Replace assignments
  await query('DELETE FROM item_assignments WHERE item_id=$1', [itemId]);
  for (const pid of participantIds) {
    // Ensure participant belongs to session
    const pRes = await query('SELECT id FROM participants WHERE id=$1 AND session_id=$2 LIMIT 1', [pid, sessionId]);
    if (pRes.rowCount === 0) continue;
    await query(
      'INSERT INTO item_assignments (item_id, participant_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [itemId, pid]
    );
  }

  return NextResponse.json({ ok: true });
}
