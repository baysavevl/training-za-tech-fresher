# API Contract

Base URL:

```text
http://localhost:8080
```

React UI routes:

```text
http://localhost:8080/          landing page
http://localhost:8080/ui        project automation console
http://localhost:8080/training  ZA Fresher Training portal
```

The Automation console is a local client for the same REST APIs below. The Training portal is a local study guide that maps PC/CS RPC/TE/OB topics to the runnable project, examples, exercises, and the 10-session roadmap. These UI routes do not introduce separate backend contracts.

Response lỗi chung:

```json
{
  "code": "BAD_REQUEST",
  "message": "workflow invalid: workflow must contain exactly one START node"
}
```

Correlation headers:

- `X-Request-Id`: dùng cho Mock Chat incoming message.
- `X-Trace-Id`: dùng cho conversation API cơ bản.

## 1. Create Automation

```http
POST /api/automations
Content-Type: application/json
```

Request:

```json
{
  "name": "Order support",
  "accountId": "training-account"
}
```

Response `201 Created`:

```json
{
  "id": "uuid",
  "accountId": "training-account",
  "name": "Order support",
  "enabled": true,
  "activeWorkflowVersionId": null,
  "createdAt": "2026-07-08T09:00:00Z",
  "updatedAt": "2026-07-08T09:00:00Z"
}
```

## 2. Update Automation

```http
PATCH /api/automations/{automationId}
Content-Type: application/json
```

Request:

```json
{
  "name": "Order support v2",
  "enabled": false
}
```

Response `200 OK`: same shape as create automation.

## 3. Create Workflow Draft

```http
POST /api/automations/{automationId}/workflows
Content-Type: application/json
```

Request:

```json
{
  "definition": {
    "nodes": [
      {"id": "start", "type": "START", "config": {}},
      {"id": "ask", "type": "QUESTION", "config": {"message": "Ban can ho tro gi?"}},
      {"id": "lookup", "type": "ACTION", "config": {"action": "ORDER_LOOKUP"}},
      {"id": "end", "type": "END", "config": {"message": "Da xu ly xong"}}
    ],
    "edges": [
      {"from": "start", "to": "ask", "matchType": "ALWAYS", "matchValue": ""},
      {"from": "ask", "to": "lookup", "matchType": "KEYWORD", "matchValue": "don hang"},
      {"from": "ask", "to": "end", "matchType": "FALLBACK", "matchValue": ""},
      {"from": "lookup", "to": "end", "matchType": "ALWAYS", "matchValue": ""}
    ]
  }
}
```

Response `201 Created`:

```json
{
  "id": "uuid",
  "automationId": "uuid",
  "version": 1,
  "status": "DRAFT",
  "createdAt": "2026-07-08T09:00:00Z",
  "publishedAt": null
}
```

## 4. Publish Workflow

```http
POST /api/automations/{automationId}/workflows/{workflowVersionId}/publish
```

Validation rules:

- Exactly one `START` node.
- Node ids must not be blank or duplicated.
- Edge endpoints must point to existing nodes.
- Non-`END` nodes must have at least one outgoing edge.
- Workflow must contain at least one `END` node.
- `MESSAGE` must define `config.message`.
- `QUESTION` must define `config.message`.
- `CONDITION` must define `config.rule`.
- `ACTION` must define `config.action`.

Response `200 OK`:

```json
{
  "id": "uuid",
  "automationId": "uuid",
  "version": 1,
  "status": "PUBLISHED",
  "createdAt": "2026-07-08T09:00:00Z",
  "publishedAt": "2026-07-08T09:00:10Z"
}
```

## 5. Incoming Mock Chat Message

```http
POST /api/mock-chat/messages
X-Request-Id: request-demo-001
Content-Type: application/json
```

Request:

```json
{
  "userId": "mock-user-001",
  "conversationId": null,
  "messageId": "msg-001",
  "accountId": "training-account",
  "automationId": "uuid",
  "text": "toi muon xem don hang A123"
}
```

`automationId` is preferred when the caller already knows the automation. If it is omitted, runtime resolves the latest enabled automation with a published workflow by `accountId`.

Response `200 OK`:

```json
{
  "conversationId": "uuid",
  "sessionId": "uuid",
  "executionId": "uuid",
  "response": "Order A123 dang duoc xu ly.",
  "outputs": [
    {
      "type": "TEXT",
      "text": "Order A123 dang duoc xu ly."
    }
  ],
  "currentNodeId": "end",
  "responseMessageId": "uuid",
  "duplicate": false,
  "status": "SUCCESS",
  "errorMessage": null
}
```

`response` is kept as a legacy convenience field for the local UI. `outputs` is the channel-independent output contract. Field names follow the existing Java/React camelCase convention, so the plan's `error_message` appears as `errorMessage` in this REST API.

Duplicate response example:

```json
{
  "conversationId": "uuid",
  "sessionId": "uuid",
  "executionId": "same original execution uuid",
  "response": "Order A123 dang duoc xu ly.",
  "outputs": [
    {
      "type": "TEXT",
      "text": "Order A123 dang duoc xu ly."
    }
  ],
  "currentNodeId": "end",
  "responseMessageId": "same original response uuid",
  "duplicate": true,
  "status": "DUPLICATE",
  "errorMessage": null
}
```

## 6. Conversation History

```http
GET /api/mock-chat/conversations/{conversationId}/history
```

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "senderType": "CUSTOMER",
      "content": "toi muon xem don hang A123",
      "traceId": "request-demo-001",
      "createdAt": "2026-07-08T09:00:00Z"
    },
    {
      "id": "uuid",
      "senderType": "BOT",
      "content": "Order A123 dang duoc xu ly.",
      "traceId": "request-demo-001",
      "createdAt": "2026-07-08T09:00:00Z"
    }
  ]
}
```

## 7. Current Session

```http
GET /api/mock-chat/conversations/{conversationId}/session
```

Response:

```json
{
  "id": "uuid",
  "conversationId": "uuid",
  "currentNodeId": "end",
  "status": "COMPLETED",
  "version": 1,
  "updatedAt": "2026-07-08T09:00:00Z"
}
```

## 8. Execution Trace By Conversation

```http
GET /api/mock-chat/conversations/{conversationId}/trace
```

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "requestId": "request-demo-001",
      "messageId": "msg-001",
      "conversationId": "uuid",
      "sessionId": "uuid",
      "nodeId": "end",
      "eventType": "ACTION_EXECUTED",
      "detailJson": "{\"previousNodeId\":\"ask_order_id\",\"currentNodeId\":\"end\",\"nodePath\":[\"ask_order_id\",\"lookup\",\"end\"],\"outputs\":[{\"type\":\"TEXT\",\"text\":\"Order A123 dang duoc xu ly.\"}],\"outcome\":{\"orderId\":\"A123\",\"status\":\"PROCESSING\"}}",
      "createdAt": "2026-07-08T09:00:00Z"
    }
  ]
}
```

## 9. Execution Trace By Execution

```http
GET /api/mock-chat/executions/{executionId}/trace
```

Response `200 OK`: one trace item with the same shape as an item in conversation trace.

## 10. Execution Trace By Session

```http
GET /api/mock-chat/sessions/{sessionId}/trace
```

Response `200 OK`: same shape as conversation trace, filtered by session.

## 11. Basic Conversation API

These endpoints are used for the introductory REST/session before workflow:

- `POST /api/customers`
- `POST /api/conversations`
- `POST /api/conversations/{conversationId}/messages`
- `GET /api/conversations/{conversationId}`

They are intentionally simpler than Mock Chat automation and are useful for teaching REST DTOs, validation, service layer, repository layer, and integration tests.
