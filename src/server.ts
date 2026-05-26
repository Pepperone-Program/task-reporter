import { config } from "./config.js";
import { createApp } from "./app.js";
import { TrelloClient } from "./services/trelloClient.js";

const app = createApp();

app.listen(config.PORT, async () => {
  console.log(`Task Reporter rodando em http://localhost:${config.PORT}`);
  console.log(`Swagger em http://localhost:${config.PORT}/docs`);

  try {
    const result = await new TrelloClient().ensureBoardWebhook();

    if (result.skipped) {
      console.log("Webhook do Trello nao registrado: TRELLO_CALLBACK_URL nao foi configurado.");
      return;
    }

    console.log(result.created ? "Webhook do Trello registrado." : "Webhook do Trello ja existia.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error(`Falha ao registrar webhook do Trello: ${message}`);
  }
});
