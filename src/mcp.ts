import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { request } from './protocol';
const server = new McpServer({ name: 'modeltide', version: '0.1.0' });
const schema = { range: z.enum(['today', '7d', '30d', 'month', 'custom']).optional(), start: z.string().optional(), end: z.string().optional(), timezone: z.string().optional(), model: z.string().optional() };
const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
async function call(method: string, params: unknown, summaryOnly = false) {
  try {
    let data = await request(method, params);
    if (summaryOnly) { const { models, buckets, availableModels, ...summary } = data; data = summary; }
    return { content: [{ type: 'text' as const, text: JSON.stringify(data) }], structuredContent: data };
  } catch (e: any) {
    const message = e.code === 'ENOENT' || e.code === 'ECONNREFUSED' ? '请先运行 ModelTide.exe，再查询本机用量。' : e.message;
    return { isError: true, content: [{ type: 'text' as const, text: message }] };
  }
}
server.registerTool('get_usage_summary', { description: '查询本机保留的 Codex Token 用量汇总。缓存属于输入，推理属于输出；不是账单或套餐余额。', inputSchema: schema, annotations }, args => call('query', args, true));
server.registerTool('get_usage_breakdown', { description: '按模型和时间展示本机 Codex 用量、覆盖范围与缺失记录。支持 today/7d/30d/month/custom。', inputSchema: schema, annotations }, args => call('query', args));
server.registerTool('open_usage_widget', { description: '展开正在运行的 ModelTide 本地用量面板。', inputSchema: {}, annotations: { ...annotations, readOnlyHint: false } }, () => call('open', {}));
server.connect(new StdioServerTransport()).catch(e => { console.error(e); process.exitCode = 1; });
