import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { sql } from '@vercel/postgres';
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

  await sql`
    INSERT INTO tip_config (session_id, enabled, percentage, distribute_to_all)
    VALUES (${sessionId}, ${enabled}, ${percentage}, ${distributeToAll})
    ON CONFLICT (session_id) DO UPDATE SET
      enabled = EXCLUDED.enabled,
      percentage = EXCLUDED.percentage,
      distribute_to_all = EXCLUDED.distribute_to_all
  `;

  await sql`DELETE FROM tip_config_participants WHERE session_id=${sessionId}`;

  if (!distributeToAll) {
    for (const pid of selectedParticipantIds) {
      const pRes = await sql`SELECT id FROM participants WHERE id=${pid} AND session_id=${sessionId} LIMIT 1`;
      if (pRes.rowCount === 0) continue;
      await sql`
        INSERT INTO tip_config_participants (session_id, participant_id)
        VALUES (${sessionId}, ${pid})
        ON CONFLICT DO NOTHING
      `;
    }
  }

  return NextResponse.json({ ok: true });
}
