// commit-msg hook 入口:校验单条提交信息 + 暂存文件与类型一致性。
// 用法:node scripts/verify-commit-msg.mjs <commit-msg-file>
import { readFileSync } from 'node:fs';
import { validateMessage, validateStagedAgainstType, printErrors } from './commit-rules.mjs';

const file = process.argv[2];
if (!file) {
  console.error('commit-msg 校验：缺少消息文件参数');
  process.exit(1);
}

const { skip, errors, type } = validateMessage(readFileSync(file, 'utf8'));
if (skip) process.exit(0);

const all = [...errors, ...validateStagedAgainstType(type)];
if (all.length) {
  printErrors(all);
  process.exit(1);
}
process.exit(0);
