export const trainingTopics = [
  {
    id: 'pc',
    label: 'PC 01',
    title: 'Parallelism & Concurrency',
    summary: 'How multiple messages, threads, and shared session state interact in a backend service.',
    definition: 'Concurrency is the ability of a system to make progress on multiple tasks during overlapping time windows. Parallelism is when tasks literally run at the same time on different CPU cores or workers.',
    explanation: 'A conversation system receives messages from many users at once. Different conversations can be processed independently, but messages in the same conversation must update session state in order. Without a clear consistency rule, two messages can both read the same current node and write conflicting next states.',
    example: {
      title: 'Two messages hit the same conversation',
      steps: [
        'Message A and Message B arrive within the same second for conversation C-100.',
        'Both messages try to load the same conversation session and current node.',
        'The service must serialize updates for C-100 while still allowing C-101 and C-102 to run in parallel.'
      ]
    },
    demo: {
      consolePath: '/ui',
      action: 'Replay duplicate',
      text: 'Use the Automation Console to send an order message, then replay the same message ID and inspect that history does not grow.',
      projectHooks: ['ConversationLockManager', 'message_idempotency', 'conversation_sessions.version', 'ConversationLockManagerTest']
    },
    chart: {
      title: 'Same-conversation lock timeline',
      nodes: [
        { label: 'Message A', detail: 'Acquire conversation lock', tone: 'blue' },
        { label: 'Session update', detail: 'Move current_node_id once', tone: 'yellow' },
        { label: 'Message B', detail: 'Wait, then re-check state', tone: 'green' }
      ]
    },
    lecture: {
      sections: [
        'Define process, thread, task, critical section, shared mutable state, and why chat sessions are stateful.',
        'Compare parallel work across conversations with serialized work inside the same conversation.',
        'Explain idempotency as a concurrency companion: retry-safe APIs need both duplicate detection and state protection.'
      ],
      reading: [
        'Code: conversation-app/mockchat/ConversationLockManager.java',
        'Schema: message_idempotency and conversation_sessions.version',
        'Test: ConversationLockManagerTest and MockChatFlowTest duplicate branch'
      ],
      lab: [
        'Send one normal order message in the Automation Console.',
        'Replay the same message ID and inspect History to confirm no duplicate rows.',
        'Discuss how this local lock would change in a multi-node deployment.'
      ]
    },
    conceptDemo: {
      id: 'pc',
      title: 'Concurrent delivery and duplicate replay lab',
      scenario: 'A chat channel retries delivery while another message for the same conversation arrives. Freshers inspect why duplicate delivery is reused and why same-conversation session updates must be serialized.',
      steps: [
        'Run the full demo once to create a conversation and session.',
        'Use Replay duplicate with the same message_id and compare the response with the original response.',
        'Explain which fields protect the system: conversation_id lock, message_id idempotency key, and session version.'
      ],
      evidence: ['History row count stays stable', 'Duplicate response has duplicate=true', 'Session current_node_id is not advanced twice'],
      mentorPrompt: 'Ask the fresher what would break if two app instances processed the same conversation without a shared lock or optimistic version check.'
    }
  },
  {
    id: 'rpc',
    label: 'CS RPC 01',
    title: 'Client/Server & RPC',
    summary: 'How contracts define the boundary between chat clients, REST APIs, and internal services.',
    definition: 'Client/server design separates the caller that requests a capability from the service that owns the data and behavior. RPC is a contract style where a client calls a named remote procedure through generated or agreed request/response types.',
    explanation: 'The mock chat client should not know workflow internals. It sends an incoming message to a stable API. The Automation Service owns validation, session state, and workflow execution. RPC becomes useful for typed internal calls such as intent classification, where protobuf defines a schema and generated stubs reduce contract drift.',
    example: {
      title: 'Mock Chat calls Automation Service',
      steps: [
        'The chat client sends userId, conversationId, messageId, automationId, and text.',
        'The Channel Adapter normalizes that payload into an internal inbound message.',
        'The service returns a bot response without exposing database or workflow implementation details.'
      ]
    },
    demo: {
      consolePath: '/ui',
      action: 'Create and publish workflow',
      text: 'Use the console to create an automation, publish a workflow, then inspect the REST request shape in the browser network tab or API docs.',
      projectHooks: ['MockChatController', 'MockChatChannelAdapter', 'intent_classifier.proto', 'IntentClassifierGrpcServiceTest']
    },
    chart: {
      title: 'Contract boundary path',
      nodes: [
        { label: 'Client', detail: 'Mock Chat request', tone: 'blue' },
        { label: 'Adapter', detail: 'Normalize payload', tone: 'red' },
        { label: 'Service', detail: 'Execute workflow', tone: 'green' },
        { label: 'RPC hook', detail: 'Typed internal call', tone: 'yellow' }
      ]
    },
    lecture: {
      sections: [
        'Define client/server ownership: the caller owns intent and the service owns data, rules, and persistence.',
        'Separate REST resource APIs from RPC-style internal contracts and identify when each contract style fits.',
        'Explain schema evolution, request/response DTOs, validation, correlation headers, and service boundary testing.'
      ],
      reading: [
        'Code: MockChatController, AutomationController, MockChatChannelAdapter',
        'Contract: docs/api/api-contract.md',
        'RPC hook: intent-contract/src/main/proto/intent_classifier.proto'
      ],
      lab: [
        'Create an automation through the console and map the request to POST /api/automations.',
        'Publish the workflow and inspect how workflow versioning protects runtime execution.',
        'Open the proto contract and discuss what changes are backward compatible.'
      ]
    },
    conceptDemo: {
      id: 'rpc',
      title: 'API contract and channel adapter lab',
      scenario: 'A mock chat client sends a channel-specific payload. Freshers map that payload to the stable REST contract, then follow how the adapter converts it into the internal inbound message.',
      steps: [
        'Open the Automation Console and identify every field in the Mock chat panel.',
        'Map each field to MockIncomingMessageRequest and the X-Request-Id header.',
        'Compare the controller DTO with InboundChatMessage and explain what the adapter hides from the engine.'
      ],
      evidence: ['Request body maps one-to-one to DTO fields', 'Adapter output has a normalized inbound message', 'Controller response does not expose workflow internals'],
      mentorPrompt: 'Ask which field can change when adding a second channel and which service contract must remain stable.'
    }
  },
  {
    id: 'te',
    label: 'TE 01',
    title: 'Testing Engineering',
    summary: 'How test levels protect workflow logic, API behavior, and mentoring exercises.',
    definition: 'Testing engineering is the practice of designing code and verification strategy so important behavior can be checked quickly, repeatedly, and at the right level of isolation.',
    explanation: 'Workflow routing is pure domain logic and should be tested without Spring or a database. API behavior needs integration tests because validation, JSON binding, and persistence interact. A good training project shows both levels so freshers learn when a unit test is enough and when a full flow test is required.',
    example: {
      title: 'Fallback route regression',
      steps: [
        'A QUESTION node accepts a keyword such as order.',
        'A user enters unrelated text that does not match any option.',
        'The engine must follow the FALLBACK edge and tests should lock that behavior before changes.'
      ]
    },
    demo: {
      consolePath: '/ui',
      action: 'Load sample workflow',
      text: 'Send a message that does not contain the order keyword and compare the response with the fallback path in the workflow JSON.',
      projectHooks: ['WorkflowExecutionEngineTest', 'WorkflowValidatorTest', 'MockChatFlowTest', 'ContextSmokeTest']
    },
    chart: {
      title: 'Testing pyramid for this project',
      nodes: [
        { label: 'Unit', detail: 'Engine and validator', tone: 'green' },
        { label: 'Integration', detail: 'MockMvc API flow', tone: 'blue' },
        { label: 'Smoke', detail: 'Application context', tone: 'yellow' }
      ]
    },
    lecture: {
      sections: [
        'Define unit, integration, smoke, and regression tests using real examples from the project.',
        'Teach testability by separating pure workflow execution from HTTP, database, and adapter boundaries.',
        'Show how a failing test should describe behavior first, then guide the implementation.'
      ],
      reading: [
        'Code: WorkflowExecutionEngineTest and WorkflowValidatorTest',
        'Integration: ConversationApiTest and MockChatFlowTest',
        'Smoke: ContextSmokeTest and IntentServiceContextTest'
      ],
      lab: [
        'Change a workflow fallback rule and predict which test level should catch it.',
        'Write a new unit test for an OPTION edge before changing the engine.',
        'Run mvn test and explain the cost difference between fast unit tests and full integration tests.'
      ]
    },
    conceptDemo: {
      id: 'te',
      title: 'Workflow validation and fallback regression lab',
      scenario: 'A mentor intentionally breaks workflow JSON and asks freshers to predict whether validation, unit tests, or integration tests should catch the behavior.',
      steps: [
        'Remove one required edge from the sample workflow and publish it to trigger validation.',
        'Restore the workflow and send a message that does not match the order keyword.',
        'Locate the fallback response and name the test level that should protect that branch.'
      ],
      evidence: ['Publish returns a structured validation error', 'Fallback branch produces the expected bot response', 'WorkflowExecutionEngineTest covers routing without Spring'],
      mentorPrompt: 'Ask the fresher to write the test name before changing any workflow engine code.'
    }
  },
  {
    id: 'ob',
    label: 'OB 01',
    title: 'Observability',
    summary: 'How logs, traces, and metrics make workflow execution debuggable.',
    definition: 'Observability is the ability to understand what a system is doing from its emitted signals: structured logs, metrics, traces, and durable debug records.',
    explanation: 'In a workflow system, a generic success log is not enough. A mentor should teach freshers to include request_id, message_id, conversation_id, session_id, and node_id so a production issue can be reconstructed from the user message to the exact workflow node that handled it.',
    example: {
      title: 'Debug a wrong bot response',
      steps: [
        'A user reports that the bot ended the conversation too early.',
        'The mentor searches by conversation_id and opens history plus execution trace.',
        'The trace shows which node and match rule selected the final response.'
      ]
    },
    demo: {
      consolePath: '/ui',
      action: 'Refresh debug',
      text: 'After sending a message, open the History, Session, and Debug Trace panels to connect log fields with persisted trace rows.',
      projectHooks: ['MockChatService structured log', 'execution_traces', '/trace API', '/actuator/metrics']
    },
    chart: {
      title: 'Signal pipeline',
      nodes: [
        { label: 'Request', detail: 'X-Request-Id', tone: 'blue' },
        { label: 'Execution', detail: 'node_id and status', tone: 'green' },
        { label: 'Trace', detail: 'Persist debug rows', tone: 'red' },
        { label: 'Metrics', detail: 'Actuator endpoint', tone: 'yellow' }
      ]
    },
    lecture: {
      sections: [
        'Define logs, metrics, traces, and durable debug records, then show what each signal answers.',
        'Explain correlation IDs and why workflow incidents require request_id, message_id, conversation_id, session_id, and node_id.',
        'Connect structured logs with the debug APIs so freshers can reconstruct a real message path.'
      ],
      reading: [
        'Code: MockChatService structured log statement',
        'Schema: execution_traces and action_executions tables',
        'Endpoints: /api/mock-chat/conversations/{conversationId}/trace and /actuator/metrics'
      ],
      lab: [
        'Send a message and open History, Session, and Debug Trace.',
        'Find the same request_id in response, trace rows, and service logs.',
        'Design one counter and one latency metric for ACTION node execution.'
      ]
    },
    conceptDemo: {
      id: 'ob',
      title: 'Message trace reconstruction lab',
      scenario: 'A user reports a wrong response. Freshers reconstruct the path from request_id to history row, current session, execution trace, and structured service log.',
      steps: [
        'Run the full demo and copy the request_id, message_id, conversation_id, session_id, and node_id.',
        'Open History, Session, and Debug Trace to connect persisted debug records.',
        'Read the structured log line and explain which signal answers what happened, where, and why.'
      ],
      evidence: ['Trace row includes request_id and node_id', 'History shows user and bot messages', 'Service log can be searched by the same correlation identifiers'],
      mentorPrompt: 'Ask which fields must be present in every log line before the team can debug a production incident quickly.'
    }
  }
]

