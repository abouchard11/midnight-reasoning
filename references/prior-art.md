# Prior Art — PRefLexOR and Graph-PRefLexOR

## PRefLexOR

Buehler, M.J. (2024). *PRefLexOR: Preference-based Recursive Language Modeling for Exploratory Optimization of Reasoning and Agentic Thinking.*  
https://arxiv.org/abs/2410.12375

Key concepts borrowed:
- **Thinking tokens** (`<|thinking|>`, `<|reflect|>`): explicit markers for reflective reasoning phases. In `midnight-reasoning`, the critic model's structured JSON response is the equivalent.
- **Critic model pass**: a general-purpose model critiques the reasoning model's output. Here: Sonnet or Gemini Flash evaluates step evidence against `doneMeans`.
- **Recursive refinement**: if the critique finds a flaw, the agent re-drafts. Max attempts enforced by `loop.maxAttempts`.
- **Dynamic knowledge graph**: questions generated from run evidence become nodes in a growing graph. Here: Graphiti `reasoning:*` episodes.

## Graph-PRefLexOR / Agentic Deep Graph Reasoning

Buehler, M.J. (2025). *In-situ graph reasoning and knowledge expansion using Graph-PRefLexOR.*  
https://arxiv.org/abs/2501.08120

Buehler, M.J. (2025). *Agentic Deep Graph Reasoning Yields Self-Organizing Knowledge Networks.*  
https://arxiv.org/abs/2502.13025

Key concept: the graph is not a product graph. It is an epistemological graph — nodes are what the system knows, is uncertain about, and wants to explore. This distinction is why `midnight-reasoning` is a separate repo from `agentic-graph-orchestration`.

## What we did NOT adopt

- ORPO / DPO / EXO fine-tuning: requires open-weight model training infrastructure. Not compatible with Claude/Gemini API-only stack.
- Pre-generated preference datasets: PRefLexOR generates these dynamically during training. We achieve similar behavior through critic-driven retries at inference time.
- Flash attention / LoRA: model weight concerns. Not applicable.
