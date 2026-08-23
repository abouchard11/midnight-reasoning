# midnight-reasoning — Agent Rules

- Load `SKILL.md` before reasoning about reflection or critic passes.
- The model may call `reflect()`. The model may NOT call `promote()` or `persist()`.
- All sidecar writes go to `.scratch/`. Never commit `.scratch/` to the repo.
- Critic confidence below 0.6 is a pass. Do not force retries on uncertain critiques.
- Max 3 reflect attempts per step. Surface to human on `noProgressStreak >= 2`.
- Graphiti `group_id` convention: `reasoning:<runId>`. Do not invent other group prefixes.
