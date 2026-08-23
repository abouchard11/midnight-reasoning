export type ReflectionStatus = 'open' | 'resolved' | 'expired' | 'discarded';

export type ReflectionTier = 'observed' | 'verified' | 'resolved';

export type ReflectionNode = {
  id: string;                    // uuid
  runId: string;
  projectId: string;
  stepId: string;
  stepAttempt: number;
  question: string;              // what the critic asked
  critique: string;              // full critic output
  confidence: number;            // 0–1, critic self-reported
  revised: boolean;              // did this trigger a retry?
  status: ReflectionStatus;
  tier: ReflectionTier;
  createdAt: number;             // unix ms
  resolvedAt?: number;
};

export type SidecarGraph = {
  version: '1';
  runId: string;
  projectId: string;
  goal: string;
  doneMeans: string;
  nodes: ReflectionNode[];
  createdAt: number;
  closedAt?: number;
  closeReason?: 'shipped' | 'escaped' | 'stopped';
};

export type CriticResult = {
  pass: boolean;
  critique: string;
  confidence: number;            // 0–1
};

export type PriorContext = {
  nodeId: string;
  question: string;
  projectId: string;
  resolvedAt: number;
  similarity: number;            // cosine, 0–1
};

export type ReflectOptions = {
  stepId: string;
  stepAttempt: number;
  stepVerifier: string;
  stepEvidence: string;
  runOutcome: string;
  runDoneMeans: string;
  criticModel: string;           // e.g. 'claude-sonnet-4-5'
  maxAttempts?: number;          // default 3
};

export type ReasoningGraphOptions = {
  runId: string;
  projectId: string;
  goal: string;
  doneMeans: string;
  scratchDir?: string;           // default '.scratch'
};
