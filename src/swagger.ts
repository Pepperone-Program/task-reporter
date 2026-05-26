export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Task Reporter API",
    version: "1.0.0",
    description: "API para notificar grupos do WhatsApp quando tarefas do Trello sao concluidas.",
  },
  servers: [{ url: "/" }],
  paths: {
    "/health": {
      get: {
        summary: "Verifica saude da aplicacao",
        responses: { "200": { description: "OK" } },
      },
    },
    "/groups": {
      get: {
        summary: "Listar grupos do WhatsApp via W-API",
        responses: { "200": { description: "Lista de grupos" } },
      },
    },
    "/boards": {
      get: {
        summary: "Listar boards do Trello acessiveis pelo token",
        responses: { "200": { description: "Lista de boards" } },
      },
    },
    "/cards/completed": {
      get: {
        summary: "Ver cards concluidos no board configurado",
        responses: { "200": { description: "Cards concluidos" } },
      },
    },
    "/tasks/send": {
      post: {
        summary: "Enviar tarefa concluida para os grupos do WhatsApp",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  cardId: { type: "string", description: "Opcional. Se omitido, envia todos os cards concluidos ainda nao enviados." },
                  force: { type: "boolean", description: "Reenvia mesmo se o card ja tiver sido marcado como enviado." },
                },
              },
            },
          },
        },
        responses: {
          "202": { description: "Envio enfileirado" },
          "400": { description: "Requisicao invalida" },
        },
      },
    },
    "/queue": {
      get: {
        summary: "Ver status da fila de envios",
        responses: { "200": { description: "Jobs da fila" } },
      },
    },
    "/webhooks/trello": {
      head: {
        summary: "Validacao do webhook pelo Trello",
        responses: { "200": { description: "OK" } },
      },
      post: {
        summary: "Receber eventos do webhook do Trello",
        responses: { "202": { description: "Evento aceito" } },
      },
    },
  },
};
