# Task Reporter

API Node.js + TypeScript para notificar grupos do WhatsApp quando um card do Trello for concluido.

## Como rodar

1. Instale as dependencias:

```bash
npm install
```

2. Copie `.env.example` para `.env` e preencha as credenciais.

3. Rode em desenvolvimento:

```bash
npm run dev
```

4. Acesse o Swagger:

```text
http://localhost:3000/docs
```

## Endpoints

- `GET /groups`: lista grupos via Wasender.
- `GET /boards`: lista boards do Trello acessiveis pelo token.
- `GET /cards/completed`: mostra cards concluidos no board configurado.
- `POST /tasks/send`: enfileira envio de um card especifico ou de todos os concluidos.
- `GET /queue`: mostra status dos envios.
- `HEAD|POST /webhooks/trello`: callback usado pelo Trello para notificacao imediata.

## Envio principal

Para enviar todos os cards concluidos ainda nao enviados:

```http
POST /tasks/send
Content-Type: application/json

{}
```

Para enviar um card especifico:

```http
POST /tasks/send
Content-Type: application/json

{
  "cardId": "id-do-card",
  "force": false
}
```

## Webhook do Trello

Para envio imediato, configure `TRELLO_CALLBACK_URL` com uma URL publica apontando para:

```text
https://seu-dominio.com/webhooks/trello
```

Ao subir, a aplicacao tenta registrar o webhook no board configurado em `TRELLO_BOARD_ID`.
O Trello valida essa URL com uma chamada `HEAD`; por isso `localhost`, `127.0.0.1` e URLs sem `https://` ou `http://` nao funcionam. Em desenvolvimento local, use um tunnel como ngrok ou Cloudflare Tunnel.

O endpoint oficial para criar webhook e:

```bash
curl --request POST "https://api.trello.com/1/webhooks/?callbackURL=https://sua-aplicacao.com/webhooks/trello&idModel=ID_DO_QUADRO&key=SUA_API_KEY&token=SEU_TOKEN_DE_ACESSO&description=Webhook%20Task%20Reporter" \
  --header "Accept: application/json"
```

## Wasender

Configure `WASENDER_GROUP_IDS` com multiplos grupos separados por virgula.
Use os IDs reais dos grupos, no formato `12036322036366919144@g.us`. Valores como `grupo-1@g.us` e `grupo-2@g.us` sao apenas exemplos e nao entregam mensagens em grupos reais.

O envio de mensagem usa o endpoint oficial:

```text
POST https://www.wasenderapi.com/api/send-message
Authorization: Bearer TOKEN
Content-Type: application/json
```

Body:

```json
{
  "to": "12036322036366919144@g.us",
  "text": "*Tarefa Concluída*\nTitulo\n\nDescricao"
}
```

Quando a Wasender responde com `success: true`, ela aceitou o envio. A entrega final depende da sessao estar conectada e do `to` ser um contato/grupo valido para essa sessao.

Para listar grupos, a aplicacao usa:

```text
GET https://www.wasenderapi.com/api/groups
Authorization: Bearer TOKEN
```

Se a Wasender alterar alguma rota, ajuste:

- `WASENDER_GROUPS_PATH`
- `WASENDER_SEND_TEXT_PATH`
