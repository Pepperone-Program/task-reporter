import { config } from "../config.js";
import { QueueJob } from "../types.js";
import { logger } from "../utils/logger.js";
import { WApiClient } from "./wApiClient.js";

type QueuePayload = {
  cardId: string;
  groupId: string;
  message: string;
};

type QueueHandlers = {
  onSucceeded?: (job: QueueJob) => void | Promise<void>;
  onFailed?: (job: QueueJob) => void | Promise<void>;
};

export class MessageQueue {
  private readonly jobs = new Map<string, QueueJob>();
  private readonly pending: Array<QueuePayload & { jobId: string }> = [];
  private activeCount = 0;
  private handlers: QueueHandlers = {};

  constructor(private readonly wApiClient: WApiClient) {}

  setHandlers(handlers: QueueHandlers): void {
    this.handlers = handlers;
  }

  add(payload: QueuePayload): QueueJob {
    const now = new Date().toISOString();
    const jobId = `${payload.cardId}:${payload.groupId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const job: QueueJob = {
      id: jobId,
      cardId: payload.cardId,
      groupId: payload.groupId,
      attempts: 0,
      status: "queued",
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(jobId, job);
    this.pending.push({ ...payload, jobId });
    logger.info("Mensagem adicionada na fila", {
      jobId,
      cardId: payload.cardId,
      groupId: payload.groupId,
      pending: this.pending.length,
    });
    this.process();
    return job;
  }

  list(): QueueJob[] {
    return [...this.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private process(): void {
    while (this.activeCount < config.QUEUE_CONCURRENCY && this.pending.length > 0) {
      const next = this.pending.shift();

      if (!next) {
        return;
      }

      this.activeCount += 1;
      void this.run(next).finally(() => {
        this.activeCount -= 1;
        this.process();
      });
    }
  }

  private async run(payload: QueuePayload & { jobId: string }): Promise<void> {
    const job = this.jobs.get(payload.jobId);

    if (!job) {
      return;
    }

    job.status = "running";
    job.updatedAt = new Date().toISOString();
    logger.info("Processando envio para WhatsApp", {
      jobId: job.id,
      cardId: job.cardId,
      groupId: job.groupId,
    });

    for (let attempt = 1; attempt <= config.QUEUE_RETRIES + 1; attempt += 1) {
      job.attempts = attempt;
      logger.info("Tentando enviar mensagem pela W-API", {
        jobId: job.id,
        cardId: job.cardId,
        groupId: job.groupId,
        attempt,
      });

      try {
        await this.wApiClient.sendGroupMessage(payload.groupId, payload.message);
        job.status = "succeeded";
        job.error = undefined;
        job.updatedAt = new Date().toISOString();
        logger.info("Mensagem enviada com sucesso pela W-API", {
          jobId: job.id,
          cardId: job.cardId,
          groupId: job.groupId,
          attempts: job.attempts,
        });
        await this.handlers.onSucceeded?.(job);
        return;
      } catch (error) {
        job.error = error instanceof Error ? error.message : "Erro desconhecido";
        job.updatedAt = new Date().toISOString();
        logger.error("Falha ao enviar mensagem pela W-API", {
          jobId: job.id,
          cardId: job.cardId,
          groupId: job.groupId,
          attempt,
          error: job.error,
        });

        if (attempt <= config.QUEUE_RETRIES) {
          await this.delay(config.QUEUE_RETRY_DELAY_MS * attempt);
        }
      }
    }

    job.status = "failed";
    job.updatedAt = new Date().toISOString();
    logger.error("Job falhou apos todas as tentativas", {
      jobId: job.id,
      cardId: job.cardId,
      groupId: job.groupId,
      attempts: job.attempts,
      error: job.error,
    });
    await this.handlers.onFailed?.(job);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
