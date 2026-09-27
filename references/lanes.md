# Reasoning Graph — Lane Reference

How `midnight-reasoning` fits into the existing Graphiti / GBrain / MEMORY.md trust hierarchy.

## Lane table

| Store | What goes here | Tier required to write | Closer | Never |
|---|---|---|---|---|
| Sidecar JSON (`.scratch/`) | In-flight reflection nodes, all tiers | `observed` or above | Script (discard/promote) | Durable facts, product state, secrets |
| Graphiti `reasoning-index` (v1 sidecar remaps; per-run id in metadata.runId — see `scripts/graphiti_sidecar.py`) | Resolved questions, cross-run context | `resolved` only | Script + policy (`promote()` + injected `GraphitiPort`) | GBrain pages, MEMORY.md entries, `observed` tier |
| GBrain page | Learning retros from closed run clusters | `decided` | Human / policy | Raw reflection nodes, sidecar dumps |
| MEMORY.md | Pointer to current run's top open question | Cache only | Overwritten each session | Anything authoritative |

`promote()` with no `GraphitiPort` throws. Sidecar stays. That is fail-closed, not a stub success.

## Conflict resolution order

Live sidecar > Graphiti reasoning lane > GBrain page > MEMORY.md cache

The library names the durable lane `reasoning:<runId>`. The production v1
adapter currently stores those episodes under `reasoning-index` and preserves
the library group as `origGroup` metadata. Treat that remap as a known temporary
implementation constraint, not a new public group convention.

## What this does NOT own

- Product graph topology → `agentic-graph-orchestration`
- Durable entity facts → Graphiti main group
- Skill learnings → `gbrain-graph-companion`
- Operator UI state → `hermes-command-center`

## TTL

The intended policy is for Graphiti reasoning episodes to expire after 30 days
by flipping `status` to `expired` through a cron or Graphiti TTL configuration.
That mechanism is **not implemented yet**. Until it is implemented and tested,
do not claim that durable reasoning expires automatically. Sidecar files in
`.scratch/` are process-local and should never be committed.
