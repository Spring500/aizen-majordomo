---
name: majordomo
description: Use when an AI agent needs to ask a human for an asynchronous decision through a local aizen-majordomo board, wait for the human reply, recover from interrupted waits, or inspect the agent board workflow.
---

# Majordomo Agent Workflow

Use the bundled CLI before writing custom HTTP calls.

## Ask For A Decision

From this skill directory, run `node scripts/majordomo.mjs ask`.

For short input, use `--title`, `--body`, and repeated `--option`.
For long or structured input, write a JSON file and run `node scripts/majordomo.mjs ask --stdin < file.json`.

After `ask`, read the returned card id and run the exact `wait-reply` command printed by the CLI.

## Wait For A Reply

From this skill directory, run `node scripts/majordomo.mjs wait-reply --card-id <id>`.

Human replies may take a long time. Allow this command to block. Do not infer failure from a long wait.

If the command is interrupted, run the same `wait-reply` command again. It checks the current card before waiting for new changes.

## References

- Read `references/examples.md` for complete workflows.
- Read `references/recovery.md` when a wait was interrupted or the service restarted.
- Read `references/board-config.md` when deciding which card type or status to use.
- Read `references/api.md` only when the CLI is insufficient.
