# midnight-reasoning

Cross-run reasoning graph for the MidnightDev agent stack.

Two-layer architecture:
- **Option 1 — Graphiti episodes** (`group_id: reasoning:<runId>`): durable, cross-run open questions. Survive process death. Queryable by semantic similarity at the start of any new run.
- **Option 2 — Run sidecar** (`reasoning-graph.json`): in-flight reflection nodes during a single run. Append-only. Promoted to Graphiti on `shipped`; discarded on `escaped`.

Graphiti is an **injected port**. There is no live client in this repo. `promote()` without a store throws and leaves the sidecar on disk. `createMemoryGraphiti()` is for tests and dry-runs only.

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
import { ReasoningGraph, createMemoryGraphiti, graphitiFromEnv } from '@midnight/reasoning';

const graphiti = graphitiFromEnv() ?? createMemoryGraphiti(); // env client, else tests-only memory. promote() still throws if you pass nothing.

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

if (run.status === 'shipped') await rg.promote(); // policy/human. Throws if graphiti missing.
if (run.status === 'escaped') await rg.discard();
```

## Scripts

```sh
npm test
node scripts/lint-sidecar.js examples/sample-sidecar.json
node examples/http-sidecar.mjs   # memory sidecar; GRAPHITI_URL=http://127.0.0.1:8787
```

## Directory structure

```
midnight-reasoning/
├── src/
│   ├── reasoning-graph.ts       # ReasoningGraph class
│   ├── reflect.ts               # runCriticPass() + enforceCriticPolicy()
│   ├── sidecar.ts               # append/read/discard reasoning-graph.json
│   ├── graphiti.ts              # GraphitiPort, memory store, promote/recall
│   └── types.ts                 # ReflectionNode, SidecarGraph, CriticResult
├── scripts/
│   ├── lint-sidecar.js
│   └── lint-sidecar.test.js
├── examples/
├── references/
├── SKILL.md
├── AGENTS.md
└── package.json
```

## Hard rules

- The model does not own `promote()`. Only a script or human closes a reflection node into Graphiti.
- `promote()` without an injected `GraphitiPort` throws. It does not log-and-succeed.
- `observed` tier reflection nodes never persist. Only `resolved` nodes promote.
- Sidecar is local scratch. It is not committed to the repo during a run.
- Critic model may propose a retry. It may not auto-close an irreversible product edge.
- Critic confidence below 0.6 is a pass.

## Related

- [agentic-graph-orchestration](https://github.com/abouchard11/agentic-graph-orchestration) — work topology + linter (private)
- [midnight-agent-skills](https://github.com/abouchard11/midnight-agent-skills) — drop-in skill pair (private)
- [hermes-command-center](https://github.com/abouchard11/hermes-command-center) — operator UI that consumes this library (private)
