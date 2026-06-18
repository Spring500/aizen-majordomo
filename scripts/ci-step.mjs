import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const separatorIndex = process.argv.indexOf('--');
const nameIndex = process.argv.indexOf('--name');

if (nameIndex === -1 || !process.argv[nameIndex + 1] || separatorIndex === -1 || separatorIndex === process.argv.length - 1) {
  console.error('Usage: node scripts/ci-step.mjs --name "<step name>" -- <command> [args...]');
  process.exit(2);
}

const name = process.argv[nameIndex + 1];
const command = process.argv[separatorIndex + 1];
const args = process.argv.slice(separatorIndex + 2);
const started = Date.now();
const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
const durationMs = Date.now() - started;
const status = result.status === 0 ? 'success' : 'failure';

writeSummary({ name, status, durationMs, command: [command, ...args].join(' ') });

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);

function writeSummary({ name, status, durationMs, command }) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const duration = formatDuration(durationMs);
  const icon = status === 'success' ? 'OK' : 'FAIL';
  const line = `| ${escapeCell(name)} | ${icon} ${status} | ${duration} | \`${escapeCell(command)}\` |\n`;

  appendFileSync(
    summaryPath,
    `\n### CI step result: ${name}\n\n| Step | Status | Duration | Command |\n| --- | --- | ---: | --- |\n${line}`,
    'utf8',
  );
}

function formatDuration(durationMs) {
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function escapeCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}
