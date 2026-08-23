# midnight-reasoning

Cross-run reasoning graph for the MidnightDev agent stack.

Two-layer architecture:
- **Option 1 — Graphiti episodes** (`group_id: reasoning:<runId>`): durable, cross-run open questions. Survive process death. Queryable by semantic similarity at the start of any new run.
- **Option 2 — Run sidecar** (`reasoning-graph.json`): in-flight reflection nodes during a single run. Append-only. Promoted to Graphiti on `shipped`; discarded on `escaped`.

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
import { ReasoningGraph } from '@midnight/reasoning';

// Start a new run's sidecar
const rg = new ReasoningGraph({ runId: run.id, projectId: run.project });

// After a step produces evidence, run a critic pass
const result = await rg.reflect({
  step,
  run,
  criticModel: 'claude-sonnet-4-5',
});

if (result.revised) {
  // increment step.attempt, re-dispatch
}

// At run end
if (run.status === 'shipped') await rg.promote(); // open nodes → Graphiti
if (run.status === 'escaped') await rg.discard();
```

## Scripts

```sh
node scripts/lint-sidecar.js examples/sample-sidecar.json
node --test scripts/lint-sidecar.test.js
```

## Directory structure

```
midnight-reasoning/
├── src/
│   ├── reasoning-graph.ts       # ReasoningGraph class
│   ├── reflect.ts               # reflectStep() — critic model pass
│   ├── sidecar.ts               # append/read/discard reasoning-graph.json
│   ├── graphiti.ts              # promote() → Graphiti episodes
│   └── types.ts                 # ReflectionNode, SidecarGraph, CriticResult
├── scripts/
│   ├── lint-sidecar.js          # validates sidecar JSON schema
│   └── lint-sidecar.test.js     # node:test suite
├── examples/
│   ├── sample-sidecar.json      # valid sidecar for tests
│   └── sample-run.md            # annotated walkthrough
├── references/
│   ├── lanes.md                 # how this fits into Graphiti/GBrain lanes
│   └── prior-art.md             # PRefLexOR, Graph-PRefLexOR references
├── SKILL.md                     # loadable agent skill
├── AGENTS.md
├── package.json
└── tsconfig.json
```

## Hard rules

- The model does not own `promote()`. Only a script or human closes a reflection node into Graphiti.
- `observed` tier reflection nodes never persist. Only `resolved` nodes promote.
- Sidecar is local scratch. It is not committed to the repo during a run.
- Critic model may propose a retry. It may not auto-close an irreversible product edge.

## Related

- [agentic-graph-orchestration](https://github.com/abouchard11/agentic-graph-orchestration) — work topology + linter (private)
- [midnight-agent-skills](https://github.com/abouchard11/midnight-agent-skills) — drop-in skill pair (private)
- [hermes-command-center](https://github.com/abouchard11/hermes-command-center) — operator UI that consumes this library (private)
