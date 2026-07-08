INSERT INTO customers (id, external_id, display_name, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 'customer-001', 'Nguyen Van A', CURRENT_TIMESTAMP),
('22222222-2222-2222-2222-222222222222', 'customer-002', 'Tran Thi B', CURRENT_TIMESTAMP);

INSERT INTO conversations (id, customer_id, channel, status, created_at, updated_at) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'ZALO', 'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'WEB', 'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO automation_rules (id, intent, priority, enabled, action_type, reply_template, created_at) VALUES
('33333333-3333-3333-3333-333333333333', 'ORDER_STATUS_REQUEST', 1, TRUE, 'AUTO_REPLY', 'Minh dang kiem tra trang thai don hang cua ban.', CURRENT_TIMESTAMP),
('44444444-4444-4444-4444-444444444444', 'HUMAN_AGENT_REQUEST', 1, TRUE, 'CREATE_TASK', 'Minh se chuyen hoi thoai nay cho nhan vien ho tro.', CURRENT_TIMESTAMP),
('55555555-5555-5555-5555-555555555555', 'GREETING', 1, TRUE, 'AUTO_REPLY', 'Xin chao, minh co the ho tro gi cho ban?', CURRENT_TIMESTAMP);
