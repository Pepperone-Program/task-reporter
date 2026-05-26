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

export function createApp() {
  const app = express();
  const trelloClient = new TrelloClient();
  const wApiClient = new WApiClient();
  const sentStore = new SentStore();
  const queue = new MessageQueue(wApiClient);
  const taskReporter = new TaskReporter(trelloClient, queue, sentStore);

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
        res.status(202).json(result);
        return;
      }

      const result = await taskReporter.enqueueCompletedCards(body.force);
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
    res.status(400).json({ error: "Validacao falhou", issues: error.issues });
    return;
  }

  const message = error instanceof Error ? error.message : "Erro inesperado";
  res.status(500).json({ error: message });
}
