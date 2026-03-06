import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

export const runtime = 'nodejs';

const ReceiptItems = z.object({
  currency: z.string().optional(),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().int().min(1).default(1),
        // Use integer cents to keep math clean.
        priceCents: z.number().int().min(0),
      })
    )
    .min(1),
});

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString('base64');
  const dataUrl = `data:${file.type || 'image/jpeg'};base64,${base64}`;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `You are extracting a restaurant receipt into structured line items.
Return ONLY valid JSON with this schema:\n\n{
  "currency": "CLP" | "USD" | "..." (optional),
  "items": [
    { "name": string, "quantity": integer >=1, "priceCents": integer >=0 }
  ]
}

Rules:
- If a line item has a total price, put that total in priceCents.
- Ignore tip suggestions, taxes summary lines, discounts totals, and payment lines.
- If you see a quantity like 2x, set quantity=2.
- If you can't infer cents, assume whole currency units and multiply by 100.
- Prefer shorter, human-friendly item names.
`;

  const resp = await client.responses.create({
    model: process.env.OPENAI_RECEIPT_MODEL || 'gpt-4.1-mini',
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          { type: 'input_image', image_url: dataUrl, detail: 'low' },
        ],
      },
    ],
  });

  const text = resp.output_text?.trim();
  if (!text) return NextResponse.json({ error: 'No response text' }, { status: 502 });

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Model did not return valid JSON', raw: text }, { status: 502 });
  }

  const parsed = ReceiptItems.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid JSON shape', issues: parsed.error.issues, raw: json }, { status: 502 });
  }

  return NextResponse.json(parsed.data);
}
