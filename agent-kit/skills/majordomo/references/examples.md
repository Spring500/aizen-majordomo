# Examples

## Short Decision

```powershell
pnpm majordomo ask --title "是否采用方案 A？" --body "请确认。" --option "采用 A" --option "采用 B"
```

The CLI prints the card id and the exact wait command.

```powershell
pnpm majordomo wait-reply --card-id <id>
```

## Structured Decision

Create `decision.json`:

```json
{
  "title": "是否采用方案 A？",
  "body": "背景：方案 A 实现快，方案 B 风险低。请给出正式选择和理由。",
  "options": ["采用 A", "采用 B"],
  "fields": {
    "priority": 1,
    "risk_level": "normal"
  }
}
```

Run:

```powershell
pnpm majordomo ask --stdin < decision.json
```

## Interrupted Wait

If this command is interrupted:

```powershell
pnpm majordomo wait-reply --card-id <id>
```

Run it again with the same card id. If the reply already exists, the CLI prints it immediately.
