import { config } from "./config.js";
import { createApp } from "./app.js";
import { TrelloClient } from "./services/trelloClient.js";
import { logger } from "./utils/logger.js";

const app = createApp();

app.listen(config.PORT, async () => {
  console.log(`Task Reporter rodando em http://localhost:${config.PORT}`);
  console.log(`Swagger em http://localhost:${config.PORT}/docs`);
  logger.info("Configuracao carregada", {
    trelloBoardId: config.TRELLO_BOARD_ID,
    trelloCallbackUrl: config.TRELLO_CALLBACK_URL || null,
    trelloDoneListNames: config.TRELLO_DONE_LIST_NAMES,
    wApiBaseUrl: config.W_API_BASE_URL,
    wApiSendTextPath: config.W_API_SEND_TEXT_PATH,
    wApiInstanceId: config.W_API_INSTANCE_ID,
    wApiGroups: config.W_API_GROUP_IDS,
    queueConcurrency: config.QUEUE_CONCURRENCY,
    queueRetries: config.QUEUE_RETRIES,
  });

  try {
    const result = await new TrelloClient().ensureBoardWebhook();

    if (result.skipped) {
      logger.warn("Webhook do Trello nao registrado: TRELLO_CALLBACK_URL nao foi configurado.");
      return;
    }

    logger.info(result.created ? "Webhook do Trello registrado" : "Webhook do Trello ja existia");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("Falha ao registrar webhook do Trello", { error: message });
  }
});
