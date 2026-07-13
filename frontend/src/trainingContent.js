export const trainingTopics = [
  {
    id: 'pc',
    label: 'PC 01',
    title: 'Parallelism & Concurrency',
    summary: 'How multiple messages, threads, and shared session state interact in a backend service.',
    definition: 'Concurrency is the ability of a system to make progress on multiple tasks during overlapping time windows. Parallelism is when tasks literally run at the same time on different CPU cores or workers.',
    explanation: 'A conversation system receives messages from many users at once. Different conversations can be processed independently, but messages in the same conversation must update session state in order. Without a clear consistency rule, two messages can both read the same current node and write conflicting next states.',
    basics: [
      {
        term: 'Thread and task',
        definition: 'A thread is an execution lane owned by the runtime; a task is one unit of work scheduled onto a thread.',
        guideline: 'Start by naming the task first, such as processing one incoming message, then ask which shared data that task reads or writes.'
      },
      {
        term: 'Critical section',
        definition: 'A critical section is the smallest block that reads and writes shared mutable state and therefore must not interleave unsafely.',
        guideline: 'Keep the critical section around idempotency check, session update, history write, and trace write; do not lock unrelated reads.'
      },
      {
        term: 'Consistency boundary',
        definition: 'The consistency boundary is the business unit that must stay correct when concurrent work overlaps.',
        guideline: 'For this project the boundary is one conversation session, so same-conversation messages serialize while other conversations can proceed.'
      },
      {
        term: 'Idempotency key',
        definition: 'An idempotency key identifies a retry of the same external request so the service can return the original result safely.',
        guideline: 'Use conversation_id plus message_id as the duplicate boundary, then verify response reuse and stable history row count.'
      }
    ],
    stepByStep: [
      'Identify the shared mutable state first: conversation_sessions.current_node_id, session version, message history, trace rows, and idempotency mapping.',
      'Choose the smallest consistency boundary: this project serializes by conversation_id rather than locking the whole automation.',
      'Place duplicate detection inside the protected block so two retries cannot both pass the idempotency check.',
      'Explain the local lock limitation clearly: it works for one JVM demo, while production needs transaction or distributed coordination.',
      'Prove the behavior by running the duplicate replay flow and checking responseMessageId plus history length before discussing optimizations.'
    ],
    productFlows: [
      {
        feature: 'Duplicate replay protection',
        flow: 'mock message -> idempotency lookup -> reused response',
        concept: 'Idempotency makes channel retries safe and prevents duplicate session transitions.',
        evidence: 'Replay duplicate returns duplicate=true and History does not gain two extra rows.',
        files: ['conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatService.java', 'conversation-app/src/main/java/com/zalo/training/conversation/persistence/MessageIdempotencyRepository.java']
      },
      {
        feature: 'Same conversation serialization',
        flow: 'conversation_id -> withConversationLock -> processLocked',
        concept: 'The conversation is the consistency boundary for mutable session state.',
        evidence: 'The lock wraps idempotency, workflow execution, session update, history, and trace writes.',
        files: ['conversation-app/src/main/java/com/zalo/training/conversation/mockchat/ConversationLockManager.java', 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatService.java']
      },
      {
        feature: 'Session version progression',
        flow: 'START -> menu -> ask_order_id -> offer_update -> ask_followup_category -> end',
        concept: 'A stateful conversation advances one version per processed user message.',
        evidence: 'Session version reaches 5 after the five-message auto demo and current_node_id ends at end.',
        files: ['conversation-app/src/main/resources/schema.sql', 'conversation-app/src/main/java/com/zalo/training/conversation/persistence/ConversationSessionRepository.java']
      }
    ],
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
    basics: [
      {
        term: 'Client responsibility',
        definition: 'The client collects user input, sends a valid request, and renders the service response without owning backend state.',
        guideline: 'Map every UI input to the REST request before reading service internals; this prevents accidental coupling to tables or node logic.'
      },
      {
        term: 'Service responsibility',
        definition: 'The service validates the request, owns business rules, persists state, and returns a stable response contract.',
        guideline: 'Ask freshers which behavior must remain correct if React is replaced by a Zalo webhook client.'
      },
      {
        term: 'REST contract',
        definition: 'A REST contract is the documented HTTP method, path, headers, request body, response body, and error shape.',
        guideline: 'Review request_id, message_id, automationId, and validation errors before discussing controller implementation.'
      },
      {
        term: 'Adapter boundary',
        definition: 'An adapter converts external payload shape into an internal model that business services can consume consistently.',
        guideline: 'Treat MockChatChannelAdapter as the place where channel-specific fields stop and InboundChatMessage begins.'
      }
    ],
    stepByStep: [
      'Start with a concrete product action: a user sends a message from Mock Chat and expects one bot response.',
      'Write the API contract as method, path, header, request fields, response fields, validation errors, and ownership notes.',
      'Draw the boundary from React UI to MockChatController to MockChatChannelAdapter to MockChatService.',
      'Compare REST for external channel traffic with RPC/protobuf for typed internal intent-service style calls.',
      'Review compatibility rules: adding optional response fields is safer than renaming request fields used by clients.'
    ],
    productFlows: [
      {
        feature: 'Incoming message API',
        flow: 'React form -> POST /api/mock-chat/messages -> MockChatController',
        concept: 'The REST boundary hides workflow internals behind a stable request/response model.',
        evidence: 'The UI sends userId, conversationId, messageId, automationId, text, and X-Request-Id.',
        files: ['docs/api/api-contract.md', 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatController.java']
      },
      {
        feature: 'Channel normalization',
        flow: 'MockIncomingMessageRequest -> MockChatChannelAdapter -> InboundChatMessage',
        concept: 'Adapter design lets a future Zalo webhook reuse the same automation service.',
        evidence: 'MockChatService consumes InboundChatMessage and does not depend on controller DTO fields.',
        files: ['conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatChannelAdapter.java', 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatService.java']
      },
      {
        feature: 'Workflow publish contract',
        flow: 'Create automation -> save workflow draft -> publish workflow version',
        concept: 'Configuration APIs define a lifecycle boundary before runtime execution can use a workflow.',
        evidence: 'Publish returns status=PUBLISHED and activeWorkflowVersionId points to the validated version.',
        files: ['conversation-app/src/main/java/com/zalo/training/conversation/api/AutomationController.java', 'conversation-app/src/main/java/com/zalo/training/conversation/application/AutomationService.java']
      }
    ],
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
    basics: [
      {
        term: 'Unit test',
        definition: 'A unit test verifies a small behavior without expensive framework, database, or network boundaries.',
        guideline: 'Use unit tests for WorkflowExecutionEngine and WorkflowValidator because their inputs and outputs are plain domain objects.'
      },
      {
        term: 'Integration test',
        definition: 'An integration test verifies multiple real boundaries working together, such as HTTP, JSON binding, service orchestration, and persistence.',
        guideline: 'Use MockChatFlowTest for the main product flow because session, history, trace, and idempotency must agree.'
      },
      {
        term: 'Regression test',
        definition: 'A regression test locks behavior that previously failed or could easily break during future changes.',
        guideline: 'Write the fallback, duplicate replay, and categorized ticket assertions before changing workflow or adapter behavior.'
      },
      {
        term: 'Test seam',
        definition: 'A test seam is a boundary where code can be exercised or substituted without invoking unrelated systems.',
        guideline: 'Keep ActionAdapter as the seam between deterministic engine tests and external action behavior.'
      }
    ],
    stepByStep: [
      'Name the behavior in product language first, such as category follow-up creates a categorized ticket.',
      'Choose the cheapest reliable test level: engine routing in unit tests, full API flow in MockMvc integration tests.',
      'Run the test before implementation and confirm it fails for the expected missing behavior, not because of a typo.',
      'Implement the smallest production change that makes the test pass, then run the focused test again.',
      'Add one UI/content test when a training promise appears on screen so the mentoring material cannot silently drift.'
    ],
    productFlows: [
      {
        feature: 'Workflow routing unit tests',
        flow: 'current_node_id + input -> WorkflowExecutionEngine -> outcome',
        concept: 'Pure domain behavior should be verified without Spring or database setup.',
        evidence: 'WorkflowExecutionEngineTest covers menu, order id, action, category follow-up, fallback, and completion.',
        files: ['conversation-app/src/test/java/com/zalo/training/conversation/workflow/WorkflowExecutionEngineTest.java', 'conversation-app/src/main/java/com/zalo/training/conversation/workflow/WorkflowExecutionEngine.java']
      },
      {
        feature: 'End-to-end mock chat test',
        flow: 'POST messages x5 -> session/history/trace APIs -> duplicate replay',
        concept: 'Integration tests prove contracts, orchestration, persistence, and observability agree.',
        evidence: 'MockChatFlowTest asserts intents, supportCategory trace detail, session version, and duplicate response reuse.',
        files: ['conversation-app/src/test/java/com/zalo/training/conversation/mockchat/MockChatFlowTest.java']
      },
      {
        feature: 'Training content tests',
        flow: 'trainingContent.js -> node test -> rendered learning guarantees',
        concept: 'Documentation and mentoring UI are product behavior and need regression checks too.',
        evidence: 'trainingContent.test.mjs requires basics, guidelines, product flows, project brief coverage, and concept maps.',
        files: ['frontend/src/trainingContent.test.mjs', 'frontend/src/trainingContent.js']
      }
    ],
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
    basics: [
      {
        term: 'Structured log',
        definition: 'A structured log is a machine-searchable event with named fields rather than a free-form sentence.',
        guideline: 'Require request_id, message_id, conversation_id, session_id, node_id, and status in the main processed-message log.'
      },
      {
        term: 'Trace row',
        definition: 'A trace row records one durable execution event so engineers can reconstruct a workflow path after the request is gone.',
        guideline: 'Persist node_id, event_type, request_id, message_id, and detail_json for every processed message.'
      },
      {
        term: 'Metric',
        definition: 'A metric is an aggregated numeric signal used to answer how often, how slow, or how many failures occur.',
        guideline: 'Use Actuator metrics as the entry point, then ask freshers to design action latency and failure counters.'
      },
      {
        term: 'Correlation ID',
        definition: 'A correlation ID is an identifier that connects logs, responses, history rows, traces, and external action evidence.',
        guideline: 'Teach debugging by copying one request_id from the UI and finding it in every available signal.'
      }
    ],
    stepByStep: [
      'Start with a user complaint and ask what identifiers are available before opening any code.',
      'Read History to find customer input, bot output, intent, message_id, and request_id.',
      'Read Session to identify current_node_id, status, workflow version, and session version.',
      'Read Debug Trace to explain which node executed and what detail_json says about category, order, status, or ticket.',
      'Connect the same identifiers to structured logs and define which metric would reveal this issue at aggregate scale.'
    ],
    productFlows: [
      {
        feature: 'Debug trace panel',
        flow: 'message processed -> execution_traces -> /trace API -> React panel',
        concept: 'Durable trace records let engineers replay the path of one conversation without guessing.',
        evidence: 'Trace rows show ORDER_STATUS, ORDER_STATUS_UPDATE, and TICKET_CREATION with supportCategory.',
        files: ['conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatController.java', 'conversation-app/src/main/resources/schema.sql']
      },
      {
        feature: 'Intent and history inspection',
        flow: 'customer message -> MessageIntent -> messages table -> History panel',
        concept: 'Categorized customer input makes support automation explainable during review.',
        evidence: 'History shows GREETING, ORDER_STATUS_REQUEST, ORDER_ID_PROVIDED, STATUS_UPDATE_REQUEST, and SUPPORT_CATEGORY_PROVIDED.',
        files: ['conversation-app/src/main/java/com/zalo/training/conversation/domain/MessageIntent.java', 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatController.java']
      },
      {
        feature: 'Action execution evidence',
        flow: 'ACTION node -> MockActionAdapter -> action_executions -> trace detail',
        concept: 'External side effects need searchable evidence for retries, audits, and incident analysis.',
        evidence: 'action_executions stores request_json, response_json, attempt_count, status, and related trace id.',
        files: ['conversation-app/src/main/java/com/zalo/training/conversation/adapter/MockActionAdapter.java', 'conversation-app/src/main/resources/schema.sql']
      }
    ],
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
  productConceptMap: [
    {
      feature: 'Auto demo bootstrap',
      flow: 'Run auto demo -> create automation -> publish workflow',
      conceptIds: ['rpc', 'te'],
      concepts: ['REST contract', 'workflow publish boundary', 'configuration lifecycle'],
      evidence: ['Automation id is created', 'Workflow version is published before any message is sent'],
      files: ['frontend/src/main.jsx', 'conversation-app/src/main/java/com/zalo/training/conversation/api/AutomationController.java']
    },
    {
      feature: 'Conversation entry prompt',
      flow: 'START -> menu',
      conceptIds: ['rpc', 'te', 'ob'],
      concepts: ['client/server input contract', 'state-machine entry', 'first trace row'],
      evidence: ['History intent=GREETING', 'Session current_node_id=menu'],
      files: ['frontend/src/demoState.js', 'conversation-app/src/main/java/com/zalo/training/conversation/workflow/WorkflowExecutionEngine.java']
    },
    {
      feature: 'Order intent follow-up',
      flow: 'menu -> ask_order_id',
      conceptIds: ['te', 'ob'],
      concepts: ['edge matching', 'multi-turn session state', 'intent categorization'],
      evidence: ['Bot asks for A123 instead of calling action too early', 'History intent=ORDER_STATUS_REQUEST'],
      files: ['frontend/src/demoState.js', 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatService.java']
    },
    {
      feature: 'Order lookup action',
      flow: 'ask_order_id -> lookup -> offer_update',
      conceptIds: ['rpc', 'te', 'ob'],
      concepts: ['CONDITION validation', 'ActionAdapter boundary', 'action execution evidence'],
      evidence: ['Trace detail category=ORDER_STATUS', 'action_executions stores the mock external response'],
      files: ['conversation-app/src/main/java/com/zalo/training/conversation/adapter/MockActionAdapter.java', 'conversation-app/src/main/resources/schema.sql']
    },
    {
      feature: 'Proactive status update',
      flow: 'offer_update -> update_status -> ask_followup_category',
      conceptIds: ['te', 'ob'],
      concepts: ['automated follow-up', 'next best question', 'traceable side effect'],
      evidence: ['Bot changes PACKING to SHIPPING', 'Session remains ACTIVE for the category question'],
      files: ['frontend/src/demoState.js', 'conversation-app/src/main/java/com/zalo/training/conversation/adapter/MockActionAdapter.java']
    },
    {
      feature: 'Categorized ticket creation',
      flow: 'ask_followup_category -> ticket -> end',
      conceptIds: ['pc', 'te', 'ob'],
      concepts: ['categorized user information', 'terminal state', 'idempotent duplicate replay'],
      evidence: ['Trace detail supportCategory=DELIVERY_DELAY', 'Session status=COMPLETED', 'Duplicate replay keeps history stable'],
      files: ['conversation-app/src/test/java/com/zalo/training/conversation/mockchat/MockChatFlowTest.java', 'conversation-app/src/main/java/com/zalo/training/conversation/domain/MessageIntent.java']
    }
  ],
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
          ],
          coverage: [
            {
              label: 'Mock Chat REST boundary',
              source: 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatController.java',
              status: 'implemented'
            },
            {
              label: 'Incoming message orchestration',
              source: 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatService.java',
              status: 'implemented'
            },
            {
              label: 'Conversation history API',
              source: 'conversation-app/src/main/java/com/zalo/training/conversation/api/ConversationController.java',
              status: 'implemented'
            }
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
          ],
          coverage: [
            {
              label: 'Automation and workflow APIs',
              source: 'conversation-app/src/main/java/com/zalo/training/conversation/api/AutomationController.java',
              status: 'implemented'
            },
            {
              label: 'Workflow publish service',
              source: 'conversation-app/src/main/java/com/zalo/training/conversation/application/AutomationService.java',
              status: 'implemented'
            },
            {
              label: 'Workflow graph validation',
              source: 'conversation-app/src/main/java/com/zalo/training/conversation/workflow/WorkflowValidator.java',
              status: 'implemented'
            }
          ]
        },
        {
          title: 'Automation Execution Engine',
          items: [
            'Xử lý message từ Mock Chat bằng workflow active và session hiện tại.',
            'Load session, xử lý node tương ứng, chọn next node, cập nhật session và trả response.',
            'Hỗ trợ option, keyword, condition và fallback khi input không hợp lệ.',
            'Lưu conversation history và execution trace để debug.'
          ],
          coverage: [
            {
              label: 'Stateless workflow engine',
              source: 'conversation-app/src/main/java/com/zalo/training/conversation/workflow/WorkflowExecutionEngine.java',
              status: 'implemented'
            },
            {
              label: 'Session/message/trace orchestration',
              source: 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatService.java',
              status: 'implemented'
            },
            {
              label: 'Workflow routing tests',
              source: 'conversation-app/src/test/java/com/zalo/training/conversation/workflow/WorkflowExecutionEngineTest.java',
              status: 'implemented'
            }
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
          ],
          coverage: [
            {
              label: 'Per-conversation lock',
              source: 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/ConversationLockManager.java',
              status: 'implemented'
            },
            {
              label: 'Session and idempotency schema',
              source: 'conversation-app/src/main/resources/schema.sql',
              status: 'implemented'
            },
            {
              label: 'Duplicate message test',
              source: 'conversation-app/src/test/java/com/zalo/training/conversation/mockchat/MockChatFlowTest.java',
              status: 'implemented'
            }
          ]
        },
        {
          title: 'Action, Adapter & Observability',
          items: [
            'Thiết kế Channel Adapter để tách logic chat khỏi automation engine.',
            'Xây dựng ACTION node gọi mock external service như order lookup, ticket creation hoặc webhook.',
            'Ghi structured log với request_id, message_id, conversation_id, session_id, node_id.',
            'Cung cấp API xem conversation history, current session và execution trace.'
          ],
          coverage: [
            {
              label: 'Channel adapter contract',
              source: 'conversation-app/src/main/java/com/zalo/training/conversation/adapter/ChannelAdapter.java',
              status: 'implemented'
            },
            {
              label: 'Action adapter contract',
              source: 'conversation-app/src/main/java/com/zalo/training/conversation/adapter/ActionAdapter.java',
              status: 'implemented'
            },
            {
              label: 'Mock external action implementation',
              source: 'conversation-app/src/main/java/com/zalo/training/conversation/adapter/MockActionAdapter.java',
              status: 'implemented'
            },
            {
              label: 'Trace/log/debug APIs',
              source: 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatController.java',
              status: 'implemented'
            }
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
          ],
          coverage: [
            {
              label: 'Optional reliability extension plan',
              source: 'docs/design/architecture.md',
              status: 'optional-design'
            },
            {
              label: 'Training extension exercises',
              source: 'docs/training/knowledge-program.md',
              status: 'optional-design'
            },
            {
              label: 'Metrics endpoint hook',
              source: 'conversation-app/src/main/resources/application.yml',
              status: 'implemented'
            }
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
    lab: ['Create an automation from the console.', 'Map each form field to a REST request field.'],
    appliedExample: {
      problem: 'A chat client must send an inbound message without knowing workflow tables, node types, or persistence rules.',
      projectApplication: 'The React console and Mock Chat API send userId, conversationId, messageId, automationId, and text. The backend owns validation, request_id creation, and response shape.',
      mentorExplanation: 'Explain that the client owns user intent and request data, while the service owns workflow execution and state. This boundary prevents UI changes from leaking into the engine.'
    },
    codeWalkthrough: [
      {
        source: 'docs/api/api-contract.md',
        symbol: 'POST /api/mock-chat/messages',
        snippet: 'Request: userId, conversationId, messageId, automationId, text',
        responsibility: 'Documents the external request and response shape before implementation details are discussed.',
        why: 'Freshers learn to review API contract first so controller, UI, and tests share one source of truth.',
        explain: 'Ask the fresher to map every UI field to this contract and identify which fields are optional versus required.'
      },
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatController.java',
        symbol: 'incoming(...)',
        snippet: '@PostMapping("/messages") -> mockChatService.handleIncoming(...)',
        responsibility: 'Receives Mock Chat input, creates an effective request id, delegates channel normalization, and returns a stable response DTO.',
        why: 'The controller stays thin so business rules remain in services and can be tested outside HTTP.',
        explain: 'Point out request validation annotations and the generated request id as the first reliability boundary.'
      },
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatChannelAdapter.java',
        symbol: 'toInbound(...)',
        snippet: 'new InboundChatMessage(request.userId(), ..., requestId)',
        responsibility: 'Converts a channel-specific REST request into the internal inbound message consumed by the service.',
        why: 'This adapter lets the system add another channel without changing workflow execution code.',
        explain: 'Ask which fields would differ for a Zalo webhook and which normalized fields the engine still needs.'
      }
    ]
  },
  {
    number: '02',
    duration: '90 min',
    topicId: 'rpc',
    title: 'Database design',
    demo: 'Walk through config tables, runtime state tables, message history, trace rows, and the idempotency key.',
    lesson: 'Separate tables by lifecycle: automation configuration changes slowly, workflow versions are immutable once published, sessions change per message, and traces are append-only debug evidence.',
    reading: ['docs/design/database.md', 'conversation-app/src/main/resources/schema.sql'],
    lab: ['Draw the schema groups on a whiteboard.', 'Explain which indexes protect common debug queries.'],
    appliedExample: {
      problem: 'Conversation automation mixes slow-changing config, mutable runtime state, message history, and debug evidence.',
      projectApplication: 'The schema separates automations/workflow_versions from conversation_sessions, messages, execution_traces, action_executions, and message_idempotency.',
      mentorExplanation: 'Use lifecycle as the teaching frame: config is versioned, sessions mutate, messages and traces are evidence, and idempotency protects retries.'
    },
    codeWalkthrough: [
      {
        source: 'conversation-app/src/main/resources/schema.sql',
        symbol: 'workflow_versions',
        snippet: 'UNIQUE (automation_id, version)',
        responsibility: 'Stores immutable workflow definitions with a version number per automation.',
        why: 'Published runtime behavior must not change when someone edits a later draft.',
        explain: 'Ask the fresher why active_workflow_version_id points to a specific version instead of raw JSON on automation.'
      },
      {
        source: 'conversation-app/src/main/resources/schema.sql',
        symbol: 'conversation_sessions',
        snippet: 'current_node_id VARCHAR(128) NOT NULL, version INTEGER NOT NULL',
        responsibility: 'Stores the mutable state machine position for one conversation.',
        why: 'The session row is the consistency boundary for multi-step chat behavior.',
        explain: 'Show how current_node_id moves after each message and how version can support optimistic locking.'
      },
      {
        source: 'conversation-app/src/main/resources/schema.sql',
        symbol: 'message_idempotency',
        snippet: 'PRIMARY KEY (conversation_id, external_message_id)',
        responsibility: 'Prevents duplicate channel deliveries from producing duplicate message rows or session updates.',
        why: 'Retries are normal in distributed systems, so the database must encode duplicate detection.',
        explain: 'Ask the fresher to name the producer-side key and why conversation_id belongs in the primary key.'
      }
    ]
  },
  {
    number: '03',
    duration: '90 min',
    topicId: 'te',
    title: 'Workflow JSON and publish validation',
    demo: 'Edit the sample workflow, break a validation rule, then publish a corrected version.',
    lesson: 'Treat workflow JSON as a graph contract. Validation should reject missing START nodes, invalid edge targets, missing node config, and unsafe runtime paths before publish.',
    reading: ['WorkflowValidator.java', 'WorkflowDefinition.java'],
    lab: ['Remove the START edge and observe publish failure.', 'Add a validation test before changing validator logic.'],
    appliedExample: {
      problem: 'A malformed workflow should fail at publish time, not during a customer conversation.',
      projectApplication: 'AutomationService calls WorkflowValidator before publishing and only then updates active_workflow_version_id.',
      mentorExplanation: 'Explain publish as a safety gate: runtime loads only a validated version, so bad drafts do not break active conversations.'
    },
    codeWalkthrough: [
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/workflow/WorkflowValidator.java',
        symbol: 'validate(...)',
        snippet: 'workflow must contain exactly one START node',
        responsibility: 'Checks structural rules such as START count, unique node ids, valid edge endpoints, and required config.',
        why: 'Graph mistakes are cheaper to catch before publishing than during message execution.',
        explain: 'Walk through one invalid workflow and ask which validation error should appear before the code is opened.'
      },
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/application/AutomationService.java',
        symbol: 'publishWorkflowVersion(...)',
        snippet: 'WorkflowValidationResult validation = workflowValidator.validate(...)',
        responsibility: 'Validates the draft, marks the workflow version as PUBLISHED, and points the automation to that version.',
        why: 'Publish creates an intentional boundary between editing configuration and affecting runtime users.',
        explain: 'Ask why active_workflow_version_id is updated only after validation passes.'
      },
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/workflow/WorkflowDefinition.java',
        symbol: 'Node / Edge records',
        snippet: 'record Node(String id, WorkflowNodeType type, Map<String, Object> config)',
        responsibility: 'Models workflow JSON as typed nodes and edges that the validator and engine can reason about.',
        why: 'A graph model is easier to validate and test than ad hoc nested JSON traversal.',
        explain: 'Have the fresher draw one JSON node and one edge, then map them to these records.'
      }
    ]
  },
  {
    number: '04',
    duration: '90 min',
    topicId: 'te',
    title: 'State machine execution engine',
    demo: 'Trace START to QUESTION to ACTION to END while watching current_node_id move.',
    lesson: 'A conversation workflow is a state machine. The engine should be deterministic, stateless, and testable while the service layer owns persistence and side effects.',
    reading: ['WorkflowExecutionEngine.java', 'WorkflowExecutionEngineTest.java'],
    lab: ['Send a matching order message.', 'Explain why the session ends at the END node.'],
    appliedExample: {
      problem: 'A multi-step conversation needs a deterministic next-node decision for each user input.',
      projectApplication: 'WorkflowExecutionEngine receives workflow, currentNodeId, input, and ActionAdapter, then returns WorkflowExecutionOutcome without touching HTTP or database.',
      mentorExplanation: 'Teach the engine as pure state-machine logic. Persistence and side effects stay in MockChatService so the engine remains unit-testable.'
    },
    codeWalkthrough: [
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/workflow/WorkflowExecutionEngine.java',
        symbol: 'execute(...)',
        snippet: 'execute(workflow, session.currentNodeId(), inbound.text(), actionAdapter)',
        responsibility: 'Routes the current message through START, QUESTION, CONDITION, ACTION, HANDOFF, or END behavior.',
        why: 'A stateless engine can be tested with plain objects and reused regardless of storage implementation.',
        explain: 'Ask the fresher where the current state comes from and why the engine should not load it itself.'
      },
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/workflow/WorkflowExecutionEngine.java',
        symbol: 'nextNode(...)',
        snippet: 'sorted(... FALLBACK ? 1 : 0).filter(edge -> matches(edge, input))',
        responsibility: 'Chooses the first matching non-fallback edge and uses fallback only after specific matches fail.',
        why: 'Fallback must be deterministic or invalid input can take a surprising path.',
        explain: 'Send an unmatched message and ask why fallback is evaluated after keyword and option edges.'
      },
      {
        source: 'conversation-app/src/test/java/com/zalo/training/conversation/workflow/WorkflowExecutionEngineTest.java',
        symbol: 'engine routing tests',
        snippet: 'assertThat(outcome.nodeId()).isEqualTo("end")',
        responsibility: 'Locks down state-machine routing behavior without Spring, a database, or HTTP.',
        why: 'Core behavior should be cheap to verify before integration tests run.',
        explain: 'Ask the fresher to add one OPTION test before changing the engine.'
      }
    ]
  },
  {
    number: '05',
    duration: '90 min',
    topicId: 'rpc',
    title: 'Mock Chat Adapter',
    demo: 'Compare incoming channel payload with the internal inbound message consumed by the service.',
    lesson: 'Adapters isolate external channel details from business logic. This lets the engine stay stable when the system later adds Zalo, web chat, webhook, or another channel.',
    reading: ['ChannelAdapter.java', 'MockChatChannelAdapter.java'],
    lab: ['Compare API request DTO with InboundChatMessage.', 'Design fields needed for a second chat channel.'],
    appliedExample: {
      problem: 'Every channel has a different payload shape, but the automation engine needs one stable input model.',
      projectApplication: 'MockChatChannelAdapter converts MockIncomingMessageRequest into InboundChatMessage before MockChatService starts orchestration.',
      mentorExplanation: 'Explain adapter as an anti-corruption layer: channel-specific fields stop at the boundary and domain services process normalized input.'
    },
    codeWalkthrough: [
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/adapter/ChannelAdapter.java',
        symbol: 'ChannelAdapter<T>',
        snippet: 'InboundChatMessage toInbound(T request, String requestId)',
        responsibility: 'Defines the contract that every chat channel adapter must satisfy.',
        why: 'The service can depend on a normalized inbound message rather than every possible external payload.',
        explain: 'Ask what method a future Zalo webhook adapter would implement and what it should return.'
      },
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatChannelAdapter.java',
        symbol: 'toInbound(...)',
        snippet: 'request.messageId(), request.automationId(), request.text(), requestId',
        responsibility: 'Maps the mock channel DTO into the internal message record with correlation metadata.',
        why: 'Keeping the mapping visible makes channel boundary discussions concrete for freshers.',
        explain: 'Have the fresher compare each constructor argument with the REST request fields.'
      },
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatService.java',
        symbol: 'handleIncoming(...)',
        snippet: 'handleIncoming(InboundChatMessage inbound)',
        responsibility: 'Consumes only the normalized inbound message and remains independent of controller DTOs.',
        why: 'This proves the adapter is doing real boundary work, not just adding another class.',
        explain: 'Ask why MockChatService should not accept MockIncomingMessageRequest directly.'
      }
    ]
  },
  {
    number: '06',
    duration: '90 min',
    topicId: 'pc',
    title: 'Idempotency',
    demo: 'Replay the same message ID and verify that the response is reused without duplicate history rows.',
    lesson: 'Distributed producers retry. A backend should treat duplicate delivery as a normal event, not as a rare bug, and return the original outcome safely.',
    reading: ['MessageIdempotencyRepository.java', 'MockChatFlowTest.java'],
    lab: ['Send a message once.', 'Replay the same message ID and confirm History does not grow.'],
    appliedExample: {
      problem: 'A chat platform can retry the same message after timeout, so the backend may receive duplicate delivery.',
      projectApplication: 'MockChatService checks message_idempotency before executing workflow and returns the original bot response when the message_id was already processed.',
      mentorExplanation: 'Teach idempotency as a normal API behavior: duplicate requests should be safe and should return useful information, not corrupt session state.'
    },
    codeWalkthrough: [
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatService.java',
        symbol: 'processLocked(...) duplicate branch',
        snippet: 'idempotencyRepository.findResponseMessageId(conversation.id(), inbound.messageId())',
        responsibility: 'Detects duplicate delivery before saving new messages or moving the session.',
        why: 'The duplicate branch must run inside the conversation consistency boundary to avoid race conditions.',
        explain: 'Replay the same message id and ask why the service returns the old response instead of silently ignoring it.'
      },
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/persistence/MessageIdempotencyRepository.java',
        symbol: 'findResponseMessageId(...) / save(...)',
        snippet: 'conversation_id + external_message_id',
        responsibility: 'Reads and writes the durable mapping from external message id to response message id.',
        why: 'A durable idempotency key survives process restarts and documents retry behavior.',
        explain: 'Ask the fresher which table row proves a retry was already handled.'
      },
      {
        source: 'conversation-app/src/test/java/com/zalo/training/conversation/mockchat/MockChatFlowTest.java',
        symbol: 'duplicate message flow',
        snippet: 'duplicate=true',
        responsibility: 'Verifies duplicate replay reuses the original response and does not create duplicate history.',
        why: 'The integration test proves controller, service, database, and workflow behavior work together.',
        explain: 'Run the test or replay duplicate in UI and compare history count before and after.'
      }
    ]
  },
  {
    number: '07',
    duration: '90 min',
    topicId: 'pc',
    title: 'Concurrency',
    demo: 'Explain why same-conversation messages are serialized while different conversations can run in parallel.',
    lesson: 'Concurrency design starts by identifying the unit of consistency. In this project, the conversation is the consistency boundary for session updates.',
    reading: ['ConversationLockManager.java', 'ConversationSessionRepository.java'],
    lab: ['Explain local JVM lock limitations.', 'Draft optimistic locking SQL for session version.'],
    appliedExample: {
      problem: 'Two near-simultaneous messages for the same conversation can both read the same current_node_id and write conflicting next states.',
      projectApplication: 'MockChatService wraps processing in ConversationLockManager.withConversationLock and the session schema keeps a version field for the optimistic locking discussion.',
      mentorExplanation: 'Teach the consistency boundary first: messages for different conversations can run in parallel, but one conversation session must be updated in order.'
    },
    codeWalkthrough: [
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/ConversationLockManager.java',
        symbol: 'withConversationLock(...)',
        snippet: 'locks.computeIfAbsent(conversationId, ignored -> new ReentrantLock())',
        responsibility: 'Serializes operations for the same conversation inside one JVM.',
        why: 'It prevents same-conversation session state from being updated concurrently in the local training runtime.',
        explain: 'Ask why this is enough for one local app instance and why production needs database or distributed coordination.'
      },
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatService.java',
        symbol: 'handleIncoming(...)',
        snippet: 'lockManager.withConversationLock(conversation.id(), () -> processLocked(...))',
        responsibility: 'Places idempotency, workflow execution, session update, history, and trace inside one serialized block.',
        why: 'The critical section contains all mutable state transitions that must not interleave for one conversation.',
        explain: 'Draw Message A and Message B entering this method and show which one waits.'
      },
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/persistence/ConversationSessionRepository.java',
        symbol: 'update(...)',
        snippet: 'version = ?',
        responsibility: 'Persists the next current_node_id and increments the visible session version.',
        why: 'The version field gives freshers a bridge to optimistic locking even though the sample uses a local lock.',
        explain: 'Ask how the SQL would change to update WHERE id = ? AND version = ? in a multi-node deployment.'
      }
    ]
  },
  {
    number: '08',
    duration: '90 min',
    topicId: 'ob',
    title: 'Reliability and action adapter',
    demo: 'Inspect mock action execution and design retry, backoff, and dead-letter extensions.',
    lesson: 'External actions can fail. Production design needs clear action boundaries, timeout behavior, retry policy, backoff strategy, and failed-task storage.',
    reading: ['ActionAdapter.java', 'MockActionAdapter.java'],
    lab: ['Inspect action_executions after ORDER_LOOKUP.', 'Design a retry table for async action processing.'],
    appliedExample: {
      problem: 'Workflow ACTION nodes call external systems that can fail, timeout, or return partial data.',
      projectApplication: 'WorkflowExecutionEngine calls ActionAdapter, MockActionAdapter simulates order lookup and ticket creation, and MockChatService stores action_executions for debug.',
      mentorExplanation: 'Teach action as a boundary: the engine decides when to call, the adapter hides external details, and persistence records enough evidence for retry design.'
    },
    codeWalkthrough: [
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/adapter/ActionAdapter.java',
        symbol: 'execute(String actionName, String input)',
        snippet: 'ActionResult execute(String actionName, String input)',
        responsibility: 'Defines the stable boundary for workflow ACTION nodes to call external capabilities.',
        why: 'The engine should not know whether an action is a REST call, queue task, database lookup, or mock.',
        explain: 'Ask the fresher where timeout and retry policy should live when this mock becomes a real webhook.'
      },
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/adapter/MockActionAdapter.java',
        symbol: 'ORDER_LOOKUP / TICKET_CREATION',
        snippet: 'return new ActionResult(true, "Order A123 dang duoc xu ly.", ...)',
        responsibility: 'Provides deterministic fake external responses for local demo and tests.',
        why: 'A stable mock keeps the 90-minute training demo reliable while still showing adapter boundaries.',
        explain: 'Run an ORDER_LOOKUP message and ask which response_json should be persisted.'
      },
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatService.java',
        symbol: 'actionExecutionRepository.save(...)',
        snippet: 'ActionStatus.DONE, attempt_count = 1',
        responsibility: 'Stores action execution evidence linked to trace, conversation, session, and node.',
        why: 'The record becomes the seed for retry/backoff/dead-letter extensions.',
        explain: 'Ask the fresher what fields they would add for next_retry_at and failure_reason.'
      }
    ]
  },
  {
    number: '09',
    duration: '90 min',
    topicId: 'ob',
    title: 'Observability',
    demo: 'Use History, Session, Debug Trace, structured logs, and metrics to reconstruct a message flow.',
    lesson: 'Observability is not decoration. It is the system contract that lets engineers explain what happened for one user, one message, one session, and one workflow node.',
    reading: ['MockChatService.java', 'docs/design/architecture.md#10-observability'],
    lab: ['Open trace API after a message.', 'Map request_id to message history and execution trace.'],
    appliedExample: {
      problem: 'When a bot gives a wrong response, engineers need to reconstruct the path from request to node decision.',
      projectApplication: 'The service writes structured logs, messages, execution_traces, action_executions, and exposes history/session/trace APIs consumed by the React debug panels.',
      mentorExplanation: 'Explain logs, metrics, and traces as different answers: what happened, how often/how slow, and which exact path one message took.'
    },
    codeWalkthrough: [
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatService.java',
        symbol: 'structured log statement',
        snippet: 'request_id={} message_id={} conversation_id={} session_id={} node_id={}',
        responsibility: 'Emits searchable identifiers for one processed message and its workflow node result.',
        why: 'Without correlation fields, production debugging becomes manual guessing.',
        explain: 'Ask the fresher to search one request_id across response, log, message history, and trace.'
      },
      {
        source: 'conversation-app/src/main/java/com/zalo/training/conversation/mockchat/MockChatController.java',
        symbol: 'history/session/trace endpoints',
        snippet: '@GetMapping("/conversations/{conversationId}/trace")',
        responsibility: 'Exposes durable debug evidence to the UI and mentor-led troubleshooting flow.',
        why: 'Debug APIs make observability concrete in local training before introducing production tooling.',
        explain: 'Open the trace panel after sending a message and map each row back to node_id and message_id.'
      },
      {
        source: 'conversation-app/src/main/resources/application.yml',
        symbol: 'management.endpoints.web.exposure.include',
        snippet: 'include: health,info,metrics',
        responsibility: 'Exposes the Actuator metrics endpoint used for metrics-outline discussion.',
        why: 'Metrics complete the observability triangle without adding a full dashboard to the sample.',
        explain: 'Ask what counter and timer should be added around ACTION execution in a production follow-up.'
      }
    ]
  },
  {
    number: '10',
    duration: '90 min',
    topicId: 'te',
    title: 'Testing and capstone',
    demo: 'Build a refund-support automation and defend it with one unit test and one integration test.',
    lesson: 'The capstone checks whether freshers can connect product behavior, API contract, workflow design, state safety, observability, and testing into one coherent change.',
    reading: ['docs/training/knowledge-program.md', 'MockChatFlowTest.java'],
    lab: ['Build refund-support workflow JSON.', 'Present happy path, fallback path, and test evidence.'],
    appliedExample: {
      problem: 'A fresher needs to prove a new automation behavior is correct without relying only on manual UI clicking.',
      projectApplication: 'The project combines unit tests for workflow logic, integration tests for API flow, source docs for expectations, and the React console for final demo evidence.',
      mentorExplanation: 'Use the capstone as a review gate: behavior, contract, data consistency, observability, and tests must all tell the same story.'
    },
    codeWalkthrough: [
      {
        source: 'docs/training/knowledge-program.md',
        symbol: 'Capstone checklist',
        snippet: 'Build refund-support workflow JSON',
        responsibility: 'Defines the final exercise and the evidence expected from freshers.',
        why: 'A capstone converts isolated topics into one coherent engineering change.',
        explain: 'Ask the fresher to present the workflow, tests, and trace evidence in that order.'
      },
      {
        source: 'conversation-app/src/test/java/com/zalo/training/conversation/workflow/WorkflowValidatorTest.java',
        symbol: 'validator behavior tests',
        snippet: 'assertThat(result.valid()).isFalse()',
        responsibility: 'Shows how publish validation should be tested before adding new workflow rules.',
        why: 'Validation bugs can break all automations, so they need focused tests.',
        explain: 'Have the fresher write the failing validation test before implementing a new rule.'
      },
      {
        source: 'conversation-app/src/test/java/com/zalo/training/conversation/mockchat/MockChatFlowTest.java',
        symbol: 'end-to-end flow test',
        snippet: 'mock chat message -> workflow response -> trace',
        responsibility: 'Exercises the main runtime path across API, persistence, workflow, idempotency, and debug evidence.',
        why: 'The integration test is the final proof that the capstone behavior works through real boundaries.',
        explain: 'Ask which assertions belong in unit tests and which belong in this full-flow test.'
      }
    ]
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
