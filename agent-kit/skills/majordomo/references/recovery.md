# Recovery Guide

## Wait Was Interrupted

Run the same command again:

```powershell
node agent-kit/skills/majordomo/scripts/majordomo.mjs wait-reply --card-id <id>
```

The CLI first reads the current card. If the human already replied, it prints the reply immediately. It does not rely on the previous process still running.

## Service Restarted

Restart the service, then run the same `wait-reply` command again. The card and changes are stored in SQLite.

## Lost The Changes Cursor

Do not reconstruct cursor state. Use `wait-reply --card-id <id>`; it checks the card state directly before watching new changes.

## Lost The Card Id

Inspect recent `decision` cards in the board UI, or read recent changes:

```http
GET /changes?since=0
```

Look for a recent `card.created` event with `payload.type = "decision"` and `payload.status = "waiting"`.

## Long Human Delay

Human replies may take a long time. Keep waiting unless the user explicitly redirects the task. Do not treat a long wait as rejection or failure.
