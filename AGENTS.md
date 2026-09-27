# midnight-reasoning — Agent Rules

- Load `SKILL.md` before reasoning about reflection or critic passes.
- The model may call `reflect()`. The model may NOT call `promote()` or `persist()`.
- All sidecar writes go to `.scratch/`. Never commit `.scratch/` to the repo.
- Critic confidence below 0.6 is a pass for the current step, but it is below the promotion floor and must not become durable memory.
- Max 3 reflect attempts per step. The caller owns `noProgressStreak`; surface to human at 2.
- The library-facing Graphiti `group_id` convention is `reasoning:<runId>`. The production v1 adapter is the one documented exception: it remaps into `reasoning-index` and preserves the original group in metadata. Do not invent additional prefixes.

## Retrospective

After every invocation, follow the **Retrospective** section at the bottom of `SKILL.md`.
Draft an observed note only when one of the four trigger conditions is met.
Never edit this skill, any graph JSON, or shared types from a retrospective.
Never call promote / persist / remember on a retro note.
