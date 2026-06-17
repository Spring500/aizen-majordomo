// 提交信息校验的共享规则。被 verify-commit-msg.mjs(单条) 与 verify-range-messages.mjs(范围) 复用。
// 完整规范见 CONTRIBUTING.md。
import { execSync } from 'node:child_process';

export const TYPES = ['功能', '修复', '重构', '文档', '测试', '构建', '性能', '样式', '杂项'];

// 只对这三类「非代码」类型要求文件性质纯净；其余代码类型宽松放行(可夹带文档)。
const PURE_TYPES = { 文档: 'doc', 构建: 'build', 测试: 'test' };
const CATEGORY_LABEL = { doc: '文档', build: '构建/工具链', test: '测试' };

export function categorize(path) {
  const p = path.replace(/\\/g, '/');
  const base = p.split('/').pop() ?? p;
  if (/(^|\/)(tests?|__tests__)\//.test(p) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(base)) return 'test';
  if (
    /\.(md|mdx|markdown|txt|rst)$/i.test(base) ||
    /(^|\/)docs?\//.test(p) ||
    /^(README|CHANGELOG|LICENSE|AUTHORS|CONTRIBUTING)(\.|$)/i.test(base)
  )
    return 'doc';
  if (
    /(^|\/)(\.husky|scripts|\.github)\//.test(p) ||
    /^(package(-lock)?\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|yarn\.lock|tsconfig.*\.json|\.gitignore|\.npmrc|\.nvmrc|\.editorconfig|Dockerfile|docker-compose\.ya?ml)$/.test(base) ||
    /\.config\.[cm]?[jt]s$/.test(base) ||
    /^\.(prettier|eslint|commitlint)/.test(base)
  )
    return 'build';
  return 'code';
}

// 校验单条提交信息文本(结构/类型/署名)。返回 { skip, errors, type }。
// 不含「类型↔文件性质」检查——那条依赖暂存区,仅在 commit-msg hook 实时校验。
export function validateMessage(raw) {
  const lines = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('# ------------------------ >8')) break;
    if (line.startsWith('#')) continue;
    lines.push(line);
  }
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  const text = lines.join('\n');
  const title = (lines[0] ?? '').trim();

  // git 自动生成的合并/回退/fixup 提交,放行
  if (/^(Merge |Revert |fixup!|squash!)/.test(title)) return { skip: true, errors: [], type: null };

  const errors = [];
  const titleRe = new RegExp(`^(${TYPES.join('|')})(\\([^)]+\\))?: (.+)$`);
  const m = title.match(titleRe);
  if (!m) {
    errors.push(
      `首行格式不对。应为「类型: 标题」，类型须为：${TYPES.join('、')}（可加范围，如 功能(auth): ...）。\n  当前首行：${title || '(空)'}`,
    );
  } else {
    const subject = m[3].trim();
    if ([...title].length > 50) errors.push(`标题过长（${[...title].length} 字符），请控制在 50 字符以内。`);
    if (/[。.]$/.test(subject)) errors.push('标题末尾不要加句号。');
  }

  if (lines.length < 2 || lines[1].trim() !== '') {
    errors.push('首行（标题）之后必须空一行再写正文。');
  }

  const intentMatch = text.match(/^意图[：:]\s*(.*)$/m);
  if (!intentMatch) {
    errors.push('缺少「意图」段：正文需有一行以「意图：」开头，说明为什么做这次提交。');
  } else if (intentMatch[1].trim() === '') {
    errors.push('「意图：」后面没有内容，请写清本次提交要解决的问题或目标。');
  }

  const changesIdx = lines.findIndex((l) => /^主要修改[：:]/.test(l.trim()));
  if (changesIdx === -1) {
    errors.push('缺少「主要修改」段：正文需有一行以「主要修改：」开头，其下逐条列出改了什么。');
  } else {
    const hasBullet = lines.slice(changesIdx + 1).some((l) => /^\s*[-*]\s+\S/.test(l));
    if (!hasBullet) errors.push('「主要修改」段下至少要有一条以「- 」开头的要点。');
  }

  const signatureRe = /co-?authored-by:|generated with|🤖/i;
  const offending = lines.find((l) => signatureRe.test(l));
  if (offending) {
    errors.push(`禁止模型署名（一件工作可能跨模型，标注模型干扰统计）。请删除：${offending.trim()}`);
  }

  return { skip: false, errors, type: m ? m[1] : null };
}

// 暂存文件与声明类型的一致性(宽松:代码类型不查)。仅 commit-msg hook 用。
export function validateStagedAgainstType(type) {
  if (!type || !PURE_TYPES[type]) return [];
  const want = PURE_TYPES[type];
  const bad = stagedFiles().filter((f) => categorize(f) !== want);
  if (!bad.length) return [];
  return [
    `「${type}」提交应只包含${CATEGORY_LABEL[want]}文件，但检测到不匹配文件，请拆到对应类型的独立提交：\n      ${bad.join('\n      ')}`,
  ];
}

export function stagedFiles() {
  try {
    return execSync('git diff --cached --name-only -z', { encoding: 'utf8' })
      .split('\0')
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function printErrors(errors, heading = '✗ commit message 不符合规范（见 CONTRIBUTING.md）：') {
  console.error('\n' + heading + '\n');
  for (const e of errors) console.error('  • ' + e);
  console.error('\n  正确示例：');
  console.error('  ┌─────────────────────────────────────────');
  console.error('  │ 功能: 增加令牌鉴权中间件');
  console.error('  │');
  console.error('  │ 意图：让 agent 通过 Bearer 令牌访问 API，并按角色 scope 限权。');
  console.error('  │');
  console.error('  │ 主要修改：');
  console.error('  │ - 新增 src/middleware/auth.ts，解析并校验令牌');
  console.error('  │ - 在 /cards 路由挂载中间件');
  console.error('  └─────────────────────────────────────────\n');
}
