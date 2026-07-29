#!/usr/bin/env node
// Remote entrypoint: serves the same tools as index.js over Streamable HTTP
// instead of stdio, so it can sit behind a reverse proxy (e.g. api.datapopcorn.ai/mcp).
// Also serves a landing page at "/" that explains the server and lists its
// tools by querying itself, so the page never drifts from what's deployed.
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerNeisTools } from "./tools/neis.js";
import { registerGuideTools, SERVER_INSTRUCTIONS } from "./tools/guide.js";

const PORT = Number(process.env.PORT) || 3000;
const MCP_PATH = process.env.MCP_PATH || "/mcp";
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 60;
const MAX_RATE_LIMIT_KEYS = Number(process.env.MAX_RATE_LIMIT_KEYS) || 10_000;
const requestCounts = new Map();

const __dirname = dirname(fileURLToPath(import.meta.url));
const LANDING_PAGE = readFileSync(join(__dirname, "public", "index.html"));

function clientKey(req) {
  return req.socket.remoteAddress || "unknown";
}

function pruneRateLimitState(now) {
  for (const [key, state] of requestCounts) {
    if (now - state.startedAt >= RATE_LIMIT_WINDOW_MS) requestCounts.delete(key);
  }
}

function isRateLimited(req, now = Date.now()) {
  pruneRateLimitState(now);
  const key = clientKey(req);
  const current = requestCounts.get(key);
  const state = current || { startedAt: now, count: 0 };

  if (!current && requestCounts.size >= MAX_RATE_LIMIT_KEYS) {
    return true;
  }

  state.count += 1;
  requestCounts.set(key, state);
  return state.count > RATE_LIMIT_MAX_REQUESTS;
}

function buildServer() {
  const server = new McpServer(
    { name: "datahub-mcp-server", version: "0.1.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );
  registerGuideTools(server);
  registerNeisTools(server);
  // Add more tool modules here, same as index.js:
  // registerHaerapyTools(server);
  return server;
}

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(LANDING_PAGE);
    return;
  }

  if (url.pathname !== MCP_PATH) {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not Found");
    return;
  }

  if (isRateLimited(req)) {
    res.writeHead(429, {
      "Content-Type": "application/json",
      "Retry-After": String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1_000)),
    });
    res.end(JSON.stringify({ error: "rate_limited" }));
    return;
  }

  // Stateless mode: no shared session between requests, so build a fresh
  // server + transport per request. Tools here are read-only API proxies,
  // so there's no state worth keeping across calls.
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (err) {
    console.error("MCP request failed:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
    }
  }
});

httpServer.listen(PORT, () => {
  console.log(`datahub-mcp-server (HTTP) listening on :${PORT} (landing: /, mcp: ${MCP_PATH})`);
});
