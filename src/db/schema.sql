-- aizen_majordomo schema (spec §5.2)
-- All CREATE statements are idempotent so they run safely on every boot.

-- 卡片
CREATE TABLE IF NOT EXISTS cards (
  id          TEXT PRIMARY KEY,         -- uuid
  type        TEXT NOT NULL,            -- task | decision | memo
  title       TEXT NOT NULL,
  body        TEXT,                     -- 正文/问题描述
  options     TEXT,                     -- decision 的可选项(JSON)
  status      TEXT NOT NULL,            -- 见状态机
  lane        TEXT,                     -- 看板列(可自定义)
  priority    INTEGER DEFAULT 0,
  created_by  TEXT NOT NULL,            -- 'human' 或 agent 标识
  assignee    TEXT,
  reply       TEXT,                     -- 人类对 decision 的回复
  replied_by  TEXT,
  created_at  INTEGER NOT NULL,         -- epoch ms
  updated_at  INTEGER NOT NULL
);

-- 评论/讨论线
CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  card_id    TEXT NOT NULL REFERENCES cards(id),
  author     TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 变更流(支撑 changes?since= 增量拉取)
CREATE TABLE IF NOT EXISTS changes (
  seq       INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id   TEXT NOT NULL,
  field     TEXT,
  old_value TEXT,
  new_value TEXT,
  actor     TEXT,
  at        INTEGER NOT NULL
);

-- hook 配置
CREATE TABLE IF NOT EXISTS hooks (
  id      TEXT PRIMARY KEY,
  event   TEXT NOT NULL,               -- card.created / status.changed / decision.answered ...
  match   TEXT,                        -- 过滤条件(JSON)
  action  TEXT NOT NULL,               -- webhook | script
  target  TEXT NOT NULL,               -- url 或 脚本路径
  enabled INTEGER DEFAULT 1
);

-- 看板状态(可自定义数量)
CREATE TABLE IF NOT EXISTS statuses (
  id       TEXT PRIMARY KEY,           -- 'in_progress'
  name     TEXT NOT NULL,              -- 显示名 '进行中'
  category TEXT,                       -- todo | active | done(语义分组/收尾判定)
  position INTEGER NOT NULL,           -- 看板列顺序
  color    TEXT
);

-- 流转(状态间的单向连线,构成工作流图)
CREATE TABLE IF NOT EXISTS transitions (
  id          TEXT PRIMARY KEY,        -- 'answer'
  name        TEXT,                    -- '答复'
  from_status TEXT,                    -- NULL/'*' = 全局流转(任意来源)
  to_status   TEXT NOT NULL,
  card_type   TEXT                     -- NULL = 适用所有卡片类型
);

-- 角色(权限的集合;先定义角色,再把令牌指派给角色)
CREATE TABLE IF NOT EXISTS roles (
  id                  TEXT PRIMARY KEY,   -- 'agent_worker'
  name                TEXT NOT NULL,      -- '工作 agent'
  scopes              TEXT NOT NULL,      -- 动作权限(JSON 数组)
  allowed_transitions TEXT NOT NULL,      -- 流转权限(JSON),或 ["*"]
  description         TEXT
);

-- 令牌(发给 agent 的访问凭据;权限来自所属角色)
CREATE TABLE IF NOT EXISTS tokens (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,            -- 人类可读标识,如 "claude-code-dev"
  secret_hash  TEXT NOT NULL,            -- 只存哈希,明文仅创建时返回一次
  role_id      TEXT NOT NULL REFERENCES roles(id),
  enabled      INTEGER DEFAULT 1,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER
);

-- 人类登录会话
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,          -- 随机串哈希,Cookie 持明文
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- 全局设置(含 admin 密码哈希)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,              -- 如 admin_password_hash
  value TEXT NOT NULL
);

-- 索引:增量拉取与常用过滤
CREATE INDEX IF NOT EXISTS idx_changes_seq      ON changes(seq);
CREATE INDEX IF NOT EXISTS idx_comments_card    ON comments(card_id);
CREATE INDEX IF NOT EXISTS idx_cards_status     ON cards(status);
CREATE INDEX IF NOT EXISTS idx_cards_type       ON cards(type);
