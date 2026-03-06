export type BillSession = {
  id: string;
  currency: string;
  createdAt: string;
};

export type Participant = {
  id: string;
  sessionId: string;
  name: string;
  createdAt: string;
};

export type BillItem = {
  id: string;
  sessionId: string;
  name: string;
  priceCents: number;
  quantity: number;
  createdAt: string;
};

export type TipConfig = {
  sessionId: string;
  enabled: boolean;
  percentage: number;
  distributeToAll: boolean;
  selectedParticipantIds: string[];
};

export type BillState = {
  session: BillSession;
  participants: Participant[];
  items: BillItem[];
  assignmentsByItemId: Record<string, string[]>; // itemId -> participantIds
  tip: TipConfig;
};
