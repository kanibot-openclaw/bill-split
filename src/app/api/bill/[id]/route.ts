import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { sql } from '@vercel/postgres';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  await initDb();
  const { id } = await ctx.params;

  const sessionRes = await sql`
    SELECT id, currency, created_at
    FROM bill_sessions
    WHERE id = ${id}
    LIMIT 1
  `;
  if (sessionRes.rowCount === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const participantsRes = await sql`
    SELECT id, session_id, name, created_at
    FROM participants
    WHERE session_id = ${id}
    ORDER BY created_at ASC
  `;

  const itemsRes = await sql`
    SELECT id, session_id, name, price_cents, quantity, created_at
    FROM bill_items
    WHERE session_id = ${id}
    ORDER BY created_at ASC
  `;

  const assignmentsRes = await sql`
    SELECT a.item_id, a.participant_id
    FROM item_assignments a
    JOIN bill_items i ON i.id = a.item_id
    WHERE i.session_id = ${id}
  `;

  const tipRes = await sql`
    SELECT session_id, enabled, percentage, distribute_to_all
    FROM tip_config
    WHERE session_id = ${id}
    LIMIT 1
  `;

  const tipSelectedRes = await sql`
    SELECT participant_id
    FROM tip_config_participants
    WHERE session_id = ${id}
  `;

  const assignmentsByItemId: Record<string, string[]> = {};
  for (const row of assignmentsRes.rows as any[]) {
    assignmentsByItemId[row.item_id] ||= [];
    assignmentsByItemId[row.item_id].push(row.participant_id);
  }

  const sessionRow: any = sessionRes.rows[0];
  const tipRow: any = tipRes.rows[0] ?? {
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
    participants: (participantsRes.rows as any[]).map((p) => ({
      id: p.id,
      sessionId: p.session_id,
      name: p.name,
      createdAt: p.created_at,
    })),
    items: (itemsRes.rows as any[]).map((i) => ({
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
      selectedParticipantIds: (tipSelectedRes.rows as any[]).map((r) => r.participant_id),
    },
  });
}
