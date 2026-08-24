import { randomUUID } from 'node:crypto';
import { initSidecar, appendNode, closeSidecar, discardSidecar, readSidecar } from './sidecar.js';
import { runCriticPass } from './reflect.js';
import { promoteToGraphiti, recallPriorContext } from './graphiti.js';
import type {
  ReasoningGraphOptions,
  ReflectOptions,
  ReflectionNode,
  PriorContext,
  SidecarGraph,
  CriticFn,
  GraphitiPort,
} from './types.js';

export class ReasoningGraph {
  private runId: string;
  private projectId: string;
  private goal: string;
  private doneMeans: string;
  private scratchDir: string;
  private critic?: CriticFn;
  private graphiti?: GraphitiPort;

  constructor(opts: ReasoningGraphOptions) {
    this.runId = opts.runId;
    this.projectId = opts.projectId;
    this.goal = opts.goal;
    this.doneMeans = opts.doneMeans;
    this.scratchDir = opts.scratchDir ?? '.scratch';
    this.critic = opts.critic;
    this.graphiti = opts.graphiti;

    initSidecar(
      { runId: this.runId, projectId: this.projectId, goal: this.goal, doneMeans: this.doneMeans },
      this.scratchDir
    );
  }

  /**
   * Recall up to 3 open questions from past runs on the same project.
   * Call at run start. Inject returned context into first planning step.
   * Empty when no GraphitiPort is injected.
   */
  async recallPrior(topN = 3): Promise<PriorContext[]> {
    return recallPriorContext(this.goal, this.projectId, topN, this.graphiti);
  }

  /**
   * Run a critic pass on a completed step.
   * Returns { revised: true } if the step should retry.
   * The caller is responsible for incrementing step.attempt and re-dispatching.
   * The model does NOT auto-close any gate or irreversible edge.
   */
  async reflect(
    opts: Omit<ReflectOptions, 'runOutcome' | 'runDoneMeans'> & { criticModel: string }
  ): Promise<{ revised: boolean; critique: string; nodeId: string }> {
    const maxAttempts = opts.maxAttempts ?? 3;

    if (opts.stepAttempt >= maxAttempts) {
      return {
        revised: false,
        critique: `Max attempts (${maxAttempts}) reached. Surfacing to human.`,
        nodeId: '',
      };
    }

    const criticResult = await runCriticPass(
      {
        ...opts,
        runOutcome: this.goal,
        runDoneMeans: this.doneMeans,
      },
      this.critic
    );

    const node: ReflectionNode = {
      id: randomUUID(),
      runId: this.runId,
      projectId: this.projectId,
      stepId: opts.stepId,
      stepAttempt: opts.stepAttempt,
      question: opts.stepVerifier,
      critique: criticResult.critique,
      confidence: criticResult.confidence,
      revised: !criticResult.pass,
      status: criticResult.pass ? 'resolved' : 'open',
      tier: criticResult.pass ? 'resolved' : 'observed',
      createdAt: Date.now(),
      resolvedAt: criticResult.pass ? Date.now() : undefined,
    };

    appendNode(this.runId, node, this.scratchDir);

    return {
      revised: !criticResult.pass,
      critique: criticResult.critique,
      nodeId: node.id,
    };
  }

  /**
   * Promote resolved nodes to Graphiti and delete the sidecar.
   * HUMAN/POLICY-closed action. Do not call autonomously.
   * Throws if no GraphitiPort was injected — sidecar stays on disk.
   */
  async promote(): Promise<void> {
    const graph = readSidecar(this.runId, this.scratchDir);
    if (!graph) return;
    if (!this.graphiti) {
      throw new Error(
        'promote() requires an injected GraphitiPort; sidecar left in place'
      );
    }
    await promoteToGraphiti(graph.nodes, this.runId, this.graphiti);
    closeSidecar(this.runId, 'shipped', this.scratchDir);
    discardSidecar(this.runId, this.scratchDir);
  }

  /**
   * Discard the sidecar. Nothing persists. Use on escaped/stopped runs.
   */
  async discard(): Promise<void> {
    closeSidecar(this.runId, 'escaped', this.scratchDir);
    discardSidecar(this.runId, this.scratchDir);
  }

  /**
   * Read the current sidecar state (for inspection/debugging).
   */
  snapshot(): SidecarGraph | null {
    return readSidecar(this.runId, this.scratchDir);
  }
}
