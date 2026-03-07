import { NextResponse } from 'next/server';
import { initDb, query } from '@/lib/db';
import { z } from 'zod';

const CreateBody = z.object({
  name: z.string().trim().min(1).max(80),
  priceCents: z.number().int().min(0),
  quantity: z.number().int().min(1).max(999).default(1),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await initDb();
  const { id: sessionId } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid item' }, { status: 400 });

  // Ensure session exists and is not expired.
  const sessionRes = await query(
    'SELECT id FROM bill_sessions WHERE id=$1 AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1',
    [sessionId]
  );
  if (sessionRes.rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const id = crypto.randomUUID();
  await query(
    'INSERT INTO bill_items (id, session_id, name, price_cents, quantity) VALUES ($1, $2, $3, $4, $5)',
    [id, sessionId, parsed.data.name, parsed.data.priceCents, parsed.data.quantity]
  );

  return NextResponse.json({ id });
}

const UpdateBody = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  priceCents: z.number().int().min(0).optional(),
  quantity: z.number().int().min(1).max(999).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await initDb();
  const { id: sessionId } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = UpdateBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid item update' }, { status: 400 });

  const { id, name, priceCents, quantity } = parsed.data;

  // Ensure item belongs to session
  const existing = await query('SELECT id FROM bill_items WHERE id=$1 AND session_id=$2 LIMIT 1', [id, sessionId]);
  if (existing.rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (name !== undefined) await query('UPDATE bill_items SET name=$1 WHERE id=$2', [name, id]);
  if (priceCents !== undefined) await query('UPDATE bill_items SET price_cents=$1 WHERE id=$2', [priceCents, id]);
  if (quantity !== undefined) await query('UPDATE bill_items SET quantity=$1 WHERE id=$2', [quantity, id]);

  return NextResponse.json({ ok: true });
}
