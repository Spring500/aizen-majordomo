# Majordomo API Reference

Prefer the CLI for normal agent work. Use these APIs only when the CLI is insufficient.

## Create Decision

```http
POST /cards
```

```json
{
  "type": "decision",
  "status": "waiting",
  "fields": {
    "title": "是否采用方案 A？",
    "body": "请确认。",
    "options": ["采用 A", "采用 B"]
  }
}
```

Set `X-Actor: agent` when creating on behalf of an agent.

## Read Card

```http
GET /cards/:id
```

Use this to inspect current card state. A submitted formal reply appears in `card.fields.reply`; the reply author appears in `card.fields.replied_by`.

## Submit Formal Reply

```http
POST /cards/:id/actions/reply
```

```json
{
  "fields": {
    "reply": "采用方案 A。",
    "replied_by": "human"
  }
}
```

The action follows the card type configuration. It does not change card status in stage 3.

## Read Changes

```http
GET /changes?since=0
```

The response contains `changes` ordered by ascending `seq` and `latestSeq` for the next cursor.

Important events:

- `card.created`
- `card.updated`
- `card.action.reply`

Use `seq`, not `updated_at`, as the changes cursor.
