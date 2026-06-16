import type { DatabaseSync } from 'node:sqlite';
import { createCard } from '../../src/cards/repository.ts';

const statuses = ['default', 'active', 'done'] as const;
const risks = ['low', 'normal', 'high'] as const;

export function seed(db: DatabaseSync): void {
  for (let index = 0; index < 1000; index += 1) {
    createCard(db, {
      type: 'task',
      status: statuses[index % statuses.length],
      fields: {
        title: `大量数据卡 ${index + 1}`,
        body: `用于阶段 2 大量数据冒烟 ${index + 1}`,
        assignee: `user-${index % 10}`,
        risk_level: risks[index % risks.length],
      },
      actor: 'scenario',
    });
  }
}
