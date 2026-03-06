import { NextResponse } from 'next/server';
import { initDb, query } from '@/lib/db';
import { z } from 'zod';

const Body = z.object({
  enabled: z.boolean(),
  percentage: z.number().min(0).max(100),
  distributeToAll: z.boolean(),
  selectedParticipantIds: z.array(z.string().min(1)).default([]),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await initDb();
  const { id: sessionId } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid tip config' }, { status: 400 });

  const { enabled, percentage, distributeToAll, selectedParticipantIds } = parsed.data;

  await query(
    `INSERT INTO tip_config (session_id, enabled, percentage, distribute_to_all)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (session_id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       percentage = EXCLUDED.percentage,
       distribute_to_all = EXCLUDED.distribute_to_all`,
    [sessionId, enabled, percentage, distributeToAll]
  );

  await query('DELETE FROM tip_config_participants WHERE session_id=$1', [sessionId]);

  if (!distributeToAll) {
    for (const pid of selectedParticipantIds) {
      const pRes = await query('SELECT id FROM participants WHERE id=$1 AND session_id=$2 LIMIT 1', [pid, sessionId]);
      if (pRes.rowCount === 0) continue;
      await query(
        `INSERT INTO tip_config_participants (session_id, participant_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [sessionId, pid]
      );
    }
  }

  return NextResponse.json({ ok: true });
}