export const projectBrief = {
  title: 'Conversation Automation System',
  subtitle: 'A runnable Java backend and React console used to train freshers on backend engineering fundamentals.',
  tabs: [
    {
      id: 'description',
      label: 'Description',
      summary: 'Project scope used to double check what the backend, automation engine, and training console must demonstrate.',
      groups: [
        {
          title: 'Khởi tạo project & Mock Chat API',
          items: [
            'Dựng ứng dụng backend Java có thể chạy local.',
            'Xây dựng Mock Chat Service để giả lập user gửi message và nhận automated response.',
            'Viết API cơ bản cho conversation, message history và incoming message.'
          ]
        },
        {
          title: 'Automation Configuration & Workflow Management',
          items: [
            'Xây dựng API quản lý Automation và Workflow.',
            'Cho phép tạo, cập nhật, enable/disable automation.',
            'Cho phép tạo workflow bằng JSON và publish workflow version.',
            'Workflow hỗ trợ node START, MESSAGE, QUESTION, CONDITION, ACTION, HANDOFF, END.',
            'Validate workflow trước khi publish để tránh flow sai cấu trúc.'
          ]
        },
        {
          title: 'Automation Execution Engine',
          items: [
            'Xử lý message từ Mock Chat bằng workflow active và session hiện tại.',
            'Load session, xử lý node tương ứng, chọn next node, cập nhật session và trả response.',
            'Hỗ trợ option, keyword, condition và fallback khi input không hợp lệ.',
            'Lưu conversation history và execution trace để debug.'
          ]
        },
        {
          title: 'Session, Concurrency & Reliability',
          items: [
            'Quản lý trạng thái hội thoại theo từng user/conversation.',
            'Xử lý nhiều conversation chạy song song.',
            'Xử lý duplicate message bằng message_id/idempotency.',
            'Đảm bảo session không bị update sai khi nhiều message đến gần nhau.',
            'Xử lý lỗi rõ ràng khi workflow, session hoặc action bị lỗi.'
          ]
        },
        {
          title: 'Action, Adapter & Observability',
          items: [
            'Thiết kế Channel Adapter để tách logic chat khỏi automation engine.',
            'Xây dựng ACTION node gọi mock external service như order lookup, ticket creation hoặc webhook.',
            'Ghi structured log với request_id, message_id, conversation_id, session_id, node_id.',
            'Cung cấp API xem conversation history, current session và execution trace.'
          ]
        },
        {
          title: 'Nâng cao (Optional)',
          items: [
            'Xử lý ACTION node bất đồng bộ bằng queue/worker.',
            'Retry/backoff khi action hoặc webhook thất bại.',
            'Dead-letter/failed task storage.',
            'Session cleanup job cho session hết hạn.',
            'Rate limit theo user/conversation/automation.',
            'Workflow validation nâng cao: unreachable node, circular flow, missing config.',
            'Web UI đơn giản để gửi message, tạo workflow và xem debug trace.',
            'Metrics endpoint hoặc dashboard đơn giản.'
          ]
        }
      ]
    },
    {
      id: 'requirements',
      label: 'Requirements',
      summary: 'Knowledge requirements freshers must explain after building and demoing the project.',
      items: [
        'Hiểu mô hình Client & Server và thiết kế API contract giữa Mock Chat, Channel Adapter và Automation Service.',
        'Hiểu RESTful API, request/response model, validation, error handling và API documentation.',
        'Hiểu cách mô hình hóa workflow bằng JSON, node, edge, condition và action.',
        'Hiểu state machine và session management trong bài toán hội thoại nhiều bước.',
        'Biết thiết kế database schema cho automation config, workflow version, session, message history, execution trace và action execution.',
        'Hiểu Parallelism & Concurrency: nhiều user gửi message đồng thời, duplicate message, race condition và concurrent update session.',
        'Biết áp dụng idempotency, transaction/locking hoặc cơ chế tương đương để đảm bảo xử lý message và session state an toàn.',
        'Hiểu reliability cơ bản: retry, fallback handling, failed task và error handling.',
        'Biết thiết kế Channel Adapter để dễ mở rộng sang channel khác.',
        'Nắm được Observability cơ bản: structured log, correlation ID, execution trace, metrics outline và debug API.',
        'Có khả năng viết unit test, integration test, README, setup guide và tài liệu kiến trúc.'
      ]
    },
    {
      id: 'expected-output',
      label: 'Expected output',
      summary: 'Concrete deliverables that must exist in the repository and local demo before the mentoring program is considered complete.',
      items: [
        'Source code backend chạy được local bằng Docker Compose hoặc setup guide rõ ràng.',
        'Có Mock Chat Service để demo user gửi message và nhận response.',
        'Có API quản lý automation, workflow và publish workflow version.',
        'Có API nhận incoming message và xử lý automation flow.',
        'Có database schema cho automation, workflow, session, message history, execution trace và action execution.',
        'Có idempotency để tránh xử lý trùng message.',
        'Có xử lý fallback khi user input không match rule.',
        'Có cơ chế hạn chế race condition khi update session.',
        'Có structured log và API xem conversation history/execution trace.',
        'Có OpenAPI/Swagger hoặc tài liệu API tương đương.',
        'Có unit test cho core logic và integration test cho flow chính.',
        'Có README, architecture document và demo script.'
      ]
    },
    {
      id: 'review-checkpoint',
      label: 'Review checkpoint',
      summary: 'Lead engineer review prompts used to verify design quality, code quality, and training coverage.',
      items: [
        'Product behavior is clear before code review: who sends a message, what response is expected, and which failure path is acceptable.',
        'REST API contract is documented with request body, response body, validation error, and correlation header.',
        'Workflow JSON has a clear graph model: nodes, edges, condition rules, fallback edge, and terminal node.',
        'Publish flow performs workflow validation before runtime activation.',
        'State machine execution is deterministic, testable, and separated from persistence side effects.',
        'Session ownership is explicit: which table stores current node, who updates it, and how version/concurrency is protected.',
        'Idempotency behavior is reviewable: same message_id returns the same result and does not duplicate history.',
        'Concurrent messages in the same conversation are serialized or guarded by equivalent locking/transaction logic.',
        'ACTION adapter failure path has timeout, error mapping, trace record, and retry/backoff design notes.',
        'Observability fields are present in logs and trace: request_id, message_id, conversation_id, session_id, node_id.',
        'Tests cover workflow validation, engine routing, fallback behavior, duplicate message replay, and main API flow.',
        'Docs explain setup, database design, API contract, architecture, demo script, and known optional extensions.'
      ]
    },
    {
      id: 'demo-checkpoint',
      label: 'Demo checkpoint',
      summary: 'Step-by-step demo flow for validating that the runnable product proves the required backend concepts.',
      items: [
        'Open Project brief and compare Description, Requirements, Expected output, Review checkpoint, and Demo checkpoint.',
        'Open Automation Console and create a new automation from the UI.',
        'Load sample workflow JSON, save workflow draft, then publish workflow version successfully.',
        'Send an order lookup message through Mock Chat and verify automated response.',
        'Open History and confirm both user message and bot response are persisted.',
        'Open Session and Debug Trace to follow current_node_id, node_id, request_id, and action execution evidence.',
        'Replay duplicate message_id and verify the same response is reused without duplicate history rows.',
        'Open at least one Concept Lab and run its topic-specific demo instead of using one generic project demo.',
        'Open Source Viewer for one Markdown document and one SQL or Java reference from the roadmap detail.',
        'Use the checklist to confirm output coverage before ending the fresher review.'
      ]
    }
  ]
}

