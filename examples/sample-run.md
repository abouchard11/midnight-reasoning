# Sample Run Walkthrough

This annotates how `midnight-reasoning` behaves during a real `dozen` caption run.

## Run: `run_demo_001`

**Goal:** Draft and verify one TikTok caption for creator @surfgirl92  
**Done means:** Caption passes FTC disclosure check and brand voice lint  
**Project:** dozen

---

## Step 1 — `step_draft` (attempt 1)

The `engineer` agent drafts a caption. Evidence produced:

> "Obsessed with this reef-safe sunscreen 🌊 Shop the link in bio!"

`rg.reflect()` is called. The critic model evaluates against the verifier:
> "Does the caption include a visible FTC disclosure?"

**Critic response:**
```json
{ "pass": false, "critique": "Caption is missing #ad disclosure. Add '#ad' or '#sponsored' before the CTA.", "confidence": 0.91 }
```

`revised: true` → `step.attempt` incremented to 2. Critique appended to `run.logs`.
Reflection node `node_a1b2c3` written to sidecar with `status: open`, `tier: observed`.

---

## Step 1 — `step_draft` (attempt 2)

Agent re-drafts with the critique injected:

> "Obsessed with this reef-safe sunscreen 🌊 #ad Shop the link in bio!"

`rg.reflect()` called again.

**Critic response:**
```json
{ "pass": true, "critique": "Verifier satisfied.", "confidence": 0.95 }
```

`revised: false` → node `node_d4e5f6` written with `status: resolved`, `tier: resolved`, `resolvedAt` set.

Step continues to `verify` node.

---

## Run end — `shipped`

`rg.promote()` called (by script/human, NOT by model):
- `node_a1b2c3` is `observed` → skipped
- `node_d4e5f6` is `resolved` → promoted to Graphiti under `group_id: reasoning:run_demo_001`

Sidecar deleted. Nothing else persists.

---

## Next run on `dozen` project

`rg.recallPrior()` queries Graphiti for past resolved nodes on `projectId: dozen`.  
If a semantically similar question is found (e.g. FTC disclosure came up before), it surfaces as pre-context for the first planning step — so the agent starts knowing this is a known failure mode.
