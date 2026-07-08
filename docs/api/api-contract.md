# API Contract

Base URL:

```text
http://localhost:8080
```

React UI:

```text
http://localhost:8080/
```

The UI is a local client for the same REST APIs below. It does not introduce a separate backend contract.

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
  "name": "Order support"
}
```

Response `201 Created`:

```json
{
  "id": "uuid",
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
- `QUESTION` must define `config.message`.
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
  "automationId": "uuid",
  "text": "toi muon xem don hang A123"
}
```

Response `200 OK`:

```json
{
  "conversationId": "uuid",
  "sessionId": "uuid",
  "response": "Order A123 dang duoc xu ly.",
  "currentNodeId": "end",
  "responseMessageId": "uuid",
  "duplicate": false
}
```

Duplicate response example:

```json
{
  "conversationId": "uuid",
  "sessionId": null,
  "response": "Order A123 dang duoc xu ly.",
  "currentNodeId": null,
  "responseMessageId": "same original response uuid",
  "duplicate": true
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

## 8. Execution Trace

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
      "detailJson": "{\"orderId\":\"A123\",\"status\":\"PROCESSING\"}",
      "createdAt": "2026-07-08T09:00:00Z"
    }
  ]
}
```

## 9. Basic Conversation API

These endpoints are used for the introductory REST/session before workflow:

- `POST /api/customers`
- `POST /api/conversations`
- `POST /api/conversations/{conversationId}/messages`
- `GET /api/conversations/{conversationId}`

They are intentionally simpler than Mock Chat automation and are useful for teaching REST DTOs, validation, service layer, repository layer, and integration tests.
