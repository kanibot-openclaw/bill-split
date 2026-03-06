'use client';

import { useState } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startNewBill() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bill/new', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create bill');
      const data = (await res.json()) as { id: string };
      window.location.href = `/bill/${data.id}`;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Bill Split</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Collaborative restaurant bill splitting. No accounts. Share a link.
        </p>

        <button
          onClick={startNewBill}
          disabled={loading}
          className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-black px-5 font-medium text-white disabled:opacity-60"
        >
          {loading ? 'Creating…' : 'Start New Bill'}
        </button>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-10 rounded-xl border bg-white p-4 text-sm text-zinc-700">
          <div className="font-medium">MVP notes</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Anyone with the link can join and edit.</li>
            <li>Hardcoded currency for now (CLP).</li>
            <li>Live updates are done via frequent refresh (simple + reliable).</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
