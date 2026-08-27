# KNOWN GAPS — what the 2026-08-27 production promote did and did not prove

**Proven:** the promotion gate. 23/23 tests, mutation-verified confidence floor, fail-closed
polarity on the garbage path, and one real node through the full path: scratch → critic →
`promotable()` → sidecar → durable Graphiti episode (`7e37c5cb`, group `reasoning-index`) →
recall at similarity 1.0.

**Not proven — in order of danger:**

1. **Contradiction reconciliation (multi-agent).** All exercise so far is single-writer.
   Two agents resolving the same question differently both clear the gate independently and
   both persist; a later run can be served conflicting "settled" priors. `promotable()` gates
   per-node confidence; nothing gates cross-node coherence. Falsification test to write:
   promote two conflicting resolutions of one question, run `recallPrior`, document that both
   return. Then design the reconciliation (supersede-by-recency? flag-conflict-to-human?
   quorum re-adjudication?). The model must not own the reconciliation either.
2. **Group isolation collapsed in the v1 sidecar.** `scripts/graphiti_sidecar.py` remaps all
   per-run groups into one `reasoning-index` group; project isolation rests on a metadata
   filter, not Graphiti group_id isolation. Reversible: pass-through grouping + group-scoped
   search. Until then, "multiple seeded graph memory" is not what v1 provides.
3. **Recall is lexical over a 60-episode window** (`retrieve_episodes` + token overlap), not
   Graphiti hybrid search. Older resolved questions silently exit the window. Real recall
   needs the hybrid path (embeddings + BM25 + graph) with the metadata round-trip preserved.
4. TTL (30-day) specified in `references/lanes.md`, implemented nowhere.
5. No run has yet **consumed** recalled prior context in a live task; the 1.0 recall was a
   verification query. First consuming run is the remaining integration proof.

IP note: the sealed-edge claim covers the gate mechanism (proven). Any claim reciting
multi-agent promotion currently lacks written-description support — single-writer only.
