#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerNeisTools } from "./tools/neis.js";

const server = new McpServer({ name: "datahub-mcp-server", version: "0.1.0" });

registerNeisTools(server);
// Add more tool modules here as new data sources come online, e.g.:
// import { registerHaerapyTools } from "./tools/haerapy.js";
// registerHaerapyTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
