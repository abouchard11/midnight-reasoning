#!/usr/bin/env node
/**
 * In-memory Graphiti sidecar for local dry-runs.
 *
 * Implements the GraphitiPort HTTP contract from createHttpGraphiti:
 *   POST /episodes  { groupId, content, metadata }
 *   POST /search    { query, projectId, limit } → PriorContext[]
 *
 * Not durable. Not Zep. Not a promote closer for the model.
 *   GRAPHITI_URL=http://127.0.0.1:8787
 */
import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 8787);
const episodes = [];

function tokens(s) {
  return String(s).toLowerCase().split(/\W+/).filter((w) => w.length > 2);
}

function score(query, hay) {
  const q = tokens(query);
  if (!q.length) return 0;
  const h = hay.toLowerCase();
  return q.filter((w) => h.includes(w)).length / q.length;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(json);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/episodes") {
      const body = await readBody(req);
      if (!body?.groupId || typeof body.content !== "string") {
        send(res, 400, { error: "groupId and content required" });
        return;
      }
      episodes.push({ ...body, createdAt: Date.now() });
      send(res, 200, { ok: true });
      return;
    }
    if (req.method === "POST" && req.url === "/search") {
      const body = await readBody(req);
      const projectId = String(body.projectId ?? "");
      const query = String(body.query ?? "");
      const limit = Math.min(Number(body.limit ?? 3) || 3, 10);
      const hits = episodes
        .filter((e) => e.metadata?.projectId === projectId)
        .map((e) => ({
          nodeId: String(e.metadata?.nodeId ?? ""),
          question: String(e.metadata?.question ?? ""),
          projectId,
          resolvedAt: Number(e.metadata?.resolvedAt ?? 0),
          similarity: score(query, `${e.content} ${e.metadata?.question ?? ""}`),
        }))
        .filter((p) => p.similarity > 0)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
      send(res, 200, hits);
      return;
    }
    send(res, 404, { error: "not found" });
  } catch (err) {
    send(res, 400, { error: err instanceof Error ? err.message : "bad request" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.error(`graphiti sidecar (memory) on http://127.0.0.1:${PORT}`);
});
