#!/usr/bin/env node
// Live production promote through the full library path:
//   ReasoningGraph.reflect() -> sidecar gate -> promote() -> real Graphiti.
// The critic verdict is injected via CLI by the operator/session critic and is
// recorded as such — this script never invents a verdict on its own.
// Usage: GRAPHITI_URL=http://127.0.0.1:8801 node scripts/promote-live.mjs spec.json
import { readFileSync } from 'node:fs';
import { ReasoningGraph, graphitiFromEnv } from '../dist/index.js';

const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const graphiti = graphitiFromEnv();
if (!graphiti) { console.error('GRAPHITI_URL unset — refusing to dry-run silently'); process.exit(1); }

const rg = new ReasoningGraph({
  runId: spec.runId, projectId: spec.projectId,
  goal: spec.goal, doneMeans: spec.doneMeans,
  graphiti,
  critic: async () => ({ pass: spec.pass, critique: spec.critique, confidence: spec.confidence }),
});

const prior = await rg.recallPrior();
console.log('prior context rows:', prior.length);

const r = await rg.reflect({
  stepId: spec.stepId, stepAttempt: 1,
  stepVerifier: spec.verifier, stepEvidence: spec.evidence,
  criticModel: spec.criticModel,
});
console.log('reflect:', JSON.stringify({ revised: r.revised, nodeId: r.nodeId }));

const n = await rg.promote();
console.log('PROMOTED nodes:', n);
