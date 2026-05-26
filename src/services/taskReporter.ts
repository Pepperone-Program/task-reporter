import { config } from "../config.js";
import { CompletedCard, QueueJob, TrelloCard, TrelloWebhookPayload } from "../types.js";
import { logger } from "../utils/logger.js";
import { formatCompletedTaskMessage } from "../utils/text.js";
import { isDoneListName } from "../utils/trelloCompletion.js";
import { MessageQueue } from "./messageQueue.js";
import { SentStore } from "./sentStore.js";
import { TrelloClient } from "./trelloClient.js";

export class TaskReporter {
  private readonly inFlightCards = new Set<string>();
  private readonly successfulGroupsByCard = new Map<string, Set<string>>();

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
    logger.info("Varredura de cards concluidos finalizada", { cards: cards.length, force });
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
    logger.info("Buscando card no Trello antes de enfileirar", { cardId, force });
    const card = await this.trelloClient.getCard(cardId);
    const enqueued = await this.enqueueCard(card, force);
    return { enqueued, card };
  }

  async handleWebhook(payload: TrelloWebhookPayload): Promise<{ accepted: boolean; reason?: string; cardId?: string }> {
    const action = payload.action;
    logger.info("Webhook do Trello recebido", {
      actionId: action?.id,
      actionType: action?.type,
      cardId: action?.data?.card?.id,
      cardName: action?.data?.card?.name,
      listBefore: action?.data?.listBefore?.name,
      listAfter: action?.data?.listAfter?.name,
      old: action?.data?.old,
    });

    if (!action?.data?.card?.id) {
      logger.warn("Webhook ignorado: payload sem card", { actionId: action?.id, actionType: action?.type });
      return { accepted: false, reason: "Payload sem card" };
    }

    const movedToDone =
      action.type === "updateCard" &&
      action.data.listAfter?.name &&
      isDoneListName(action.data.listAfter.name, config.TRELLO_DONE_LIST_NAMES);
    const markedDueComplete =
      action.type === "updateCard" && action.data.old?.dueComplete === false;

    if (!movedToDone && !markedDueComplete) {
      logger.info("Webhook ignorado: acao nao representa conclusao", {
        actionId: action.id,
        actionType: action.type,
        cardId: action.data.card.id,
        listAfter: action.data.listAfter?.name,
        doneListNames: config.TRELLO_DONE_LIST_NAMES,
        old: action.data.old,
      });
      return { accepted: false, reason: "Acao nao representa conclusao", cardId: action.data.card.id };
    }

    const card = await this.trelloClient.getCard(action.data.card.id);

    if (markedDueComplete && card.dueComplete !== true) {
      logger.info("Webhook ignorado: dueComplete antigo era false, mas card atual nao esta concluido", {
        actionId: action.id,
        cardId: card.id,
        dueComplete: card.dueComplete,
      });
      return { accepted: false, reason: "Card atual nao esta com dueComplete=true", cardId: card.id };
    }

    await this.enqueueCard(card);
    logger.info("Webhook aceito e card enfileirado", {
      actionId: action.id,
      cardId: card.id,
      cardName: card.name,
      completedBy: movedToDone ? "list" : "dueComplete",
    });
    return { accepted: true, cardId: action.data.card.id };
  }

  async handleJobSucceeded(job: QueueJob): Promise<void> {
    const successfulGroups = this.successfulGroupsByCard.get(job.cardId) ?? new Set<string>();
    successfulGroups.add(job.groupId);
    this.successfulGroupsByCard.set(job.cardId, successfulGroups);

    logger.info("Sucesso registrado para grupo do card", {
      cardId: job.cardId,
      groupId: job.groupId,
      successfulGroups: successfulGroups.size,
      expectedGroups: config.W_API_GROUP_IDS.length,
    });

    if (config.W_API_GROUP_IDS.every((groupId) => successfulGroups.has(groupId))) {
      await this.sentStore.markSent(job.cardId, config.W_API_GROUP_IDS);
      this.inFlightCards.delete(job.cardId);
      this.successfulGroupsByCard.delete(job.cardId);
      logger.info("Card marcado como enviado apos sucesso em todos os grupos", {
        cardId: job.cardId,
        groups: config.W_API_GROUP_IDS,
      });
    }
  }

  handleJobFailed(job: QueueJob): void {
    this.inFlightCards.delete(job.cardId);
    logger.error("Card liberado para nova tentativa futura apos falha na fila", {
      cardId: job.cardId,
      groupId: job.groupId,
      error: job.error,
    });
  }

  private async enqueueCard(card: TrelloCard, force = false): Promise<boolean> {
    if (config.W_API_GROUP_IDS.length === 0) {
      throw new Error("Configure W_API_GROUP_IDS com pelo menos um grupo.");
    }

    if (!force && (await this.sentStore.has(card.id))) {
      logger.info("Card nao enfileirado porque ja foi enviado", { cardId: card.id, cardName: card.name });
      return false;
    }

    if (!force && this.inFlightCards.has(card.id)) {
      logger.info("Card nao enfileirado porque ja esta em processamento", { cardId: card.id, cardName: card.name });
      return false;
    }

    const message = formatCompletedTaskMessage(card.name, card.desc);
    this.inFlightCards.add(card.id);
    this.successfulGroupsByCard.set(card.id, new Set());

    logger.info("Enfileirando card concluido para WhatsApp", {
      cardId: card.id,
      cardName: card.name,
      groups: config.W_API_GROUP_IDS,
      messageLength: message.length,
    });

    for (const groupId of config.W_API_GROUP_IDS) {
      this.queue.add({ cardId: card.id, groupId, message });
    }
    return true;
  }
}
