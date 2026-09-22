import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Ctx } from './core/context.js';
import { SERVER_INSTRUCTIONS } from './instructions.js';
import { registerTools } from './tools/index.js';
import { VERSION } from './version.js';

export function createServer(ctx: Ctx): McpServer {
  const server = new McpServer({ name: 'idra-photo', version: VERSION }, { instructions: SERVER_INSTRUCTIONS });
  registerTools(server, ctx);
  return server;
}

/** stdout carries only MCP protocol traffic; every diagnostic goes to stderr. */
export async function serveStdio(ctx: Ctx): Promise<void> {
  const server = createServer(ctx);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  ctx.log(`serving workspace ${ctx.rootReal}${ctx.simulation ? ' (SIMULATION mode)' : ''}`);
}
