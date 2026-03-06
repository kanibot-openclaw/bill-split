import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { sql } from '@vercel/postgres';
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

  const id = crypto.randomUUID();
  await sql`
    INSERT INTO bill_items (id, session_id, name, price_cents, quantity)
    VALUES (${id}, ${sessionId}, ${parsed.data.name}, ${parsed.data.priceCents}, ${parsed.data.quantity})
  `;

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
  const existing = await sql`SELECT id FROM bill_items WHERE id=${id} AND session_id=${sessionId} LIMIT 1`;
  if (existing.rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (name !== undefined) await sql`UPDATE bill_items SET name=${name} WHERE id=${id}`;
  if (priceCents !== undefined) await sql`UPDATE bill_items SET price_cents=${priceCents} WHERE id=${id}`;
  if (quantity !== undefined) await sql`UPDATE bill_items SET quantity=${quantity} WHERE id=${id}`;

  return NextResponse.json({ ok: true });
}
