'use client';

import useSWR from 'swr';
import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { BillState } from '@/lib/types';
import { computeTotals } from '@/lib/calc';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function money(cents: number) {
  // Currency hardcoded for MVP.
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(
    Math.round(cents / 100)
  );
}

export default function BillPage({ params }: { params: { id: string } }) {
  const billId = params.id;
  const { data, error, isLoading, mutate } = useSWR<BillState>(`/api/bill/${billId}`, fetcher, {
    refreshInterval: 2000,
  });

  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(null);

  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [creatingItem, setCreatingItem] = useState(false);

  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [parsedReceiptItems, setParsedReceiptItems] = useState<
    Array<{ name: string; quantity: number; priceCents: number }>
  >([]);

  useEffect(() => {
    const key = `bill:${billId}:participantId`;
    const val = window.localStorage.getItem(key);
    if (val) setParticipantId(val);
  }, [billId]);

  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    setShareUrl(window.location.href);
  }, [billId]);

  const totals = useMemo(() => {
    if (!data) return null;
    return computeTotals({
      items: data.items,
      participants: data.participants,
      assignmentsByItemId: data.assignmentsByItemId,
      tip: data.tip,
    });
  }, [data]);

  async function join() {
    if (!name.trim()) return;
    setJoining(true);
    try {
      const res = await fetch(`/api/bill/${billId}/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to join');
      const json = (await res.json()) as { participantId: string };
      window.localStorage.setItem(`bill:${billId}:participantId`, json.participantId);
      setParticipantId(json.participantId);
      setName('');
      await mutate();
    } finally {
      setJoining(false);
    }
  }

  async function createItem() {
    if (!newItemName.trim()) return;
    const priceUnits = Number(newItemPrice);
    const qty = Number(newItemQty || '1');
    if (!Number.isFinite(priceUnits) || priceUnits < 0) return;
    if (!Number.isFinite(qty) || qty < 1) return;

    setCreatingItem(true);
    try {
      await fetch(`/api/bill/${billId}/items`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: newItemName,
          priceCents: Math.round(priceUnits * 100),
          quantity: Math.round(qty),
        }),
      });
      setNewItemName('');
      setNewItemPrice('');
      setNewItemQty('1');
      await mutate();
    } finally {
      setCreatingItem(false);
    }
  }

  async function updateItem(itemId: string, patch: any) {
    await fetch(`/api/bill/${billId}/items`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: itemId, ...patch }),
    });
    await mutate();
  }

  async function deleteItem(itemId: string) {
    await fetch(`/api/bill/${billId}/items/${itemId}`, { method: 'DELETE' });
    await mutate();
  }

  async function setAssignments(itemId: string, participantIds: string[]) {
    await fetch(`/api/bill/${billId}/assignments`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemId, participantIds }),
    });
    await mutate();
  }

  async function updateTip(patch: Partial<BillState['tip']>) {
    if (!data) return;
    const next = {
      ...data.tip,
      ...patch,
    };
    await fetch(`/api/bill/${billId}/tip`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    });
    await mutate();
  }

  async function parseReceipt(file: File) {
    setReceiptBusy(true);
    setReceiptError(null);
    try {
      const fd = new FormData();
      fd.set('file', file);
      const res = await fetch('/api/receipt/parse', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Failed to parse receipt');

      const items = json.items as Array<{ name: string; quantity: number; priceCents: number }>;
      setParsedReceiptItems(items);
    } catch (e: any) {
      setReceiptError(e?.message ?? 'Receipt parsing failed');
    } finally {
      setReceiptBusy(false);
    }
  }

  async function addParsedReceiptItems() {
    if (parsedReceiptItems.length === 0) return;
    for (const it of parsedReceiptItems) {
      await fetch(`/api/bill/${billId}/items`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: it.name, quantity: it.quantity, priceCents: it.priceCents }),
      });
    }
    setParsedReceiptItems([]);
    await mutate();
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-md">Loading…</div>
      </div>
    );
  }

  if (error || (data as any)?.error) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-md">
          <p className="font-medium">Couldn’t load this bill.</p>
          <p className="mt-2 text-sm text-zinc-600">Make sure the link is correct.</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const you = participantId && data.participants.find((p) => p.id === participantId);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-md px-4 py-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Bill Split</h1>
            <p className="mt-1 text-xs text-zinc-600">Session: {data.session.id.slice(0, 8)}…</p>
            {you ? <p className="mt-1 text-xs text-zinc-600">You: {you.name}</p> : null}
          </div>
          <a href="/" className="text-sm font-medium text-zinc-700 underline">
            New
          </a>
        </header>

        <section className="mt-4 rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Share</div>
            <button
              className="text-xs font-medium underline"
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
              }}
            >
              Copy link
            </button>
          </div>
          <div className="mt-2 break-all text-xs text-zinc-600">{shareUrl}</div>
          <div className="mt-3 flex items-center justify-center">
            <div className="rounded-xl border bg-white p-3">
              <QRCodeSVG value={shareUrl || `https://example.com/bill/${billId}`} size={160} />
            </div>
          </div>
        </section>

        {!participantId ? (
          <section className="mt-4 rounded-2xl border bg-white p-4">
            <div className="text-sm font-medium">Join this bill</div>
            <div className="mt-2 flex gap-2">
              <input
                className="h-11 flex-1 rounded-xl border px-3 text-sm"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                onClick={join}
                disabled={joining}
                className="h-11 rounded-xl bg-black px-4 text-sm font-medium text-white disabled:opacity-60"
              >
                Join
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-600">
              No accounts. Your name is stored only in this session.
            </p>
          </section>
        ) : null}

        <section className="mt-4 rounded-2xl border bg-white p-4">
          <div className="text-sm font-medium">Participants</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.participants.length === 0 ? (
              <span className="text-sm text-zinc-600">No one yet.</span>
            ) : (
              data.participants.map((p) => (
                <span
                  key={p.id}
                  className={`rounded-full border px-3 py-1 text-xs ${p.id === participantId ? 'border-black bg-zinc-100' : ''}`}
                >
                  {p.name}
                </span>
              ))
            )}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Items</div>
            <label className="text-xs text-zinc-600">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void parseReceipt(f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2">
            <div className="grid grid-cols-6 gap-2">
              <input
                className="col-span-3 h-11 rounded-xl border px-3 text-sm"
                placeholder="Item"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
              />
              <input
                className="col-span-2 h-11 rounded-xl border px-3 text-sm"
                placeholder="Price"
                inputMode="decimal"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
              />
              <input
                className="col-span-1 h-11 rounded-xl border px-3 text-sm"
                placeholder="Qty"
                inputMode="numeric"
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={createItem}
                disabled={creatingItem}
                className="h-11 flex-1 rounded-xl bg-black px-4 text-sm font-medium text-white disabled:opacity-60"
              >
                Add item
              </button>
              <label className="inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void parseReceipt(f);
                    e.currentTarget.value = '';
                  }}
                />
                {receiptBusy ? 'Parsing…' : 'Upload receipt'}
              </label>
            </div>
            {receiptError ? <p className="text-xs text-red-600">{receiptError}</p> : null}

            {parsedReceiptItems.length > 0 ? (
              <div className="mt-3 rounded-xl border bg-zinc-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-zinc-800">Receipt items (review)</div>
                  <button
                    className="text-xs font-medium underline"
                    onClick={() => setParsedReceiptItems([])}
                  >
                    Discard
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  {parsedReceiptItems.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-6 gap-2">
                      <input
                        className="col-span-3 h-10 rounded-xl border bg-white px-3 text-xs"
                        value={it.name}
                        onChange={(e) => {
                          const next = [...parsedReceiptItems];
                          next[idx] = { ...next[idx], name: e.target.value };
                          setParsedReceiptItems(next);
                        }}
                      />
                      <input
                        className="col-span-2 h-10 rounded-xl border bg-white px-3 text-xs"
                        value={(it.priceCents / 100).toString()}
                        inputMode="decimal"
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isFinite(v) || v < 0) return;
                          const next = [...parsedReceiptItems];
                          next[idx] = { ...next[idx], priceCents: Math.round(v * 100) };
                          setParsedReceiptItems(next);
                        }}
                      />
                      <input
                        className="col-span-1 h-10 rounded-xl border bg-white px-3 text-xs"
                        value={it.quantity.toString()}
                        inputMode="numeric"
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isFinite(v) || v < 1) return;
                          const next = [...parsedReceiptItems];
                          next[idx] = { ...next[idx], quantity: Math.round(v) };
                          setParsedReceiptItems(next);
                        }}
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => void addParsedReceiptItems()}
                  className="mt-3 h-11 w-full rounded-xl bg-black px-4 text-sm font-medium text-white"
                >
                  Add receipt items
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {data.items.length === 0 ? <p className="text-sm text-zinc-600">No items yet.</p> : null}

            {data.items.map((item) => {
              const assigned = new Set(data.assignmentsByItemId[item.id] ?? []);
              return (
                <div key={item.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <input
                        className="w-full border-0 bg-transparent p-0 text-sm font-medium outline-none"
                        value={item.name}
                        onChange={(e) => void updateItem(item.id, { name: e.target.value })}
                      />
                      <div className="mt-1 flex items-center gap-3 text-xs text-zinc-600">
                        <label className="flex items-center gap-1">
                          Price
                          <input
                            className="h-8 w-24 rounded-lg border px-2"
                            value={(item.priceCents / 100).toString()}
                            inputMode="decimal"
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (!Number.isFinite(v)) return;
                              void updateItem(item.id, { priceCents: Math.round(v * 100) });
                            }}
                          />
                        </label>
                        <label className="flex items-center gap-1">
                          Qty
                          <input
                            className="h-8 w-16 rounded-lg border px-2"
                            value={item.quantity.toString()}
                            inputMode="numeric"
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (!Number.isFinite(v) || v < 1) return;
                              void updateItem(item.id, { quantity: Math.round(v) });
                            }}
                          />
                        </label>
                      </div>
                    </div>
                    <button onClick={() => void deleteItem(item.id)} className="text-xs font-medium text-red-600 underline">
                      Delete
                    </button>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs font-medium text-zinc-700">Assign to</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {data.participants.map((p) => {
                        const checked = assigned.has(p.id);
                        return (
                          <label key={p.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = new Set(assigned);
                                if (e.target.checked) next.add(p.id);
                                else next.delete(p.id);
                                void setAssignments(item.id, Array.from(next));
                              }}
                            />
                            {p.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border bg-white p-4">
          <div className="text-sm font-medium">Tip</div>
          <div className="mt-2 flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.tip.enabled}
                onChange={(e) => void updateTip({ enabled: e.target.checked })}
              />
              Enable
            </label>
            <label className="ml-auto inline-flex items-center gap-2 text-sm">
              %
              <select
                className="h-10 rounded-xl border px-2 text-sm"
                value={data.tip.percentage}
                onChange={(e) => void updateTip({ percentage: Number(e.target.value) })}
                disabled={!data.tip.enabled}
              >
                {[0, 5, 10, 12.5, 15, 18, 20].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3">
            <div className="text-xs font-medium text-zinc-700">Distribute to</div>
            <div className="mt-2 flex gap-2">
              <button
                className={`h-10 flex-1 rounded-xl border text-sm ${data.tip.distributeToAll ? 'border-black bg-zinc-100' : ''}`}
                disabled={!data.tip.enabled}
                onClick={() => void updateTip({ distributeToAll: true })}
              >
                Everyone
              </button>
              <button
                className={`h-10 flex-1 rounded-xl border text-sm ${!data.tip.distributeToAll ? 'border-black bg-zinc-100' : ''}`}
                disabled={!data.tip.enabled}
                onClick={() => void updateTip({ distributeToAll: false })}
              >
                Selected
              </button>
            </div>

            {!data.tip.distributeToAll ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {data.participants.map((p) => {
                  const checked = data.tip.selectedParticipantIds.includes(p.id);
                  return (
                    <label key={p.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!data.tip.enabled}
                        onChange={(e) => {
                          const next = new Set(data.tip.selectedParticipantIds);
                          if (e.target.checked) next.add(p.id);
                          else next.delete(p.id);
                          void updateTip({ selectedParticipantIds: Array.from(next) });
                        }}
                      />
                      {p.name}
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border bg-white p-4">
          <div className="text-sm font-medium">Totals</div>
          {!totals ? null : (
            <>
              <div className="mt-2 space-y-2">
                {data.participants.map((p) => {
                  const t = totals.perPerson[p.id];
                  return (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">{p.name}</span>
                      <span className="font-medium">{money(t.totalCents)}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 border-t pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Subtotal</span>
                  <span>{money(totals.totals.subtotalCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Tip</span>
                  <span>{money(totals.totals.tipCents)}</span>
                </div>
                <div className="mt-1 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{money(totals.totals.totalCents)}</span>
                </div>
              </div>

              <p className="mt-3 text-xs text-zinc-600">
                Splits evenly across assigned participants per item. Tip splits evenly across the chosen recipients.
              </p>
            </>
          )}
        </section>

        <section className="mt-6 text-center text-xs text-zinc-500">
          MVP: no auth, no payments, updates refresh every ~2s.
        </section>
      </div>
    </div>
  );
}
