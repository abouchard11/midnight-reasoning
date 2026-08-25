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

describe('confidence floor on promotion', () => {
  it('does not promote a low-confidence node even when marked resolved/resolved', async () => {
    // enforceCriticPolicy returns pass:true below the floor so an unsure critic
    // cannot force a retry loop, and pass:true sets status AND tier to 'resolved'.
    // That node must still never reach durable memory.
    const store = createMemoryGraphiti();
    const n = await promoteToGraphiti(
      [node({ id: 'unsure', confidence: 0.42, critique: '[Low confidence 0.42] Probably fine.' })],
      'run_floor',
      store
    );
    assert.equal(n, 0, 'low-confidence node must not be promoted');
    assert.equal(store.episodes.length, 0);
  });

  it('does not promote the unparseable-critic fallback (confidence 0.5)', async () => {
    const store = createMemoryGraphiti();
    const n = await promoteToGraphiti(
      [node({ id: 'garbage', confidence: 0.5, critique: 'Critic returned unparseable response.' })],
      'run_floor',
      store
    );
    assert.equal(n, 0, 'unparseable-response fallback must not be promoted');
  });

  it('promotes exactly at the floor', async () => {
    const store = createMemoryGraphiti();
    const n = await promoteToGraphiti([node({ id: 'edge', confidence: 0.6 })], 'run_floor', store);
    assert.equal(n, 1, 'confidence === floor is promotable');
  });

  it('rejects a non-finite confidence', async () => {
    const store = createMemoryGraphiti();
    const n = await promoteToGraphiti(
      [node({ id: 'nan', confidence: Number.NaN }), node({ id: 'undef', confidence: undefined })],
      'run_floor',
      store
    );
    assert.equal(n, 0, 'NaN/undefined confidence must not be promoted');
  });

  it('an uncertain node cannot be recalled as prior context', async () => {
    // The whole point: promoted nodes are re-injected into future runs.
    const store = createMemoryGraphiti();
    await promoteToGraphiti([node({ id: 'unsure', confidence: 0.42 })], 'run_floor', store);
    const prior = await recallPriorContext('FTC disclosure', 'dozen', 3, store);
    assert.equal(prior.length, 0, 'uncertain verdict must not become prior context');
  });
});
