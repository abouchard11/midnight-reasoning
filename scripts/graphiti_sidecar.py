#!/usr/bin/env python3
"""Production Graphiti sidecar for midnight-reasoning's HTTP GraphitiPort.

Bridges the library's operator-owned HTTP contract
    POST /episodes  { groupId, content, metadata }
    POST /search    { query, projectId, limit } -> PriorContext[]
to the real Graphiti (Neo4j + Gemini) by importing the SAME config bootstrap the
running MCP server uses — zero config drift with ~/dev/graphiti/mcp_server.

Run from inside the mcp_server project so GraphitiConfig() resolves identically:

    cd ~/dev/graphiti/mcp_server && uv run --env-file .env --extra providers \
      python /Users/sashalabbe/projects/midnight-reasoning/scripts/graphiti_sidecar.py --port 8801

Group mapping (v1, documented in references/lanes.md): every episode lands in the
stable group `reasoning-index`; the library's per-run groupId travels in metadata
as origGroup. One group keeps /search implementable over retrieve_episodes.

Fail-closed: any backend error is a non-2xx; there is no log-and-pretend path.
"""
from __future__ import annotations
import argparse, asyncio, json, sys, threading, uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

GROUP = "reasoning-index"

def token_score(query: str, hay: str) -> float:
    """Port of src/graphiti.ts tokenScore — kept behaviorally identical."""
    import re
    q = [w for w in re.split(r"\W+", query.lower()) if len(w) > 2]
    if not q: return 0.0
    h = hay.lower()
    return sum(1 for w in q if w in h) / len(q)

def to_prior(ep_content: str, query: str) -> dict | None:
    """Map a stored episode body back to a PriorContext row (pure; selftested)."""
    try:
        body = json.loads(ep_content)
    except Exception:
        return None
    md = body.get("metadata") or {}
    if not isinstance(md, dict): return None
    hay = f"{body.get('content','')} {md.get('question','')}"
    return {
        "nodeId": str(md.get("nodeId", "")),
        "question": str(md.get("question", "")),
        "projectId": str(md.get("projectId", "")),
        "resolvedAt": int(md.get("resolvedAt") or 0),
        "similarity": token_score(query, hay),
    }

def selftest() -> None:
    assert abs(token_score("uspto claims search", "the USPTO claims live in bulk datasets") - 2/3) < 1e-9
    assert token_score("uspto claims", "the USPTO claims live here") == 1.0
    assert token_score("zz", "anything") == 0.0
    p = to_prior(json.dumps({"content":"claims corpus","metadata":{"nodeId":"n1","question":"where are claims","projectId":"proj","resolvedAt":5}}), "claims corpus")
    assert p and p["nodeId"]=="n1" and p["projectId"]=="proj" and p["similarity"]>0
    assert to_prior("not json", "q") is None
    assert to_prior(json.dumps({"metadata": "oops"}), "q") is None
    print("selftest: 5/5 ok")

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8801)
    ap.add_argument("--model-override", default=None,
                    help="Force MODEL_NAME before config import (beats --env-file precedence)")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    if args.selftest:
        selftest(); return

    if args.model_override:
        import os
        os.environ["MODEL_NAME"] = args.model_override
        print(f"[sidecar] MODEL_NAME overridden -> {args.model_override}")

    # Import the running server's own bootstrap (cwd must be mcp_server root).
    sys.path.insert(0, str(Path.cwd() / "src"))
    from config.schema import GraphitiConfig            # type: ignore
    from graphiti_mcp_server import GraphitiService     # type: ignore
    from graphiti_core.nodes import EpisodeType         # type: ignore

    loop = asyncio.new_event_loop()
    threading.Thread(target=loop.run_forever, daemon=True).start()

    async def boot():
        svc = GraphitiService(GraphitiConfig())
        await svc.initialize()
        if svc.client is None:
            raise RuntimeError("GraphitiService.initialize() left client=None")
        return svc.client
    client = asyncio.run_coroutine_threadsafe(boot(), loop).result(timeout=120)
    print(f"[sidecar] Graphiti client ready; serving :{args.port}; group={GROUP}")

    async def add_episode(payload: dict) -> None:
        md = payload.get("metadata") or {}
        attempts = 0
        while True:
            attempts += 1
            try:
                return await _add_once(md, payload)
            except Exception as e:
                chain = str(e) + str(getattr(e, "__cause__", "") or getattr(e, "__context__", ""))
                if "503" in chain and attempts < 5:
                    print(f"[sidecar] 503 from model pool, retry {attempts}/4 in 20s")
                    await asyncio.sleep(20)
                    continue
                raise

    async def _add_once(md: dict, payload: dict) -> None:
        node_id = str(md.get("nodeId") or uuid.uuid4())
        run_id = str(md.get("runId") or payload.get("groupId") or "unknown")
        await client.add_episode(
            name=f"mr:{node_id}",
            episode_body=json.dumps({
                "content": payload.get("content", ""),
                "metadata": md,
                "origGroup": payload.get("groupId", ""),
            }),
            source=EpisodeType.json,
            source_description=(
                "midnight-reasoning promote() via graphiti_sidecar.py v1; "
                f"runId={run_id}; critic-gated (promotable: resolved+tier+confidence>=floor)"
            ),
            reference_time=datetime.now(timezone.utc),
            group_id=GROUP,
        )

    async def search(payload: dict) -> list[dict]:
        eps = await client.retrieve_episodes(
            reference_time=datetime.now(timezone.utc),
            last_n=60, group_ids=[GROUP],
        )
        rows = []
        for e in eps:
            p = to_prior(getattr(e, "content", "") or "", payload.get("query", ""))
            if p and p["similarity"] > 0 and p["projectId"] == payload.get("projectId"):
                rows.append(p)
        rows.sort(key=lambda r: -r["similarity"])
        return rows[: int(payload.get("limit") or 3)]

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a): pass
        def _send(self, code: int, obj) -> None:
            b = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(b)))
            self.end_headers(); self.wfile.write(b)
        def do_GET(self):
            if self.path == "/health": self._send(200, {"ok": True, "group": GROUP})
            else: self._send(404, {"error": "not found"})
        def do_POST(self):
            try:
                n = int(self.headers.get("content-length") or 0)
                payload = json.loads(self.rfile.read(n) or b"{}")
                if self.path == "/episodes":
                    asyncio.run_coroutine_threadsafe(add_episode(payload), loop).result(timeout=180)
                    self._send(200, {"ok": True})
                elif self.path == "/search":
                    out = asyncio.run_coroutine_threadsafe(search(payload), loop).result(timeout=60)
                    self._send(200, out)
                else:
                    self._send(404, {"error": "not found"})
            except Exception as e:  # fail closed, loudly
                import traceback
                causes, c = [], e
                while c is not None:
                    causes.append(f"{type(c).__name__}: {c}")
                    c = c.__cause__ or c.__context__
                    if len(causes) > 6: break
                self._send(500, {"error": " <- ".join(causes),
                                 "trace": traceback.format_exc()[-800:]})

    ThreadingHTTPServer(("127.0.0.1", args.port), H).serve_forever()

if __name__ == "__main__":
    main()
