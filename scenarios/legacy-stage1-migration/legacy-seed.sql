CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT,
  body TEXT,
  options TEXT,
  lane TEXT,
  priority INTEGER,
  assignee TEXT,
  reply TEXT,
  replied_by TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO cards (
  id, type, status, title, body, options, lane, priority, assignee, reply, replied_by, created_by, created_at, updated_at
) VALUES
  ('legacy-task-1', 'task', 'default', '旧任务标题', '旧任务正文', NULL, 'backlog', 1, 'alice', NULL, NULL, 'legacy', 1700000000000, 1700000000000),
  ('legacy-decision-1', 'decision', 'waiting', '旧决策标题', '旧决策正文', '["同意","拒绝"]', 'review', 2, 'bob', '同意', 'carol', 'legacy', 1700000001000, 1700000001000),
  ('legacy-memo-1', 'memo', 'done', '旧备忘标题', '旧备忘正文', NULL, NULL, 0, NULL, NULL, NULL, 'legacy', 1700000002000, 1700000002000);
