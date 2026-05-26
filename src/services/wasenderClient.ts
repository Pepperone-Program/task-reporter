import axios, { AxiosError, AxiosInstance } from "axios";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

type WasenderGroup = {
  jid: string;
  name?: string;
  imgUrl?: string | null;
  [key: string]: unknown;
};

type WasenderListGroupsResponse =
  | { success: boolean; data: WasenderGroup[] }
  | { success: boolean; data: { items?: WasenderGroup[]; pagination?: unknown } };

export class WasenderClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: config.WASENDER_BASE_URL.replace(/\/$/, ""),
      timeout: 15000,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.WASENDER_ACCESS_TOKEN}`,
      },
    });
  }

  async listGroups(): Promise<WasenderGroup[]> {
    logger.info("Listando grupos na Wasender", { path: config.WASENDER_GROUPS_PATH });

    try {
      const { data } = await this.http.get<WasenderListGroupsResponse>(config.WASENDER_GROUPS_PATH, {
        params: { paginated: false },
      });

      const groups = Array.isArray(data.data) ? data.data : data.data.items ?? [];
      logger.info("Grupos retornados pela Wasender", { count: groups.length });
      return groups;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async sendGroupMessage(groupId: string, message: string): Promise<unknown> {
    const body = {
      to: groupId,
      text: message,
    };

    try {
      logger.info("Chamando endpoint send-message da Wasender", {
        path: config.WASENDER_SEND_TEXT_PATH,
        to: groupId,
        messageLength: message.length,
      });

      const { data } = await this.http.post(config.WASENDER_SEND_TEXT_PATH, body);

      logger.info("Wasender aceitou mensagem", {
        to: groupId,
        response: data,
      });

      return data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  private normalizeError(error: unknown): Error {
    if (!axios.isAxiosError(error)) {
      return error instanceof Error ? error : new Error("Erro desconhecido na Wasender");
    }

    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const data =
      typeof axiosError.response?.data === "string"
        ? axiosError.response.data
        : JSON.stringify(axiosError.response?.data ?? {});

    return new Error(`Wasender retornou erro${status ? ` ${status}` : ""}: ${data || axiosError.message}`);
  }
}
