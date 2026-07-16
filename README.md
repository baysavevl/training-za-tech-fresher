# Conversation Automation System

Project mẫu để mentoring fresher backend Java qua một bài toán thực tế: hệ thống tự động hóa hội thoại. Repo này tập trung vào sản phẩm chạy được local, có API contract, workflow JSON, session state machine, database schema, idempotency, concurrency guard, structured log, debug trace, unit/integration test và giáo án training 10 buổi.

## Mục tiêu demo

Flow chính:

1. Tạo automation.
2. Tạo workflow JSON gồm `START`, `QUESTION`, `ACTION`, `END`.
3. Publish workflow sau khi validate.
4. Gửi message qua Mock Chat API.
5. Engine load active workflow, load session, match input, gọi mock action, lưu history/trace và trả automated response.
6. Gửi lại cùng `messageId` để thấy idempotency không xử lý trùng.

## Cấu trúc repo

- `conversation-app`: Spring Boot REST API, workflow engine, mock chat adapter, persistence, observability/debug API, static UI serving.
- `frontend`: React/Vite UI gồm landing page, Automation console, và ZA Fresher Training portal.
- `intent-contract`: protobuf/gRPC contract dùng cho phần học RPC.
- `intent-service`: service skeleton cho phần học RPC/internal service boundary.
- `docs/design`: kiến trúc, database, runtime flow.
- `docs/api`: API contract tương đương OpenAPI mức training.
- `docs/demo/http`: demo request có thể chạy bằng IntelliJ HTTP Client hoặc VS Code REST Client.
- `docs/training`: chương trình kiến thức 10 buổi, tách theo guideline PC/CS RPC/TE/OB.

## Yêu cầu local

- JDK 21 trở lên.
- Maven 3.9 trở lên.
- Node.js/npm để build React UI.

Máy hiện tại có thể cần set Java trước khi chạy Maven:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 24)
```

## Chạy test

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 24)
mvn test
```

Chạy riêng flow chính:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 24)
mvn -pl conversation-app -am -Dtest=MockChatFlowTest test
```

## Chạy ứng dụng

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 24)
mvn -pl conversation-app -am spring-boot:run
```

Ứng dụng dùng H2 in-memory mặc định:

- API base URL: `http://localhost:8080`
- Landing page: `http://localhost:8080/`
- Automation console: `http://localhost:8080/ui`
- ZA Fresher Training portal: `http://localhost:8080/training`
- H2 console: `http://localhost:8080/h2-console`
- JDBC URL: `jdbc:h2:mem:conversation_automation`
- Actuator metrics: `http://localhost:8080/actuator/metrics`

## Chạy React UI khi phát triển

Terminal 1:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 24)
mvn -pl conversation-app -am spring-boot:run
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Vite dev server chạy tại `http://localhost:5173` và proxy `/api`, `/actuator` về Spring Boot.

## Build một artifact có cả FE + BE

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 24)
mvn -Pwith-frontend clean package
$JAVA_HOME/bin/java -jar conversation-app/target/conversation-app-0.1.0-SNAPSHOT.jar
```

Mở UI tại:

- `http://localhost:8080/`: landing page để chọn luồng demo.
- `http://localhost:8080/ui`: Project Automation console để tạo workflow, gửi mock chat và xem debug trace.
- `http://localhost:8080/training`: ZA Fresher Training portal với topic PC/CS RPC/TE/OB, lộ trình học, ví dụ và bài tập.

Maven profile `with-frontend` chạy `npm ci`, build React, rồi copy `frontend/dist` vào Spring Boot static resources trước khi đóng gói JAR.

Chạy riêng RPC intent service cho session CS RPC:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 24)
mvn -pl intent-service -am spring-boot:run
```

gRPC server mặc định lắng nghe port `9091`.

## Demo nhanh

Sau khi app chạy, mở [docs/demo/http/conversation-automation.http](/Users/lap14894/Documents/VinhL/Code/Personal/training-za-tech-fresher/docs/demo/http/conversation-automation.http) và chạy lần lượt các request.

Các endpoint chính:

- `POST /api/automations`
- `PATCH /api/automations/{automationId}`
- `POST /api/automations/{automationId}/workflows`
- `POST /api/automations/{automationId}/workflows/{workflowVersionId}/publish`
- `POST /api/mock-chat/messages`
- `GET /api/mock-chat/conversations/{conversationId}/history`
- `GET /api/mock-chat/conversations/{conversationId}/session`
- `GET /api/mock-chat/conversations/{conversationId}/trace`
- `GET /api/mock-chat/executions/{executionId}/trace`
- `GET /api/mock-chat/sessions/{sessionId}/trace`

## Tài liệu training

- Kiến trúc: [docs/design/architecture.md](/Users/lap14894/Documents/VinhL/Code/Personal/training-za-tech-fresher/docs/design/architecture.md)
- Database: [docs/design/database.md](/Users/lap14894/Documents/VinhL/Code/Personal/training-za-tech-fresher/docs/design/database.md)
- API contract: [docs/api/api-contract.md](/Users/lap14894/Documents/VinhL/Code/Personal/training-za-tech-fresher/docs/api/api-contract.md)
- Chương trình kiến thức: [docs/training/knowledge-program.md](/Users/lap14894/Documents/VinhL/Code/Personal/training-za-tech-fresher/docs/training/knowledge-program.md)

## Điểm nhấn để mentoring

- Client/server và API contract: controller DTO, validation, error response.
- Workflow/state machine: `WorkflowDefinition`, `WorkflowValidator`, `WorkflowExecutionEngine`.
- Session/concurrency: `conversation_sessions`, `ConversationLockManager`, optimistic version check, version tăng theo từng message.
- Output contract: `ChatOutput`, `OutputType.TEXT`, response `outputs/status/errorMessage`, trace detail lưu output đã tạo.
- Idempotency: `message_idempotency` với khóa `(conversation_id, external_message_id)`, reuse response/execution id khi duplicate.
- Adapter pattern: `ChannelAdapter`, `MockChatChannelAdapter`, `ActionAdapter`.
- Observability: structured log, `execution_traces` có node path, debug APIs, actuator metrics outline.
- Testing: unit test cho engine/validator/idempotency/concurrency và integration test cho REST flow.
