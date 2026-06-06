// 校验某个提交范围内每条提交信息是否合规(结构/类型/署名)。
// 用于 --no-ff 合并进 main 的闸门:保证合入 main 的历史每条 message 都合规。
// 用法:node scripts/verify-range-messages.mjs <range>   例:HEAD..MERGE_HEAD
import { execSync } from 'node:child_process';
import { validateMessage, printErrors } from './commit-rules.mjs';

const range = process.argv[2];
if (!range) {
  console.error('range 消息校验：缺少范围参数(如 HEAD..MERGE_HEAD)');
  process.exit(1);
}

let hashes = [];
try {
  hashes = execSync(`git rev-list ${range}`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
} catch (e) {
  console.error(`range 消息校验：无法解析范围 ${range}：${e.message}`);
  process.exit(1);
}

let failed = false;
for (const h of hashes) {
  const msg = execSync(`git log -1 --format=%B ${h}`, { encoding: 'utf8' });
  const { skip, errors } = validateMessage(msg);
  if (!skip && errors.length) {
    failed = true;
    const subject = msg.split('\n')[0];
    printErrors(errors, `✗ 合入提交 ${h.slice(0, 8)} 消息不合规：${subject}`);
  }
}

if (failed) {
  console.error('提示：可对该分支改用 squash 落地(丢弃脏历史)，或 reword 后再 --no-ff 合并。\n');
  process.exit(1);
}
process.exit(0);
