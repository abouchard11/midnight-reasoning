# Reasoning Graph — Lane Reference

How `midnight-reasoning` fits into the existing Graphiti / GBrain / MEMORY.md trust hierarchy.

## Lane table

| Store | What goes here | Tier required to write | Closer | Never |
|---|---|---|---|---|
| Sidecar JSON (`.scratch/`) | In-flight reflection nodes, all tiers | `observed` or above | Script (discard/promote) | Durable facts, product state, secrets |
| Graphiti `reasoning:<runId>` | Resolved questions, cross-run context | `resolved` only | Script + policy (`promote()` + injected `GraphitiPort`) | GBrain pages, MEMORY.md entries, `observed` tier |
| GBrain page | Learning retros from closed run clusters | `decided` | Human / policy | Raw reflection nodes, sidecar dumps |
| MEMORY.md | Pointer to current run's top open question | Cache only | Overwritten each session | Anything authoritative |

`promote()` with no `GraphitiPort` throws. Sidecar stays. That is fail-closed, not a stub success.

## Conflict resolution order

Live sidecar > Graphiti `reasoning:*` > GBrain page > MEMORY.md cache

## What this does NOT own

- Product graph topology → `agentic-graph-orchestration`
- Durable entity facts → Graphiti main group
- Skill learnings → `gbrain-graph-companion`
- Operator UI state → `hermes-command-center`

## TTL

Graphiti `reasoning:*` episodes expire after 30 days (flip `status` to `expired` via a cron or Graphiti TTL config). Sidecar files in `.scratch/` are process-local and should never be committed.
