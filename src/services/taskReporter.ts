import { config } from "../config.js";
import { CompletedCard, TrelloCard, TrelloWebhookPayload } from "../types.js";
import { formatCompletedTaskMessage, normalizeText } from "../utils/text.js";
import { MessageQueue } from "./messageQueue.js";
import { SentStore } from "./sentStore.js";
import { TrelloClient } from "./trelloClient.js";

export class TaskReporter {
  constructor(
    private readonly trelloClient: TrelloClient,
    private readonly queue: MessageQueue,
    private readonly sentStore: SentStore,
  ) {}

  async listCompletedCards(): Promise<Array<CompletedCard & { alreadySent: boolean }>> {
    const [cards, sent] = await Promise.all([this.trelloClient.listCompletedCards(), this.sentStore.list()]);
    const sentIds = new Set(sent.map((record) => record.cardId));
    return cards.map((card) => ({ ...card, alreadySent: sentIds.has(card.id) }));
  }

  async enqueueCompletedCards(force = false): Promise<{ enqueuedCards: string[]; skippedCards: string[] }> {
    const cards = await this.trelloClient.listCompletedCards();
    const enqueuedCards: string[] = [];
    const skippedCards: string[] = [];

    for (const card of cards) {
      const enqueued = await this.enqueueCard(card, force);
      if (enqueued) {
        enqueuedCards.push(card.id);
      } else {
        skippedCards.push(card.id);
      }
    }

    return { enqueuedCards, skippedCards };
  }

  async enqueueCardById(cardId: string, force = false): Promise<{ enqueued: boolean; card: TrelloCard }> {
    const card = await this.trelloClient.getCard(cardId);
    const enqueued = await this.enqueueCard(card, force);
    return { enqueued, card };
  }

  async handleWebhook(payload: TrelloWebhookPayload): Promise<{ accepted: boolean; reason?: string; cardId?: string }> {
    const action = payload.action;

    if (!action?.data?.card?.id) {
      return { accepted: false, reason: "Payload sem card" };
    }

    const doneNames = new Set(config.TRELLO_DONE_LIST_NAMES.map(normalizeText));
    const movedToDone =
      action.type === "updateCard" &&
      action.data.listAfter?.name &&
      doneNames.has(normalizeText(action.data.listAfter.name));
    const markedDueComplete =
      action.type === "updateCard" && action.data.old?.dueComplete === false;

    if (!movedToDone && !markedDueComplete) {
      return { accepted: false, reason: "Acao nao representa conclusao", cardId: action.data.card.id };
    }

    await this.enqueueCardById(action.data.card.id);
    return { accepted: true, cardId: action.data.card.id };
  }

  private async enqueueCard(card: TrelloCard, force = false): Promise<boolean> {
    if (config.W_API_GROUP_IDS.length === 0) {
      throw new Error("Configure W_API_GROUP_IDS com pelo menos um grupo.");
    }

    if (!force && (await this.sentStore.has(card.id))) {
      return false;
    }

    const message = formatCompletedTaskMessage(card.name, card.desc);

    for (const groupId of config.W_API_GROUP_IDS) {
      this.queue.add({ cardId: card.id, groupId, message });
    }

    await this.sentStore.markSent(card.id, config.W_API_GROUP_IDS);
    return true;
  }
}
