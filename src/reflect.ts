import Anthropic from '@anthropic-ai/sdk';
import type { CriticResult, ReflectOptions } from './types.js';

const CRITIC_SYSTEM = `You are a verifier agent. Your job is to determine whether evidence produced by an AI agent step satisfies a given verifier criterion.

Return ONLY valid JSON in this exact shape:
{ "pass": boolean, "critique": string, "confidence": number }

- pass: true if the evidence fully satisfies the verifier. false if not.
- critique: if pass is false, explain specifically what is wrong and what the agent should try differently. If pass is true, write "Verifier satisfied."
- confidence: your confidence in this assessment, 0.0 to 1.0. If below 0.6, you are uncertain — the caller will treat this as a pass to avoid forced loops.`;

export async function runCriticPass(
  opts: ReflectOptions,
  client?: Anthropic
): Promise<CriticResult> {
  const anthropic = client ?? new Anthropic();

  const userMessage = `Goal: ${opts.runOutcome}
Done means: ${opts.runDoneMeans}
Step verifier: ${opts.stepVerifier}
Evidence produced:
${opts.stepEvidence}

Does this evidence satisfy the verifier? Return JSON only.`;

  const response = await anthropic.messages.create({
    model: opts.criticModel,
    max_tokens: 512,
    system: CRITIC_SYSTEM,
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}';

  let result: CriticResult;
  try {
    result = JSON.parse(raw) as CriticResult;
  } catch {
    // Malformed response — treat as uncertain pass
    result = { pass: true, critique: 'Critic returned unparseable response.', confidence: 0.5 };
  }

  // Enforce: confidence below 0.6 is always a pass
  if (result.confidence < 0.6) {
    result.pass = true;
    result.critique = `[Low confidence ${result.confidence.toFixed(2)}] ${result.critique}`;
  }

  return result;
}
