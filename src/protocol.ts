import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';
export function pipeName() {
  const id = createHash('sha256').update(process.env.MODELTIDE_DATA_DIR || homedir()).digest('hex').slice(0, 16);
  return process.platform === 'win32' ? `\\\\.\\pipe\\modeltide-${id}` : join(process.env.MODELTIDE_DATA_DIR || homedir(), `.modeltide-${id}.sock`);
}
export function request(method: string, params: unknown = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(pipeName());
    let buffer = '';
    socket.setEncoding('utf8'); socket.setTimeout(10000);
    socket.on('connect', () => socket.write(JSON.stringify({ method, params }) + '\n'));
    socket.on('data', data => {
      buffer += data;
      const end = buffer.indexOf('\n');
      if (end < 0) return;
      socket.end();
      try { const result = JSON.parse(buffer.slice(0, end)); if (result.error) reject(new Error(result.error)); else resolve(result.result); } catch (e) { reject(e); }
    });
    socket.on('error', reject);
    socket.on('timeout', () => { socket.destroy(); reject(new Error('ModelTide 响应超时')); });
    socket.on('end', () => { if (!buffer.includes('\n')) reject(new Error('ModelTide 未返回完整响应')); });
  });
}
