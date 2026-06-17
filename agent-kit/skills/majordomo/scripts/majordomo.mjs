#!/usr/bin/env node

import { readFileSync } from 'node:fs';

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) {
      args._.push(item);
      continue;
    }

    const key = item.slice(2);
    if (key === 'stdin') {
      args.stdin = true;
      continue;
    }

    const value = argv[index + 1];
    index += 1;
    if (key === 'option') {
      args.option = [...(args.option ?? []), value];
    } else {
      args[key] = value;
    }
  }
  return args;
}

function baseUrl(args) {
  return String(args['base-url'] ?? process.env.MAJORDOMO_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
}

async function requestJson(url, init) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = body?.error?.details?.reason ?? body?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(reason);
  }
  return body;
}

function readStdinJson() {
  const raw = readFileSync(0, 'utf8');
  return JSON.parse(raw);
}

function buildAskInput(args) {
  if (args.stdin) return readStdinJson();
  if (!args.title) throw new Error('ask 需要 --title，复杂输入可使用 --stdin');
  return {
    title: args.title,
    body: args.body,
    options: args.option ?? [],
    fields: {},
  };
}

async function ask(args) {
  const input = buildAskInput(args);
  const fields = {
    ...(input.fields ?? {}),
    title: input.title,
    ...(input.body !== undefined ? { body: input.body } : {}),
    ...(input.options !== undefined ? { options: input.options } : {}),
  };
  const body = await requestJson(`${baseUrl(args)}/cards`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
    body: JSON.stringify({ type: 'decision', status: 'waiting', fields }),
  });
  const id = body.card.id;
  console.log(`已创建等待人类回复的 decision。

本次询问的 card id 是：${id}

运行以下命令等待回复：
pnpm majordomo wait-reply --card-id ${id}`);
}

function extractReply(card) {
  const reply = card?.fields?.reply ?? card?.reply;
  if (typeof reply === 'string' && reply.trim().length > 0) {
    return { reply, repliedBy: card?.fields?.replied_by ?? card?.replied_by ?? 'human' };
  }
  return null;
}

async function getCard(args, cardId) {
  const body = await requestJson(`${baseUrl(args)}/cards/${cardId}`);
  return body.card;
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitReply(args) {
  const cardId = args['card-id'];
  if (!cardId) throw new Error('wait-reply 需要 --card-id');
  let latestSeq = 0;

  while (true) {
    const card = await getCard(args, cardId);
    const found = extractReply(card);
    if (found) {
      console.log(`已收到人类回复。

card id：${cardId}
回复人：${found.repliedBy}
回复内容：
${found.reply}`);
      return;
    }

    const changes = await requestJson(`${baseUrl(args)}/changes?since=${latestSeq}`);
    latestSeq = changes.latestSeq ?? latestSeq;
    await wait(2000);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (command === 'ask') return ask(args);
  if (command === 'wait-reply') return waitReply(args);
  throw new Error('可用命令：ask, wait-reply');
}

main().catch((error) => {
  console.error(`majordomo CLI 失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
