import type { DatabaseSync } from 'node:sqlite';
import { createCard } from '../../src/cards/repository.ts';

export function seed(db: DatabaseSync): void {
  for (const status of ['triage', 'doing', 'blocked', 'done']) {
    createCard(db, {
      type: 'task',
      status,
      fields: { title: `状态样例 ${status}`, body: `用于观察 ${status}`, assignee: status },
      actor: 'scenario',
    });
  }
}
