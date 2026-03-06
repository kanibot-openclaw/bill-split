import { NextResponse } from 'next/server';
import { initDb, query } from '@/lib/db';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  await initDb();
  const { id } = await ctx.params;

  const sessionRes = await query(
    `SELECT id, currency, created_at
     FROM bill_sessions
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  if (sessionRes.rowCount === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const participantsRes = await query(
    `SELECT id, session_id, name, created_at
     FROM participants
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [id]
  );

  const itemsRes = await query(
    `SELECT id, session_id, name, price_cents, quantity, created_at
     FROM bill_items
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [id]
  );

  const assignmentsRes = await query(
    `SELECT a.item_id, a.participant_id
     FROM item_assignments a
     JOIN bill_items i ON i.id = a.item_id
     WHERE i.session_id = $1`,
    [id]
  );

  const tipRes = await query(
    `SELECT session_id, enabled, percentage, distribute_to_all
     FROM tip_config
     WHERE session_id = $1
     LIMIT 1`,
    [id]
  );

  const tipSelectedRes = await query(
    `SELECT participant_id
     FROM tip_config_participants
     WHERE session_id = $1`,
    [id]
  );

  const assignmentsByItemId: Record<string, string[]> = {};
  for (const row of assignmentsRes.rows as Array<{ item_id: string; participant_id: string }>) {
    assignmentsByItemId[row.item_id] ||= [];
    assignmentsByItemId[row.item_id].push(row.participant_id);
  }

  const sessionRow = sessionRes.rows[0] as { id: string; currency: string; created_at: string };
  const tipRow =
    (tipRes.rows[0] as { session_id: string; enabled: boolean; percentage: number; distribute_to_all: boolean } | undefined) ??
    {
      session_id: id,
      enabled: false,
      percentage: 10,
      distribute_to_all: true,
    };

  return NextResponse.json({
    session: {
      id: sessionRow.id,
      currency: sessionRow.currency,
      createdAt: sessionRow.created_at,
    },
    participants: (
      participantsRes.rows as Array<{ id: string; session_id: string; name: string; created_at: string }>
    ).map((p) => ({
      id: p.id,
      sessionId: p.session_id,
      name: p.name,
      createdAt: p.created_at,
    })),
    items: (
      itemsRes.rows as Array<{
        id: string;
        session_id: string;
        name: string;
        price_cents: number;
        quantity: number;
        created_at: string;
      }>
    ).map((i) => ({
      id: i.id,
      sessionId: i.session_id,
      name: i.name,
      priceCents: i.price_cents,
      quantity: i.quantity,
      createdAt: i.created_at,
    })),
    assignmentsByItemId,
    tip: {
      sessionId: tipRow.session_id,
      enabled: tipRow.enabled,
      percentage: Number(tipRow.percentage),
      distributeToAll: tipRow.distribute_to_all,
      selectedParticipantIds: (
        tipSelectedRes.rows as Array<{ participant_id: string }>
      ).map((r) => r.participant_id),
    },
  });
}
