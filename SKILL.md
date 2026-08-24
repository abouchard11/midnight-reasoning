---
name: midnight-reasoning
description: Manages a two-layer reasoning graph for MidnightDev agent runs. Use when the user mentions reflection, critic pass, open questions, reasoning sidecar, cross-run memory, or PRefLexOR-style thinking loops. Pairs with agentic-graph-orchestration (work topology) and gbrain-graph-companion (durable memory). The model does not own promote or persist.
---

# Midnight Reasoning

Adds a PRefLexOR-style critic pass and cross-run knowledge graph to any agent run without fine-tuning.

## Two layers

### Layer 1 — Run sidecar (Option 2)

Local file: `.scratch/reasoning-graph.<runId>.json`

- Created when a run starts.
- A new `ReflectionNode` is appended after every `reflectStep()` call.
- At run end:
  - `shipped` → `promote()` sends `resolved` nodes to Graphiti as `reasoning:<runId>` episodes. Requires an injected `GraphitiPort`. Throws and leaves the sidecar if none is present.
  - `escaped` / `stopped` → `discard()` deletes the file. Nothing persists.

### Layer 2 — Graphiti episodes (Option 1)

`group_id: reasoning:<runId>`

- Each episode is a `ReflectionNode` with `status: resolved`.
- Queried at the start of a new run via `matchReasoningNodes(goalEmbedding, projectId)`.
- Top 3 open questions from past runs inject as pre-context into the first planning step.
- TTL: 30 days. After that, episode status flips to `expired`.
- There is no default Graphiti client. `createMemoryGraphiti()` is tests/dry-run only.

## Procedure

### 1. On run start

```ts
const rg = new ReasoningGraph({ runId, projectId, goal, doneMeans, graphiti });
const priorContext = await rg.recallPrior(); // top 3; [] if no GraphitiPort
// inject priorContext into first Step's context window
```

### 2. After each step produces evidence

```ts
const result = await rg.reflect({ step, run, criticModel });
// result: { revised: boolean, critique: string, nodeId: string }
```

If `result.revised === true`:
- Increment `step.attempt`
- Append `result.critique` to `run.logs`
- Re-dispatch the step
- Do NOT auto-close any gate or irreversible edge

If `result.revised === false`:
- Mark node `resolved` in sidecar
- Continue

### 3. On run end

```ts
// shipped — human/policy only
await rg.promote(); // resolved nodes → GraphitiPort. Throws if missing.
await rg.discard(); // delete local sidecar

// escaped / stopped
await rg.discard(); // delete only, nothing persists
```

## Critic prompt contract

The critic model receives:
```
Goal: <run.outcome>
Done means: <run.doneMeans>
Step verifier: <step.verifier>
Evidence produced: <step.evidence>

Does this evidence satisfy the verifier? If not, what specifically is wrong and what should the agent try differently?
```

Critic returns structured JSON:
```json
{ "pass": false, "critique": "The evidence does not address X because Y. Try Z.", "confidence": 0.82 }
```

`confidence < 0.6` → treat as `pass: true` (critic is unsure, do not force retry).

## Hard rules

- Model drafts reflection nodes. Model does not own `promote()` or `persist()`.
- Never promote an `observed` node. Only `resolved`.
- Critic may not close accept / post / pay / publish gates.
- Max 3 reflect attempts per step (maps to `loop.maxAttempts`).
- If `noProgressStreak >= 2` on the same step, surface to human. Do not loop forever.
- Do not log-and-succeed a missing Graphiti client.

## Lanes

| Store | What goes here | Never |
|---|---|---|
| Sidecar JSON | In-flight reflection nodes, all tiers | Durable facts, product state |
| Graphiti `reasoning:*` | Resolved questions, cross-run context | GBrain pages, MEMORY.md entries |
| GBrain | Learning pages from closed run retros | Raw reflection nodes |
| MEMORY.md | Pointer to current run's top open question | Anything authoritative |

## Reference files

- `references/lanes.md`
- `references/prior-art.md`
- `examples/sample-sidecar.json`
- `examples/sample-run.md`

## Retrospective (runs after every invocation)

After the primary work finishes, produce a single observed note if and only if one of these is true:

1. The same verifier failed ≥2 times in this run
2. A node had no useful evidence and the critic confidence stayed < 0.6
3. The skill instructions were ambiguous enough that the agent had to guess
4. A stop condition fired (max attempts, dollar ceiling, no-progress)

Format:

- tier: observed
- target: skill name, graph id, or types file
- proposal: one concrete change (not a vibe)
- evidence: step ids + short quote

Do not edit any SKILL.md, graph JSON, or types file.
Do not call promote / persist / remember.
Write the note to `.scratch/retro.<runId>.md` and stop.

If a note was written, the runtime surfaces it as a Hermes InboxItem
(kind: "decision", title: "Skill/graph improvement candidate").
