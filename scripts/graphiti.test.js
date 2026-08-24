import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryGraphiti, promoteToGraphiti, recallPriorContext } from '../dist/graphiti.js';

function node(partial) {
  return {
    id: 'n1',
    runId: 'run_1',
    projectId: 'dozen',
    stepId: 'draft',
    stepAttempt: 1,
    question: 'Does the caption include a visible FTC disclosure?',
    critique: 'Verifier satisfied.',
    confidence: 0.9,
    revised: false,
    status: 'resolved',
    tier: 'resolved',
    createdAt: 1,
    resolvedAt: 1,
    ...partial,
  };
}

describe('GraphitiPort', () => {
  it('exposes addEpisode and search', () => {
    const store = createMemoryGraphiti();
    assert.equal(typeof store.addEpisode, 'function');
    assert.equal(typeof store.search, 'function');
  });

  it('promotes only resolved+resolved nodes under reasoning:<runId>', async () => {
    const store = createMemoryGraphiti();
    const n = await promoteToGraphiti(
      [
        node({ id: 'obs', status: 'open', tier: 'observed', resolvedAt: undefined }),
        node({ id: 'ok', status: 'resolved', tier: 'resolved' }),
      ],
      'run_1',
      store
    );
    assert.equal(n, 1);
    assert.equal(store.episodes.length, 1);
    assert.equal(store.episodes[0]?.groupId, 'reasoning:run_1');
    assert.equal(store.episodes[0]?.metadata.nodeId, 'ok');
  });

  it('recall without a store returns an empty list', async () => {
    const prior = await recallPriorContext('FTC disclosure', 'dozen', 3);
    assert.deepEqual(prior, []);
  });

  it('recall matches by projectId and query tokens', async () => {
    const store = createMemoryGraphiti();
    await promoteToGraphiti(
      [node({ question: 'Does the caption include a visible FTC disclosure?' })],
      'run_1',
      store
    );
    const hits = await recallPriorContext('FTC disclosure on caption', 'dozen', 3, store);
    assert.equal(hits.length, 1);
    assert.ok(hits[0].similarity > 0);
    const other = await recallPriorContext('FTC disclosure', 'kiel', 3, store);
    assert.equal(other.length, 0);
  });
});
