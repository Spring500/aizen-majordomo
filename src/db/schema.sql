-- aizen_majordomo schema
-- All CREATE statements are idempotent so they run safely on every boot.

CREATE TABLE IF NOT EXISTS cards (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  status      TEXT NOT NULL,
  created_by  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS card_field_values (
  card_id    TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  field_id   TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (card_id, field_id)
);

CREATE TABLE IF NOT EXISTS card_types (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  fields_json  TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  enabled      INTEGER NOT NULL DEFAULT 1,
  system       INTEGER NOT NULL DEFAULT 0,
  position     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS statuses (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  category TEXT,
  position INTEGER NOT NULL,
  color    TEXT,
  enabled  INTEGER NOT NULL DEFAULT 1,
  system   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transitions (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  card_type            TEXT,
  from_status          TEXT,
  to_status            TEXT NOT NULL,
  writable_fields_json TEXT NOT NULL,
  required_fields_json TEXT,
  enabled              INTEGER NOT NULL DEFAULT 1,
  system               INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hook_action_models (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  schema_json TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  system      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hooks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  event       TEXT NOT NULL,
  match_json  TEXT,
  action_json TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  system      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  card_id    TEXT NOT NULL REFERENCES cards(id),
  author     TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS changes (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  event        TEXT NOT NULL,
  card_id      TEXT NOT NULL,
  action       TEXT,
  field        TEXT,
  actor        TEXT,
  payload_json TEXT NOT NULL,
  at           INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  scopes              TEXT NOT NULL,
  allowed_transitions TEXT NOT NULL,
  description         TEXT
);

CREATE TABLE IF NOT EXISTS tokens (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  secret_hash  TEXT NOT NULL,
  role_id      TEXT NOT NULL REFERENCES roles(id),
  enabled      INTEGER DEFAULT 1,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_changes_seq ON changes(seq);
CREATE INDEX IF NOT EXISTS idx_changes_card ON changes(card_id);
CREATE INDEX IF NOT EXISTS idx_comments_card ON comments(card_id);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(type);
CREATE INDEX IF NOT EXISTS idx_card_field_values_field ON card_field_values(field_id);
