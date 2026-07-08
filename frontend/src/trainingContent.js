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
    }
  }
]

export const learningSessions = [
  { number: '01', duration: '90 min', title: 'Product, client/server, REST contract', demo: 'Create a customer conversation from the console and map every UI field to the REST API contract.' },
  { number: '02', duration: '90 min', title: 'Database design', demo: 'Walk through config tables, runtime state tables, message history, trace rows, and the idempotency key.' },
  { number: '03', duration: '90 min', title: 'Workflow JSON and publish validation', demo: 'Edit the sample workflow, break a validation rule, then publish a corrected version.' },
  { number: '04', duration: '90 min', title: 'State machine execution engine', demo: 'Trace START to QUESTION to ACTION to END while watching current_node_id move.' },
  { number: '05', duration: '90 min', title: 'Mock Chat Adapter', demo: 'Compare incoming channel payload with the internal inbound message consumed by the service.' },
  { number: '06', duration: '90 min', title: 'Idempotency', demo: 'Replay the same message ID and verify that the response is reused without duplicate history rows.' },
  { number: '07', duration: '90 min', title: 'Concurrency', demo: 'Explain why same-conversation messages are serialized while different conversations can run in parallel.' },
  { number: '08', duration: '90 min', title: 'Reliability and action adapter', demo: 'Inspect mock action execution and design retry, backoff, and dead-letter extensions.' },
  { number: '09', duration: '90 min', title: 'Observability', demo: 'Use History, Session, Debug Trace, structured logs, and metrics to reconstruct a message flow.' },
  { number: '10', duration: '90 min', title: 'Testing and capstone', demo: 'Build a refund-support automation and defend it with one unit test and one integration test.' }
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
