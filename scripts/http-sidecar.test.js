import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHttpGraphiti, promoteToGraphiti } from '../dist/graphiti.js';

const PORT = 18787;
const BASE = `http://127.0.0.1:${PORT}`;

describe('memory Graphiti sidecar', () => {
  let child;
  before(async () => {
    child = spawn(process.execPath, ['examples/http-sidecar.mjs'], {
      env: { ...process.env, PORT: String(PORT) },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('sidecar did not start')), 4000);
      child.stderr.on('data', (buf) => {
        if (String(buf).includes('graphiti sidecar')) {
          clearTimeout(t);
          resolve();
        }
      });
      child.on('error', reject);
    });
  });
  after(() => {
    child?.kill('SIGTERM');
  });

  it('promotes resolved nodes and recalls by project', async () => {
    const store = createHttpGraphiti({ baseUrl: BASE });
    const n = await promoteToGraphiti(
      [
        {
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
        },
      ],
      'run_1',
      store
    );
    assert.equal(n, 1);
    const hits = await store.search({
      query: 'FTC disclosure caption',
      projectId: 'dozen',
      limit: 3,
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].nodeId, 'n1');
    const other = await store.search({ query: 'FTC', projectId: 'kiel', limit: 3 });
    assert.equal(other.length, 0);
  });
});
