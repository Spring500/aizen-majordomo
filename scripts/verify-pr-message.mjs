// 校验 PR title/body 拼出的默认 squash commit message 是否符合提交规范。
import { validateMessage, printErrors } from './commit-rules.mjs';

const title = process.env.PR_TITLE ?? '';
const body = process.env.PR_BODY ?? '';
const message = `${title}\n\n${body}`.trimEnd();
const { skip, errors } = validateMessage(message);

if (!title.trim()) {
  errors.unshift('缺少 PR title，无法校验最终 squash commit message 的标题。');
}

if (!skip && errors.length) {
  printErrors(errors, '✗ PR title/body 拼出的 squash commit message 不合规：');
  console.error('提示：请让 PR title 使用「类型: 标题」，PR body 直接使用「意图：...」和「主要修改：」正文。');
  process.exit(1);
}

process.exit(0);
