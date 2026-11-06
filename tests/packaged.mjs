import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createConnection } from 'node:net';
import { _electron as electron } from 'playwright';
const appRoot = resolve(process.env.MODELTIDE_PACKAGED_ROOT || 'release/win-unpacked');
const testRoot = resolve('tests/tmp/packaged');
await mkdir(join(testRoot, 'data'), { recursive: true });
await mkdir(join(testRoot, 'codex/sessions'), { recursive: true });
const env = { ...process.env, PATH: '', MODELTIDE_DATA_DIR: join(testRoot, 'data'), MODELTIDE_CODEX_DIR: join(testRoot, 'codex'), MODELTIDE_TEST_STANDALONE: '1' };
delete env.MODELTIDE_NODE_PATH; delete env.ELECTRON_RUN_AS_NODE;
const pipe = '\\\\.\\pipe\\modeltide-' + createHash('sha256').update(env.MODELTIDE_DATA_DIR).digest('hex').slice(0, 16);
function request(method) { return new Promise((resolve, reject) => {
  const socket = createConnection(pipe); let data = '';
  socket.setEncoding('utf8'); socket.setTimeout(5000, () => { socket.destroy(); reject(Error('timeout')); });
  socket.on('error', reject); socket.on('connect', () => socket.write(JSON.stringify({ method }) + '\n'));
  socket.on('data', chunk => { data += chunk; if (!data.includes('\n')) return; socket.end(); const reply = JSON.parse(data); reply.error ? reject(Error(reply.error)) : resolve(reply.result); });
}); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) { for (let i = 0; i < 60; i++) { try { const value = await fn(); if (value) return value; } catch {} await sleep(250); } throw Error('Packaged app timed out'); }
const widget = spawn(join(appRoot, 'ModelTide.exe'), [], { env, windowsHide: true, stdio: 'ignore' });
let details, collector;
try {
  collector = (await until(() => request('health'))).pid;
  details = await electron.launch({ executablePath: join(appRoot, 'ModelTide-Details.exe'), env, timeout: 30000 });
  const page = await details.firstWindow();
  await page.getByRole('heading', { name: 'ModelTide.' }).waitFor();
  assert.ok(await page.getByAltText('ModelTide 托腮龙娘 Logo').evaluate(img => img.complete && img.naturalWidth === 256));
  const closed = details.waitForEvent('close');
  await page.keyboard.press('Escape').catch(error => { if (!String(error).includes('closed')) throw error; });
  await closed; details = null;
  await request('quit');
  await until(() => widget.exitCode !== null);
  await until(() => { try { process.kill(collector, 0); return false; } catch { return true; } });
  await writeFile(join(testRoot, 'report.json'), JSON.stringify({ passed: true, emptyPath: true, bundledNode: true, packagedDetailAndLogo: true, cleanExit: true }, null, 2));
  console.log('PASS: packaged app works with empty PATH, bundled Node, detail/logo and clean exit.');
} finally {
  await details?.close(); await request('quit').catch(() => {});
  if (widget.exitCode === null) widget.kill();
}
