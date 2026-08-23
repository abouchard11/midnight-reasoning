import fs from 'node:fs';
import path from 'node:path';
import type { SidecarGraph, ReflectionNode } from './types.js';

export function sidecarPath(runId: string, scratchDir = '.scratch'): string {
  return path.join(scratchDir, `reasoning-graph.${runId}.json`);
}

export function initSidecar(
  opts: Pick<SidecarGraph, 'runId' | 'projectId' | 'goal' | 'doneMeans'>,
  scratchDir = '.scratch'
): SidecarGraph {
  fs.mkdirSync(scratchDir, { recursive: true });
  const graph: SidecarGraph = {
    version: '1',
    runId: opts.runId,
    projectId: opts.projectId,
    goal: opts.goal,
    doneMeans: opts.doneMeans,
    nodes: [],
    createdAt: Date.now(),
  };
  writeSidecar(graph, scratchDir);
  return graph;
}

export function readSidecar(runId: string, scratchDir = '.scratch'): SidecarGraph | null {
  const p = sidecarPath(runId, scratchDir);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8')) as SidecarGraph;
}

export function writeSidecar(graph: SidecarGraph, scratchDir = '.scratch'): void {
  const p = sidecarPath(graph.runId, scratchDir);
  fs.writeFileSync(p, JSON.stringify(graph, null, 2), 'utf8');
}

export function appendNode(
  runId: string,
  node: ReflectionNode,
  scratchDir = '.scratch'
): SidecarGraph {
  const graph = readSidecar(runId, scratchDir);
  if (!graph) throw new Error(`No sidecar found for runId: ${runId}`);
  graph.nodes.push(node);
  writeSidecar(graph, scratchDir);
  return graph;
}

export function closeSidecar(
  runId: string,
  reason: SidecarGraph['closeReason'],
  scratchDir = '.scratch'
): SidecarGraph {
  const graph = readSidecar(runId, scratchDir);
  if (!graph) throw new Error(`No sidecar found for runId: ${runId}`);
  graph.closedAt = Date.now();
  graph.closeReason = reason;
  writeSidecar(graph, scratchDir);
  return graph;
}

export function discardSidecar(runId: string, scratchDir = '.scratch'): void {
  const p = sidecarPath(runId, scratchDir);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
