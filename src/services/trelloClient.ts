import axios, { AxiosError, AxiosInstance } from "axios";
import { config } from "../config.js";
import { CompletedCard, TrelloBoard, TrelloCard, TrelloList } from "../types.js";
import { normalizeText } from "../utils/text.js";

export class TrelloClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: "https://api.trello.com/1",
      timeout: 10000,
      params: {
        key: config.TRELLO_API_KEY,
        token: config.TRELLO_TOKEN,
      },
    });
  }

  async listBoards(): Promise<TrelloBoard[]> {
    const { data } = await this.http.get<TrelloBoard[]>("/members/me/boards", {
      params: { fields: "id,name,url,closed", filter: "open" },
    });

    return data;
  }

  async getBoardLists(): Promise<TrelloList[]> {
    const { data } = await this.http.get<TrelloList[]>(`/boards/${config.TRELLO_BOARD_ID}/lists`, {
      params: { fields: "id,name,closed", filter: "open" },
    });

    return data;
  }

  async getBoardCards(): Promise<TrelloCard[]> {
    const { data } = await this.http.get<TrelloCard[]>(`/boards/${config.TRELLO_BOARD_ID}/cards`, {
      params: {
        fields: "id,name,desc,closed,dueComplete,idList,shortUrl,url,dateLastActivity",
        filter: "open",
      },
    });

    return data;
  }

  async getCard(cardId: string): Promise<TrelloCard> {
    const { data } = await this.http.get<TrelloCard>(`/cards/${cardId}`, {
      params: { fields: "id,name,desc,closed,dueComplete,idList,shortUrl,url,dateLastActivity" },
    });

    return data;
  }

  async listCompletedCards(): Promise<CompletedCard[]> {
    const [lists, cards] = await Promise.all([this.getBoardLists(), this.getBoardCards()]);
    const listById = new Map(lists.map((list) => [list.id, list]));
    const doneListNames = new Set(config.TRELLO_DONE_LIST_NAMES.map(normalizeText));

    return cards
      .map((card) => {
        const list = listById.get(card.idList);
        const isDoneList = list ? doneListNames.has(normalizeText(list.name)) : false;
        const completedBy = isDoneList ? "list" : card.dueComplete ? "dueComplete" : undefined;

        if (!completedBy || !list) {
          return undefined;
        }

        return {
          ...card,
          listName: list.name,
          completedBy,
        };
      })
      .filter((card): card is CompletedCard => Boolean(card));
  }

  async ensureBoardWebhook(): Promise<{ created: boolean; skipped: boolean; webhook?: unknown }> {
    if (!config.TRELLO_CALLBACK_URL) {
      return { created: false, skipped: true };
    }

    this.validateCallbackUrl(config.TRELLO_CALLBACK_URL);

    const existing = await this.listTokenWebhooks();
    const found = existing.find(
      (webhook) =>
        webhook.idModel === config.TRELLO_BOARD_ID && webhook.callbackURL === config.TRELLO_CALLBACK_URL,
    );

    if (found) {
      return { created: false, skipped: false, webhook: found };
    }

    try {
      const { data } = await this.http.post("/webhooks", undefined, {
        params: {
          callbackURL: config.TRELLO_CALLBACK_URL,
          idModel: config.TRELLO_BOARD_ID,
          description: config.TRELLO_WEBHOOK_DESCRIPTION,
          active: true,
        },
      });

      return { created: true, skipped: false, webhook: data };
    } catch (error) {
      throw this.normalizeTrelloError(error);
    }
  }

  private async listTokenWebhooks(): Promise<Array<{ idModel: string; callbackURL: string }>> {
    const { data } = await this.http.get<Array<{ idModel: string; callbackURL: string }>>(
      `/tokens/${config.TRELLO_TOKEN}/webhooks`,
    );

    return data;
  }

  private validateCallbackUrl(callbackUrl: string): void {
    if (!/^https?:\/\//i.test(callbackUrl)) {
      throw new Error(
        "TRELLO_CALLBACK_URL deve ser uma URL absoluta, por exemplo: https://seu-dominio.com/webhooks/trello",
      );
    }

    const parsed = new URL(callbackUrl);
    const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

    if (localHosts.has(parsed.hostname)) {
      throw new Error(
        "TRELLO_CALLBACK_URL nao pode usar localhost. O Trello precisa acessar uma URL publica que responda HEAD 200, por exemplo uma URL do ngrok ou do seu dominio em /webhooks/trello.",
      );
    }
  }

  private normalizeTrelloError(error: unknown): Error {
    if (!axios.isAxiosError(error)) {
      return error instanceof Error ? error : new Error("Erro desconhecido no Trello");
    }

    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const data =
      typeof axiosError.response?.data === "string"
        ? axiosError.response.data
        : JSON.stringify(axiosError.response?.data ?? {});

    return new Error(`Trello retornou erro${status ? ` ${status}` : ""}: ${data || axiosError.message}`);
  }
}
