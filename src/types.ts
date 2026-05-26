export type TrelloBoard = {
  id: string;
  name: string;
  url?: string;
  closed?: boolean;
};

export type TrelloList = {
  id: string;
  name: string;
  closed?: boolean;
};

export type TrelloCard = {
  id: string;
  name: string;
  desc: string;
  closed: boolean;
  dueComplete?: boolean;
  idList: string;
  shortUrl?: string;
  url?: string;
  dateLastActivity?: string;
};

export type CompletedCard = TrelloCard & {
  listName: string;
  completedBy: "list" | "dueComplete";
};

export type QueueJobStatus = "queued" | "running" | "succeeded" | "failed";

export type QueueJob = {
  id: string;
  cardId: string;
  groupId: string;
  attempts: number;
  status: QueueJobStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
};

export type TrelloWebhookPayload = {
  action?: {
    id: string;
    type: string;
    data?: {
      card?: { id: string; name?: string; desc?: string };
      listAfter?: { id: string; name: string };
      listBefore?: { id: string; name: string };
      old?: { dueComplete?: boolean };
    };
  };
  model?: unknown;
};
