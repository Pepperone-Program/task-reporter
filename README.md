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

- `GET /groups`: lista grupos via W-API.
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

## W-API

Configure `W_API_GROUP_IDS` com multiplos grupos separados por virgula.

O envio de mensagem usa o endpoint oficial:

```text
POST https://api.w-api.app/v1/message/send-text?instanceId=INSTANCE_ID
Authorization: Bearer TOKEN
Content-Type: application/json
```

Body:

```json
{
  "phone": "12036322036366919144@g.us",
  "message": "*Tarefa Concluída*\nTitulo\n\nDescricao",
  "delayMessage": 1
}
```

Se a W-API alterar alguma rota, ajuste:

- `W_API_GROUPS_PATH`
- `W_API_SEND_TEXT_PATH`

Os placeholders aceitos sao `{instanceId}` e `{groupId}`.
