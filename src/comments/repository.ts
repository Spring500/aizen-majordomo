import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Comment } from './types.ts';

/**
 * 为卡片追加一条纯文本评论。
 *
 * 阶段 4 只用于 transition 附带说明；完整评论读取、权限和评论区 UI 留到阶段 6。
 */
export function createComment(
  db: DatabaseSync,
  input: { cardId: string; author: string; content: string; at?: number },
): Comment {
  const comment = {
    id: randomUUID(),
    cardId: input.cardId,
    author: input.author,
    content: input.content,
    createdAt: input.at ?? Date.now(),
  };
  db.prepare(
    `INSERT INTO comments (id, card_id, author, content, created_at)
     VALUES (@id, @cardId, @author, @content, @createdAt)`,
  ).run(comment);
  return comment;
}
