# midnight-reasoning

Cross-run reasoning graph for the MidnightDev agent stack.

Two-layer architecture:
- **Option 1 — Graphiti episodes**: confident, resolved reflection nodes that survive process death and can be recalled by later runs. The library emits `group_id: reasoning:<runId>`. The current production adapter temporarily remaps those episodes into `reasoning-index` and preserves the original group in metadata.
- **Option 2 — Run sidecar** (`.scratch/reasoning-graph.<runId>.json`): in-flight reflection nodes during a single run. Nodes are logically append-only. The JSON document is rewritten on each append, promoted on `shipped`, and discarded on `escaped` or `stopped`.

Graphiti is an **injected port**. The TypeScript library contains no embedded direct Graphiti client. Production Graphiti access is injected through `createHttpGraphiti()` / `graphitiFromEnv()` and the operator-run adapter at `scripts/graphiti_sidecar.py`. `promote()` without a store throws and leaves the sidecar on disk. `createMemoryGraphiti()` is for tests and dry-runs only; production code must not silently fall back to it.

No new trust-tier violations. No new durable stores. GBrain and MEMORY.md are untouched.

## Stack

```
agentic-graph-orchestration     ← canonical work topology + linter
        ↑ consumed by
midnight-agent-skills           ← packaging pair (work + memory closer)
        ↑ consumed by
midnight-reasoning              ← THIS REPO: reflection / critic library
        ↑ consumed by
hermes-command-center           ← operator UI + run state
```

Ownership is directed. This library consumes upstream contracts and is consumed by Hermes. It does not edit upstream skills from product work.

## Install

```sh
npm install
```

## Usage

```ts
import { ReasoningGraph, graphitiFromEnv } from '@midnight/reasoning';

// Production: undefined when GRAPHITI_URL is absent. Do not fall back silently.
const graphiti = graphitiFromEnv();

const rg = new ReasoningGraph({
  runId: run.id,
  projectId: run.project,
  goal: run.outcome,
  doneMeans: run.doneMeans,
  graphiti,
  critic: async () => ({ pass: true, critique: 'Verifier satisfied.', confidence: 0.9 }),
});

const result = await rg.reflect({
  stepId: step.id,
  stepAttempt: step.attempt,
  stepVerifier: step.verifier,
  stepEvidence: step.evidence ?? '',
  criticModel: 'claude-sonnet-4-5',
});

if (result.revised) {
  // increment step.attempt, re-dispatch
}

// Human/policy-closed. promote() throws if graphiti is missing and deletes the
// sidecar only after every promotable node has been accepted by the port.
if (run.status === 'shipped') await rg.promote();
if (run.status === 'escaped') await rg.discard();
```

For tests and explicit dry-runs, inject `createMemoryGraphiti()` directly. Its
episodes are process-local and are not durable Graphiti memory.

## Scripts

```sh
npm test
node scripts/lint-sidecar.js examples/sample-sidecar.json
node examples/http-sidecar.mjs   # memory sidecar; GRAPHITI_URL=http://127.0.0.1:8787
python3 scripts/graphiti_sidecar.py --selftest
```

The production adapter must be started from the Graphiti MCP server project so
it imports the same `GraphitiConfig` bootstrap as the running service. See the
module docstring in `scripts/graphiti_sidecar.py` for the operator command. A
live promotion is an irreversible durable write and remains human/policy-closed.

## Directory structure

```
midnight-reasoning/
├── src/
│   ├── reasoning-graph.ts       # ReasoningGraph class
│   ├── reflect.ts               # runCriticPass() + enforceCriticPolicy()
│   ├── policy.ts                # shared confidence floor
│   ├── sidecar.ts               # append/read/discard per-run sidecar JSON
│   ├── graphiti.ts              # GraphitiPort, memory store, promote/recall
│   └── types.ts                 # ReflectionNode, SidecarGraph, CriticResult
├── scripts/
│   ├── graphiti_sidecar.py       # operator-run production Graphiti adapter
│   ├── promote-live.mjs          # explicit live-promotion harness
│   ├── lint-sidecar.js
│   └── *.test.js
├── examples/
├── references/
├── SKILL.md
├── AGENTS.md
└── package.json
```

## Hard rules

- The model does not own `promote()`. Only a script or human closes a reflection node into Graphiti.
- `promote()` without an injected `GraphitiPort` throws. It does not log-and-succeed.
- `observed` tier reflection nodes never persist. A node must be resolved and meet the confidence floor to promote.
- Sidecar is local scratch. It is not committed to the repo during a run.
- Critic model may propose a retry. It may not auto-close an irreversible product edge.
- Critic confidence below 0.6 lets the current step proceed, but the resulting node is not promotable and cannot become recalled prior context.
- Max three reflection attempts per step. The caller currently owns `noProgressStreak` accounting and must surface to a human at two; the library does not compute that streak yet.

## Production status and limits

One real node has completed the production path from local scratch through the
critic and promotion gate into Graphiti, followed by a successful verification
recall. That proves the basic gate and adapter path, not the full cross-run
system.

The current v1 production adapter:

- stores all reasoning episodes in the shared `reasoning-index` group and keeps the library's per-run group in `origGroup` metadata;
- filters by `projectId` in metadata;
- ranks the latest 60 episodes using lexical token overlap, not Graphiti hybrid semantic search;
- does not implement the documented 30-day TTL; and
- has not yet fed recalled context into a live task's first planning step.

See [`KNOWN-GAPS.md`](./KNOWN-GAPS.md) for the full proof boundary, including
contradiction reconciliation and partial-promotion recovery.

## Related

- [agentic-graph-orchestration](https://github.com/abouchard11/agentic-graph-orchestration) — work topology + linter (private)
- [midnight-agent-skills](https://github.com/abouchard11/midnight-agent-skills) — drop-in skill pair (private)
- [hermes-command-center](https://github.com/abouchard11/hermes-command-center) — operator UI that consumes this library (private)
