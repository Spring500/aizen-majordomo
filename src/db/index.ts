import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeConfig } from '../config/initialize.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_DB_PATH =
  process.env.DB_PATH ?? join(process.cwd(), 'data', 'majordomo.db');

// 建库:设 PRAGMA(WAL=并发读+原子写)并建表。传 ':memory:' 用于测试隔离。
export function createDb(path: string = DEFAULT_DB_PATH): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

export function migrate(db: DatabaseSync): void {
  migrateCardsTable(db);
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  initializeConfig(db);
}

function columnNames(db: DatabaseSync, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name);
}

function tableExists(db: DatabaseSync, table: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = @table")
    .get({ table }) as { name: string } | undefined;
  return Boolean(row);
}

function migrateCardsTable(db: DatabaseSync): void {
  if (!tableExists(db, 'cards')) return;
  const columns = columnNames(db, 'cards');
  if (!columns.includes('title')) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS card_field_values (
      card_id    TEXT NOT NULL,
      field_id   TEXT NOT NULL,
      value_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (card_id, field_id)
    );
  `);

  const oldRows = db.prepare('SELECT * FROM cards').all() as Array<Record<string, unknown>>;
  db.exec('ALTER TABLE cards RENAME TO cards_legacy_stage2;');
  db.exec(`
    CREATE TABLE cards (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL,
      status      TEXT NOT NULL,
      created_by  TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );
  `);

  const insertCard = db.prepare(
    `INSERT INTO cards (id, type, status, created_by, created_at, updated_at)
     VALUES (@id, @type, @status, @created_by, @created_at, @updated_at)`,
  );
  const insertValue = db.prepare(
    `INSERT OR REPLACE INTO card_field_values (card_id, field_id, value_json, updated_at)
     VALUES (@card_id, @field_id, @value_json, @updated_at)`,
  );

  const fieldIds = ['title', 'body', 'options', 'lane', 'priority', 'assignee', 'reply', 'replied_by'];
  for (const row of oldRows) {
    insertCard.run({
      id: row.id,
      type: row.type,
      status: row.status,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    } as Record<string, SQLInputValue>);
    for (const fieldId of fieldIds) {
      const value = row[fieldId];
      if (value === null || value === undefined) continue;
      const parsed = fieldId === 'options' && typeof value === 'string' ? JSON.parse(value) : value;
      insertValue.run({
        card_id: row.id,
        field_id: fieldId,
        value_json: JSON.stringify(parsed),
        updated_at: row.updated_at,
      } as Record<string, SQLInputValue>);
    }
  }
}
