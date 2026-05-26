import axios, { AxiosError, AxiosInstance } from "axios";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

type Group = {
  id?: string;
  jid?: string;
  groupId?: string;
  name?: string;
  subject?: string;
  [key: string]: unknown;
};

export class WApiClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: config.W_API_BASE_URL.replace(/\/$/, ""),
      timeout: 15000,
      headers: {
        "Content-Type": "application/json",
        ...(config.W_API_KEY ? { "x-api-key": config.W_API_KEY, apikey: config.W_API_KEY } : {}),
        ...(config.W_API_TOKEN ? { Authorization: `Bearer ${config.W_API_TOKEN}` } : {}),
      },
    });
  }

  async listGroups(): Promise<Group[]> {
    const { data } = await this.http.get(this.buildPath(config.W_API_GROUPS_PATH));
    const groups = Array.isArray(data) ? data : data?.groups ?? data?.data ?? [];
    return Array.isArray(groups) ? groups : [];
  }

  async sendGroupMessage(groupId: string, message: string): Promise<unknown> {
    const path = this.buildPath(config.W_API_SEND_TEXT_PATH, groupId);
    const body = {
      phone: groupId,
      message,
      delayMessage: config.W_API_DELAY_MESSAGE,
    };

    try {
      logger.info("Chamando endpoint send-text da W-API", {
        path,
        instanceId: config.W_API_INSTANCE_ID,
        phone: groupId,
        messageLength: message.length,
        delayMessage: config.W_API_DELAY_MESSAGE,
      });
      const { data } = await this.http.post(path, body, {
        params: { instanceId: config.W_API_INSTANCE_ID },
      });
      logger.info("W-API aceitou mensagem", {
        phone: groupId,
        response: data,
      });
      return data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  private buildPath(template: string, groupId?: string): string {
    return template
      .replaceAll("{instanceId}", encodeURIComponent(config.W_API_INSTANCE_ID))
      .replaceAll("{groupId}", encodeURIComponent(groupId ?? ""));
  }

  private normalizeError(error: unknown): Error {
    if (!axios.isAxiosError(error)) {
      return error instanceof Error ? error : new Error("Erro desconhecido na W-API");
    }

    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const data =
      typeof axiosError.response?.data === "string"
        ? axiosError.response.data
        : JSON.stringify(axiosError.response?.data ?? {});

    return new Error(`W-API retornou erro${status ? ` ${status}` : ""}: ${data || axiosError.message}`);
  }
}
