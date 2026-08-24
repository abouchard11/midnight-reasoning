import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ReasoningGraph } from '../dist/reasoning-graph.js';
import { createMemoryGraphiti } from '../dist/graphiti.js';

let scratch;

beforeEach(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-'));
});

afterEach(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

describe('ReasoningGraph', () => {
  it('reflect retries on a confident fail and resolves on pass', async () => {
    const answers = [
      { pass: false, critique: 'Missing #ad', confidence: 0.91 },
      { pass: true, critique: 'Verifier satisfied.', confidence: 0.95 },
    ];
    const rg = new ReasoningGraph({
      runId: 'run_t',
      projectId: 'dozen',
      goal: 'Draft a caption',
      doneMeans: 'FTC disclosure present',
      scratchDir: scratch,
      critic: async () => answers.shift(),
    });

    const first = await rg.reflect({
      stepId: 'draft',
      stepAttempt: 1,
      stepVerifier: 'FTC disclosure',
      stepEvidence: 'Shop the link',
      criticModel: 'test',
    });
    assert.equal(first.revised, true);

    const second = await rg.reflect({
      stepId: 'draft',
      stepAttempt: 2,
      stepVerifier: 'FTC disclosure',
      stepEvidence: '#ad Shop the link',
      criticModel: 'test',
    });
    assert.equal(second.revised, false);

    const snap = rg.snapshot();
    assert.equal(snap.nodes.length, 2);
    assert.equal(snap.nodes[0].tier, 'observed');
    assert.equal(snap.nodes[1].tier, 'resolved');
  });

  it('low-confidence critic is a pass (no forced retry)', async () => {
    const rg = new ReasoningGraph({
      runId: 'run_low',
      projectId: 'dozen',
      goal: 'g',
      doneMeans: 'd',
      scratchDir: scratch,
      critic: async () => ({ pass: false, critique: 'maybe', confidence: 0.4 }),
    });
    const result = await rg.reflect({
      stepId: 'draft',
      stepAttempt: 1,
      stepVerifier: 'v',
      stepEvidence: 'e',
      criticModel: 'test',
    });
    assert.equal(result.revised, false);
    assert.match(result.critique, /Low confidence/);
    assert.equal(rg.snapshot().nodes[0].tier, 'resolved');
  });

  it('promote without GraphitiPort throws and leaves the sidecar', async () => {
    const rg = new ReasoningGraph({
      runId: 'run_no',
      projectId: 'dozen',
      goal: 'g',
      doneMeans: 'd',
      scratchDir: scratch,
      critic: async () => ({ pass: true, critique: 'ok', confidence: 0.9 }),
    });
    await rg.reflect({
      stepId: 'draft',
      stepAttempt: 1,
      stepVerifier: 'v',
      stepEvidence: 'e',
      criticModel: 'test',
    });
    await assert.rejects(() => rg.promote(), /injected GraphitiPort/);
    assert.ok(rg.snapshot());
  });

  it('promote with memory store writes resolved nodes then discards sidecar', async () => {
    const graphiti = createMemoryGraphiti();
    const rg = new ReasoningGraph({
      runId: 'run_yes',
      projectId: 'dozen',
      goal: 'g',
      doneMeans: 'd',
      scratchDir: scratch,
      graphiti,
      critic: async () => ({ pass: true, critique: 'Verifier satisfied.', confidence: 0.9 }),
    });
    await rg.reflect({
      stepId: 'draft',
      stepAttempt: 1,
      stepVerifier: 'FTC disclosure',
      stepEvidence: '#ad',
      criticModel: 'test',
    });
    await rg.promote();
    assert.equal(rg.snapshot(), null);
    assert.equal(graphiti.episodes.length, 1);
    assert.equal(graphiti.episodes[0].groupId, 'reasoning:run_yes');
  });

  it('does not retry past maxAttempts', async () => {
    let called = 0;
    const rg = new ReasoningGraph({
      runId: 'run_max',
      projectId: 'dozen',
      goal: 'g',
      doneMeans: 'd',
      scratchDir: scratch,
      critic: async () => {
        called += 1;
        return { pass: false, critique: 'no', confidence: 0.9 };
      },
    });
    const result = await rg.reflect({
      stepId: 'draft',
      stepAttempt: 3,
      stepVerifier: 'v',
      stepEvidence: 'e',
      criticModel: 'test',
      maxAttempts: 3,
    });
    assert.equal(called, 0);
    assert.equal(result.revised, false);
    assert.match(result.critique, /Max attempts/);
  });
});
