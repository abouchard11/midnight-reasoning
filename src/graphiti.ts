import type { GraphitiPort, PriorContext, ReflectionNode } from './types.js';
import { CONFIDENCE_FLOOR } from './policy.js';

export type MemoryEpisode = {
  groupId: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: number;
};

export type MemoryGraphiti = GraphitiPort & { episodes: MemoryEpisode[] };

export type HttpGraphitiOptions = {
  baseUrl: string;
  apiKey?: string;
  fetch?: typeof fetch;
};

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

function asPrior(raw: unknown): PriorContext {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Graphiti search: expected object items');
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.nodeId !== 'string' || typeof o.question !== 'string') {
    throw new Error('Graphiti search: missing nodeId/question');
  }
  return {
    nodeId: o.nodeId,
    question: o.question,
    projectId: String(o.projectId ?? ''),
    resolvedAt: Number(o.resolvedAt ?? 0),
    similarity: Number(o.similarity ?? 0),
  };
}

/**
 * HTTP GraphitiPort against an operator-owned sidecar.
 *
 * Contract (your Graphiti adapter must implement these):
 *   POST {baseUrl}/episodes   body: { groupId, content, metadata }
 *   POST {baseUrl}/search     body: { query, projectId, limit } → PriorContext[]
 *
 * Non-2xx throws. This is not a live Zep/Graphiti client.
 */
export function createHttpGraphiti(opts: HttpGraphitiOptions): GraphitiPort {
  const base = opts.baseUrl.trim().replace(/\/$/, '');
  if (!base) throw new Error('GRAPHITI_URL is empty');
  const f = opts.fetch ?? fetch;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.apiKey) headers.authorization = `Bearer ${opts.apiKey}`;

  return {
    async addEpisode(input) {
      const res = await f(`${base}/episodes`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Graphiti promote failed: ${res.status}`);
    },
    async search(input) {
      const res = await f(`${base}/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Graphiti search failed: ${res.status}`);
      const data: unknown = await res.json();
      if (!Array.isArray(data)) throw new Error('Graphiti search: expected array');
      return data.map(asPrior);
    },
  };
}

/** Missing GRAPHITI_URL → undefined. Callers must not pretend a client exists. */
export function graphitiFromEnv(env: Record<string, string | undefined> = process.env): GraphitiPort | undefined {
  const baseUrl = env.GRAPHITI_URL?.trim();
  if (!baseUrl) return undefined;
  return createHttpGraphiti({ baseUrl, apiKey: env.GRAPHITI_API_KEY });
}

/**
 * A node may become durable memory only if the critic was resolved AND confident.
 *
 * The confidence check is not redundant with the status/tier check.
 * `enforceCriticPolicy` deliberately returns `pass: true` below CONFIDENCE_FLOOR
 * so an unsure critic cannot force a retry loop — and `pass: true` sets both
 * `status` and `tier` to 'resolved'. Without this clause an uncertain verdict
 * reaches Graphiti, where `recallPriorContext` serves it back to a later run as
 * settled prior context.
 *
 * Let the step pass. Do not let it become memory.
 */
function promotable(node: ReflectionNode): boolean {
  return node.status === 'resolved'
    && node.tier === 'resolved'
    && Number.isFinite(node.confidence)
    && node.confidence >= CONFIDENCE_FLOOR;
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
