/**
 * Shared confidence policy.
 *
 * One threshold, two independent decisions — keep them from drifting apart:
 *
 *   1. May the STEP proceed?   `enforceCriticPolicy` (reflect.ts)
 *      Below the floor the step is allowed through, deliberately. A critic that
 *      is unsure must not force a retry loop. Fail-open is correct here.
 *
 *   2. May it become MEMORY?   `promotable` (graphiti.ts)
 *      Below the floor the node must NOT reach Graphiti. Promoted nodes are
 *      re-injected into future runs by `recallPriorContext`, so an uncertain
 *      verdict that persists becomes prior context the next run treats as
 *      settled. Fail-closed is correct here.
 *
 * These are different edges with different reversibility. Before this constant
 * existed they shared one boolean, and `pass: true` on a low-confidence critique
 * set both `status` and `tier` to 'resolved' — which satisfied `promotable()`.
 * Uncertainty was laundered into durable memory.
 */
export const CONFIDENCE_FLOOR = 0.6;
