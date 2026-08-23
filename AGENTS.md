# midnight-reasoning — Agent Rules

- Load `SKILL.md` before reasoning about reflection or critic passes.
- The model may call `reflect()`. The model may NOT call `promote()` or `persist()`.
- All sidecar writes go to `.scratch/`. Never commit `.scratch/` to the repo.
- Critic confidence below 0.6 is a pass. Do not force retries on uncertain critiques.
- Max 3 reflect attempts per step. Surface to human on `noProgressStreak >= 2`.
- Graphiti `group_id` convention: `reasoning:<runId>`. Do not invent other group prefixes.

## Retrospective

After every invocation, follow the **Retrospective** section at the bottom of `SKILL.md`.
Draft an observed note only when one of the four trigger conditions is met.
Never edit this skill, any graph JSON, or shared types from a retrospective.
Never call promote / persist / remember on a retro note.
