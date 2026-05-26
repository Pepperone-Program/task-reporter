import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { z } from "zod";
import { MessageQueue } from "./services/messageQueue.js";
import { SentStore } from "./services/sentStore.js";
import { TaskReporter } from "./services/taskReporter.js";
import { TrelloClient } from "./services/trelloClient.js";
import { WApiClient } from "./services/wApiClient.js";
import { swaggerDocument } from "./swagger.js";
import { logger } from "./utils/logger.js";

export function createApp() {
  const app = express();
  const trelloClient = new TrelloClient();
  const wApiClient = new WApiClient();
  const sentStore = new SentStore();
  const queue = new MessageQueue(wApiClient);
  const taskReporter = new TaskReporter(trelloClient, queue, sentStore);
  queue.setHandlers({
    onSucceeded: (job) => taskReporter.handleJobSucceeded(job),
    onFailed: (job) => taskReporter.handleJobFailed(job),
  });

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("combined"));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/groups", async (_req, res, next) => {
    try {
      res.json({ groups: await wApiClient.listGroups() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/boards", async (_req, res, next) => {
    try {
      res.json({ boards: await trelloClient.listBoards() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/cards/completed", async (_req, res, next) => {
    try {
      res.json({ cards: await taskReporter.listCompletedCards() });
    } catch (error) {
      next(error);
    }
  });

  app.post("/tasks/send", async (req, res, next) => {
    try {
      const body = z
        .object({
          cardId: z.string().min(1).optional(),
          force: z.boolean().optional().default(false),
        })
        .parse(req.body ?? {});

      if (body.cardId) {
        const result = await taskReporter.enqueueCardById(body.cardId, body.force);
        logger.info("Requisicao manual de envio processada", { cardId: body.cardId, force: body.force, result });
        res.status(202).json(result);
        return;
      }

      const result = await taskReporter.enqueueCompletedCards(body.force);
      logger.info("Requisicao manual de envio em lote processada", { force: body.force, result });
      res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/queue", (_req, res) => {
    res.json({ jobs: queue.list() });
  });

  app.head("/webhooks/trello", (_req, res) => {
    res.sendStatus(200);
  });

  app.post("/webhooks/trello", async (req, res, next) => {
    try {
      const result = await taskReporter.handleWebhook(req.body);
      logger.info("Resultado do processamento do webhook do Trello", result);
      res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.locals.trelloClient = trelloClient;
  app.use(errorHandler);

  return app;
}

function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof z.ZodError) {
    logger.warn("Erro de validacao na API", { issues: error.issues });
    res.status(400).json({ error: "Validacao falhou", issues: error.issues });
    return;
  }

  const message = error instanceof Error ? error.message : "Erro inesperado";
  logger.error("Erro nao tratado na API", { error: message });
  res.status(500).json({ error: message });
}
