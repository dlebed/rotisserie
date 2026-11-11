import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { startHostLoop } from '../server/host';
import { createTools } from './tools';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const host = startHostLoop();
const tools = createTools(projectDir, { ready: () => host.ready() });

const server = new McpServer({ name: 'rotisserie', version: '0.1.0' });
for (const [name, t] of Object.entries(tools)) {
  server.registerTool(name, { description: t.description, inputSchema: t.schema }, async (args: unknown) => {
    try {
      const result = await t.handler(args);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result ?? null, null, 2) }] };
    } catch (e) {
      return { isError: true, content: [{ type: 'text' as const, text: (e as Error).message }] };
    }
  });
}

await server.connect(new StdioServerTransport());
let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  void host.stop().finally(() => process.exit(0));
};
process.stdin.on('end', shutdown);
process.stdin.on('close', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
