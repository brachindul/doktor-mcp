#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerMedicalLegalTools } from "./tools.js";
import { VERSION } from "../core/version.js";

const server = new McpServer({
  name: "doktor-mcp",
  version: VERSION
});

registerMedicalLegalTools(server);

try {
  await server.connect(new StdioServerTransport());
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
