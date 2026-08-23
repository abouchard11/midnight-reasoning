#!/usr/bin/env node
/**
 * lint-sidecar.js <path-to-sidecar.json>
 *
 * Validates a reasoning-graph sidecar file.
 * Exit 0 = valid. Exit 1 = invalid (with reasons).
 *
 * Rules:
 * - version must be '1'
 * - runId, projectId, goal, doneMeans must be non-empty strings
 * - nodes must be an array
 * - each node must have: id, runId, stepId, status, tier, createdAt
 * - no 'observed' tier node may have status 'resolved' (can't promote unverified)
 * - no node may have status 'resolved' without resolvedAt
 * - closeReason must be one of: shipped, escaped, stopped (if present)
 */

import fs from 'node:fs';

const VALID_STATUSES = ['open', 'resolved', 'expired', 'discarded'];
const VALID_TIERS = ['observed', 'verified', 'resolved'];
const VALID_CLOSE_REASONS = ['shipped', 'escaped', 'stopped'];

function lint(filePath) {
  const errors = [];

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    errors.push(`Cannot parse JSON: ${e.message}`);
    return errors;
  }

  if (raw.version !== '1') errors.push(`version must be '1', got '${raw.version}'`);
  if (!raw.runId) errors.push('runId is required');
  if (!raw.projectId) errors.push('projectId is required');
  if (!raw.goal) errors.push('goal is required');
  if (!raw.doneMeans) errors.push('doneMeans is required');
  if (!Array.isArray(raw.nodes)) errors.push('nodes must be an array');

  if (raw.closeReason && !VALID_CLOSE_REASONS.includes(raw.closeReason)) {
    errors.push(`closeReason must be one of: ${VALID_CLOSE_REASONS.join(', ')}`);
  }

  if (Array.isArray(raw.nodes)) {
    raw.nodes.forEach((node, i) => {
      const prefix = `nodes[${i}]`;
      if (!node.id) errors.push(`${prefix}.id is required`);
      if (!node.stepId) errors.push(`${prefix}.stepId is required`);
      if (!VALID_STATUSES.includes(node.status)) errors.push(`${prefix}.status invalid: ${node.status}`);
      if (!VALID_TIERS.includes(node.tier)) errors.push(`${prefix}.tier invalid: ${node.tier}`);
      if (!node.createdAt) errors.push(`${prefix}.createdAt is required`);
      if (node.tier === 'observed' && node.status === 'resolved') {
        errors.push(`${prefix}: observed tier node cannot have status 'resolved' — promote violation`);
      }
      if (node.status === 'resolved' && !node.resolvedAt) {
        errors.push(`${prefix}: resolved status requires resolvedAt timestamp`);
      }
    });
  }

  return errors;
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/lint-sidecar.js <path-to-sidecar.json>');
  process.exit(1);
}

const errors = lint(file);
if (errors.length > 0) {
  console.error('Sidecar lint FAILED:');
  errors.forEach((e) => console.error(`  ✗ ${e}`));
  process.exit(1);
} else {
  console.log('Sidecar lint passed ✓');
  process.exit(0);
}
