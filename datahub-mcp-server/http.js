#!/usr/bin/env node
// Remote entrypoint: serves the same tools as index.js over Streamable HTTP
// instead of stdio, so it can sit behind a reverse proxy (e.g. api.datapopcorn.ai/mcp).
import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerNeisTools } from "./tools/neis.js";
import { registerGuideTools, SERVER_INSTRUCTIONS } from "./tools/guide.js";

const PORT = Number(process.env.PORT) || 3000;
const MCP_PATH = process.env.MCP_PATH || "/mcp";

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
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname !== MCP_PATH) {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not Found");
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
  console.log(`datahub-mcp-server (HTTP) listening on :${PORT}${MCP_PATH}`);
});
