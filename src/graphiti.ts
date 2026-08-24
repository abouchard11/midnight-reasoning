import type { GraphitiPort, PriorContext, ReflectionNode } from './types.js';

export type MemoryEpisode = {
  groupId: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: number;
};

export type MemoryGraphiti = GraphitiPort & { episodes: MemoryEpisode[] };

function tokenScore(query: string, hay: string): number {
  const q = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  if (q.length === 0) return 0;
  const h = hay.toLowerCase();
  const hits = q.filter((w) => h.includes(w)).length;
  return hits / q.length;
}

/**
 * In-process Graphiti stand-in for tests and local dry-runs.
 * Not durable. Not production Graphiti.
 */
export function createMemoryGraphiti(): MemoryGraphiti {
  const episodes: MemoryEpisode[] = [];
  return {
    episodes,
    async addEpisode(input) {
      episodes.push({
        groupId: input.groupId,
        content: input.content,
        metadata: input.metadata,
        createdAt: Date.now(),
      });
    },
    async search(input) {
      return episodes
        .filter((e) => e.metadata.projectId === input.projectId)
        .map((e) => ({
          nodeId: String(e.metadata.nodeId ?? ''),
          question: String(e.metadata.question ?? ''),
          projectId: input.projectId,
          resolvedAt: Number(e.metadata.resolvedAt ?? 0),
          similarity: tokenScore(input.query, `${e.content} ${e.metadata.question ?? ''}`),
        }))
        .filter((p) => p.similarity > 0)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, input.limit);
    },
  };
}

function promotable(node: ReflectionNode): boolean {
  return node.status === 'resolved' && node.tier === 'resolved';
}

/**
 * Promote resolved reflection nodes into Graphiti.
 * group_id convention: reasoning:<runId>
 *
 * HUMAN/POLICY-closed. Requires an injected GraphitiPort.
 * Refuses to no-op-log and pretend success.
 */
export async function promoteToGraphiti(
  nodes: ReflectionNode[],
  runId: string,
  store: GraphitiPort
): Promise<number> {
  const resolved = nodes.filter(promotable);
  if (resolved.length === 0) return 0;

  const groupId = `reasoning:${runId}`;
  for (const node of resolved) {
    await store.addEpisode({
      groupId,
      content: node.critique,
      metadata: {
        nodeId: node.id,
        question: node.question,
        stepId: node.stepId,
        projectId: node.projectId,
        resolvedAt: node.resolvedAt,
      },
    });
  }
  return resolved.length;
}

/**
 * Recall prior resolved questions for a project.
 * No store → honest empty list (do not invent context).
 */
export async function recallPriorContext(
  goalText: string,
  projectId: string,
  topN = 3,
  store?: GraphitiPort
): Promise<PriorContext[]> {
  if (!store) return [];
  return store.search({ query: goalText, projectId, limit: topN });
}
