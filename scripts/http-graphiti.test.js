import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHttpGraphiti, graphitiFromEnv, promoteToGraphiti } from '../dist/graphiti.js';

function node() {
  return {
    id: 'n1',
    runId: 'run_1',
    projectId: 'dozen',
    stepId: 'draft',
    stepAttempt: 1,
    question: 'FTC disclosure?',
    critique: 'Verifier satisfied.',
    confidence: 0.9,
    revised: false,
    status: 'resolved',
    tier: 'resolved',
    createdAt: 1,
    resolvedAt: 1,
  };
}

describe('HTTP GraphitiPort', () => {
  it('graphitiFromEnv is undefined without GRAPHITI_URL', () => {
    assert.equal(graphitiFromEnv({}), undefined);
    assert.equal(graphitiFromEnv({ GRAPHITI_URL: '   ' }), undefined);
  });

  it('createHttpGraphiti refuses an empty base URL', () => {
    assert.throws(() => createHttpGraphiti({ baseUrl: '  ' }), /GRAPHITI_URL is empty/);
  });

  it('promote throws on non-2xx and does not swallow', async () => {
    const calls = [];
    const store = createHttpGraphiti({
      baseUrl: 'https://graphiti.example',
      apiKey: 'k',
      fetch: async (url, init) => {
        calls.push({ url: String(url), auth: init.headers.authorization });
        return { ok: false, status: 503, json: async () => ({}) };
      },
    });
    await assert.rejects(
      () => promoteToGraphiti([node()], 'run_1', store),
      /Graphiti promote failed: 503/
    );
    assert.equal(calls[0].url, 'https://graphiti.example/episodes');
    assert.equal(calls[0].auth, 'Bearer k');
  });

  it('search maps PriorContext and fails closed on a bad payload', async () => {
    const store = createHttpGraphiti({
      baseUrl: 'https://graphiti.example',
      fetch: async () => ({
        ok: true,
        status: 200,
        json: async () => [
          { nodeId: 'n1', question: 'FTC?', projectId: 'dozen', resolvedAt: 1, similarity: 0.8 },
        ],
      }),
    });
    const hits = await store.search({ query: 'FTC', projectId: 'dozen', limit: 3 });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].nodeId, 'n1');

    const bad = createHttpGraphiti({
      baseUrl: 'https://graphiti.example',
      fetch: async () => ({ ok: true, status: 200, json: async () => ({ nope: true }) }),
    });
    await assert.rejects(() => bad.search({ query: 'x', projectId: 'dozen', limit: 1 }), /expected array/);
  });
});
