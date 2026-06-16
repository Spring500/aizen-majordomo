import type { DatabaseSync } from 'node:sqlite';
import { createCard } from '../../src/cards/repository.ts';

export function seed(db: DatabaseSync): void {
  createCard(db, {
    type: 'task',
    status: 'default',
    fields: { title: '配置变化前创建的卡片', risk_level: 'high', legacy_note: '这段旧备注应在配置变化后保留' },
    actor: 'scenario',
  });
}
