import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const LINTER = 'node scripts/lint-sidecar.js';
const EXAMPLES = path.join('examples');

function run(file) {
  try {
    execSync(`${LINTER} ${file}`, { encoding: 'utf8' });
    return { code: 0 };
  } catch (e) {
    return { code: e.status, stderr: e.stderr };
  }
}

describe('lint-sidecar', () => {
  it('passes a valid sidecar', () => {
    const result = run(path.join(EXAMPLES, 'sample-sidecar.json'));
    assert.equal(result.code, 0);
  });

  it('fails when version is wrong', () => {
    const bad = JSON.parse(fs.readFileSync(path.join(EXAMPLES, 'sample-sidecar.json'), 'utf8'));
    bad.version = '2';
    const tmp = '/tmp/bad-version.json';
    fs.writeFileSync(tmp, JSON.stringify(bad));
    const result = run(tmp);
    assert.equal(result.code, 1);
  });

  it('fails when observed tier node is marked resolved', () => {
    const bad = JSON.parse(fs.readFileSync(path.join(EXAMPLES, 'sample-sidecar.json'), 'utf8'));
    bad.nodes[0].tier = 'observed';
    bad.nodes[0].status = 'resolved';
    bad.nodes[0].resolvedAt = Date.now();
    const tmp = '/tmp/bad-tier.json';
    fs.writeFileSync(tmp, JSON.stringify(bad));
    const result = run(tmp);
    assert.equal(result.code, 1);
  });

  it('fails when resolved node is missing resolvedAt', () => {
    const bad = JSON.parse(fs.readFileSync(path.join(EXAMPLES, 'sample-sidecar.json'), 'utf8'));
    bad.nodes[0].status = 'resolved';
    bad.nodes[0].tier = 'resolved';
    delete bad.nodes[0].resolvedAt;
    const tmp = '/tmp/bad-resolved.json';
    fs.writeFileSync(tmp, JSON.stringify(bad));
    const result = run(tmp);
    assert.equal(result.code, 1);
  });
});
