import type { DatabaseSync } from 'node:sqlite';
import { createCard } from '../../src/cards/repository.ts';

export function seed(db: DatabaseSync): void {
  createCard(db, {
    type: 'review',
    status: 'triage',
    fields: {
      case_subject: '第三方数据导出核验',
      audit_domain: 'privacy',
      evidence_url: 'https://example.invalid/evidence/privacy-export',
      needs_followup: true,
    },
    actor: 'scenario',
  });
}