export const learningSessions = [
  {
    number: '01',
    duration: '90 min',
    topicId: 'rpc',
    title: 'Product, client/server, REST contract',
    demo: 'Create a customer conversation from the console and map every UI field to the REST API contract.',
    lesson: 'Start from the product behavior, define client responsibility, service responsibility, request body, response body, validation rule, and failure contract before reading the implementation.',
    reading: ['docs/api/api-contract.md', 'MockChatController and AutomationController'],
    lab: ['Create an automation from the console.', 'Map each form field to a REST request field.']
  },
  {
    number: '02',
    duration: '90 min',
    topicId: 'rpc',
    title: 'Database design',
    demo: 'Walk through config tables, runtime state tables, message history, trace rows, and the idempotency key.',
    lesson: 'Separate tables by lifecycle: automation configuration changes slowly, workflow versions are immutable once published, sessions change per message, and traces are append-only debug evidence.',
    reading: ['docs/design/database.md', 'conversation-app/src/main/resources/schema.sql'],
    lab: ['Draw the schema groups on a whiteboard.', 'Explain which indexes protect common debug queries.']
  },
  {
    number: '03',
    duration: '90 min',
    topicId: 'te',
    title: 'Workflow JSON and publish validation',
    demo: 'Edit the sample workflow, break a validation rule, then publish a corrected version.',
    lesson: 'Treat workflow JSON as a graph contract. Validation should reject missing START nodes, invalid edge targets, missing node config, and unsafe runtime paths before publish.',
    reading: ['WorkflowValidator.java', 'WorkflowDefinition.java'],
    lab: ['Remove the START edge and observe publish failure.', 'Add a validation test before changing validator logic.']
  },
  {
    number: '04',
    duration: '90 min',
    topicId: 'te',
    title: 'State machine execution engine',
    demo: 'Trace START to QUESTION to ACTION to END while watching current_node_id move.',
    lesson: 'A conversation workflow is a state machine. The engine should be deterministic, stateless, and testable while the service layer owns persistence and side effects.',
    reading: ['WorkflowExecutionEngine.java', 'WorkflowExecutionEngineTest.java'],
    lab: ['Send a matching order message.', 'Explain why the session ends at the END node.']
  },
  {
    number: '05',
    duration: '90 min',
    topicId: 'rpc',
    title: 'Mock Chat Adapter',
    demo: 'Compare incoming channel payload with the internal inbound message consumed by the service.',
    lesson: 'Adapters isolate external channel details from business logic. This lets the engine stay stable when the system later adds Zalo, web chat, webhook, or another channel.',
    reading: ['ChannelAdapter.java', 'MockChatChannelAdapter.java'],
    lab: ['Compare API request DTO with InboundChatMessage.', 'Design fields needed for a second chat channel.']
  },
  {
    number: '06',
    duration: '90 min',
    topicId: 'pc',
    title: 'Idempotency',
    demo: 'Replay the same message ID and verify that the response is reused without duplicate history rows.',
    lesson: 'Distributed producers retry. A backend should treat duplicate delivery as a normal event, not as a rare bug, and return the original outcome safely.',
    reading: ['MessageIdempotencyRepository.java', 'MockChatFlowTest.java'],
    lab: ['Send a message once.', 'Replay the same message ID and confirm History does not grow.']
  },
  {
    number: '07',
    duration: '90 min',
    topicId: 'pc',
    title: 'Concurrency',
    demo: 'Explain why same-conversation messages are serialized while different conversations can run in parallel.',
    lesson: 'Concurrency design starts by identifying the unit of consistency. In this project, the conversation is the consistency boundary for session updates.',
    reading: ['ConversationLockManager.java', 'ConversationSessionRepository.java'],
    lab: ['Explain local JVM lock limitations.', 'Draft optimistic locking SQL for session version.']
  },
  {
    number: '08',
    duration: '90 min',
    topicId: 'ob',
    title: 'Reliability and action adapter',
    demo: 'Inspect mock action execution and design retry, backoff, and dead-letter extensions.',
    lesson: 'External actions can fail. Production design needs clear action boundaries, timeout behavior, retry policy, backoff strategy, and failed-task storage.',
    reading: ['ActionAdapter.java', 'MockActionAdapter.java'],
    lab: ['Inspect action_executions after ORDER_LOOKUP.', 'Design a retry table for async action processing.']
  },
  {
    number: '09',
    duration: '90 min',
    topicId: 'ob',
    title: 'Observability',
    demo: 'Use History, Session, Debug Trace, structured logs, and metrics to reconstruct a message flow.',
    lesson: 'Observability is not decoration. It is the system contract that lets engineers explain what happened for one user, one message, one session, and one workflow node.',
    reading: ['MockChatService.java', 'docs/design/architecture.md#10-observability'],
    lab: ['Open trace API after a message.', 'Map request_id to message history and execution trace.']
  },
  {
    number: '10',
    duration: '90 min',
    topicId: 'te',
    title: 'Testing and capstone',
    demo: 'Build a refund-support automation and defend it with one unit test and one integration test.',
    lesson: 'The capstone checks whether freshers can connect product behavior, API contract, workflow design, state safety, observability, and testing into one coherent change.',
    reading: ['docs/training/knowledge-program.md', 'MockChatFlowTest.java'],
    lab: ['Build refund-support workflow JSON.', 'Present happy path, fallback path, and test evidence.']
  }
]

export const studyCards = [
  {
    title: 'Mentor checklist',
    items: [
      'Start with product behavior and API contract before code.',
      'Ask where mutable state lives, who updates it, and how duplicate delivery behaves.',
      'Require tests for pure workflow logic before framework integration.',
      'Review logs by request, message, conversation, session, and node identifiers.'
    ]
  },
  {
    title: 'Fresher self-study',
    items: [
      'Read controller DTOs to understand request and response contracts.',
      'Redraw the relationship between config, runtime, history, and debug tables.',
      'Change the workflow JSON, run tests, and explain fallback behavior.',
      'Replay duplicate messages in the console and confirm history remains stable.'
    ]
  },
  {
    title: 'Capstone',
    items: [
      'Build a refund-support workflow with QUESTION, CONDITION, ACTION, HANDOFF, and END.',
      'Add validation for unreachable nodes or duplicate fallback edges.',
      'Add one focused unit test and one end-to-end API test.',
      'Present debug trace for the happy path and fallback path.'
    ]
  }
]
