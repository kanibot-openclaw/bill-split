import type { BillItem, TipConfig } from './types';

export function itemTotalCents(item: BillItem): number {
  return item.priceCents * item.quantity;
}

export function roundCents(n: number) {
  return Math.round(n);
}

export function computeTotals(params: {
  items: BillItem[];
  participants: { id: string; name: string }[];
  assignmentsByItemId: Record<string, string[]>;
  tip: TipConfig;
}) {
  const { items, participants, assignmentsByItemId, tip } = params;

  const perPerson: Record<string, { subtotalCents: number; tipCents: number; totalCents: number }> = {};
  for (const p of participants) {
    perPerson[p.id] = { subtotalCents: 0, tipCents: 0, totalCents: 0 };
  }

  // Subtotals
  for (const item of items) {
    const assigned = assignmentsByItemId[item.id] ?? [];
    if (assigned.length === 0) continue;

    const total = itemTotalCents(item);
    const split = total / assigned.length;

    for (const pid of assigned) {
      if (!perPerson[pid]) continue;
      perPerson[pid].subtotalCents += split;
    }
  }

  // Tip
  const allSubtotal = Object.values(perPerson).reduce((acc, v) => acc + v.subtotalCents, 0);
  const tipTotal = tip.enabled ? allSubtotal * (tip.percentage / 100) : 0;

  const tipRecipients = tip.enabled
    ? (tip.distributeToAll ? participants.map((p) => p.id) : tip.selectedParticipantIds)
    : [];

  if (tipRecipients.length > 0 && tipTotal > 0) {
    const split = tipTotal / tipRecipients.length;
    for (const pid of tipRecipients) {
      if (!perPerson[pid]) continue;
      perPerson[pid].tipCents += split;
    }
  }

  for (const pid of Object.keys(perPerson)) {
    perPerson[pid].subtotalCents = roundCents(perPerson[pid].subtotalCents);
    perPerson[pid].tipCents = roundCents(perPerson[pid].tipCents);
    perPerson[pid].totalCents = perPerson[pid].subtotalCents + perPerson[pid].tipCents;
  }

  return {
    perPerson,
    totals: {
      subtotalCents: roundCents(allSubtotal),
      tipCents: roundCents(tipTotal),
      totalCents: roundCents(allSubtotal + tipTotal),
    },
  };
}
