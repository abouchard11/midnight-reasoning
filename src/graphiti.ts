import type { ReflectionNode, PriorContext } from './types.js';

/**
 * Promote resolved reflection nodes from a sidecar into Graphiti.
 * group_id convention: reasoning:<runId>
 *
 * This function is a HUMAN/POLICY-closed action.
 * The model drafts nodes. It does not call promote() autonomously.
 *
 * Replace the stub implementations below with your actual Graphiti client.
 */
export async function promoteToGraphiti(
  nodes: ReflectionNode[],
  runId: string
): Promise<void> {
  const resolved = nodes.filter((n) => n.status === 'resolved' && n.tier === 'resolved');
  if (resolved.length === 0) return;

  const groupId = `reasoning:${runId}`;

  for (const node of resolved) {
    // TODO: replace with your Graphiti client call
    // await graphitiClient.add_memory({
    //   content: node.critique,
    //   metadata: {
    //     question: node.question,
    //     stepId: node.stepId,
    //     projectId: node.projectId,
    //     resolvedAt: node.resolvedAt,
    //   },
    //   group_id: groupId,
    // });
    console.log(`[graphiti] promote node ${node.id} → group_id: ${groupId}`);
  }
}

/**
 * Recall the top N open questions from past runs on the same project.
 * Used at run start to inject prior context into the first planning step.
 *
 * Returns nodes ordered by semantic similarity to the current run's goal.
 */
export async function recallPriorContext(
  goalText: string,
  projectId: string,
  topN = 3
): Promise<PriorContext[]> {
  // TODO: replace with your Graphiti semantic search
  // const results = await graphitiClient.search({
  //   query: goalText,
  //   group_ids: [`reasoning:*`],  // or filter by projectId in metadata
  //   limit: topN,
  // });
  // return results.map(r => ({ ...r.metadata, similarity: r.score }));

  console.log(`[graphiti] recall prior context for project: ${projectId}`);
  return [];
}
