# Agent Board Configuration

The stage 3 agent board configuration lives at `agent-kit/configs/agent-board-config/config.json`.

## Card Types

- `decision`: Ask a human for a formal reply. Use this when work is blocked on a human choice, approval, or clarification.
- `task`: Track work that does not require a formal human reply.
- `memo`: Store context or notes that do not need action.

## Statuses

- `waiting`: The card is waiting for human attention. `pnpm majordomo ask` creates decisions in this status.
- `active`: Work is being handled.
- `resolved`: The decision or work item has been answered or resolved.
- `done`: The work is complete.
- `default`: System fallback. Do not use it for the agent ask flow.

## Decision Fields

- `title`: Short question or decision summary.
- `body`: Context the human needs before answering.
- `options`: Candidate choices. Humans may still reply with something else.
- `reply`: Formal human reply.
- `replied_by`: Human actor who replied.

## Actions

- `create`: Create a card.
- `update`: Edit ordinary fields.
- `reply`: Submit a formal human reply to a decision.

Stage 3 does not execute transitions or hooks. A reply does not automatically change status.
