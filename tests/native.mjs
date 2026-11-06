import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createConnection } from 'node:net';
const root = resolve('tests/tmp/native');
await mkdir(join(root, 'data'), { recursive: true });
await mkdir(join(root, 'codex/sessions'), { recursive: true });
const settingsPath = join(root, 'data/settings.json');
const settings = { followCodex: true, launchAtLogin: false, alwaysOnTop: true, timezone: 'America/Los_Angeles', offset: null };
await writeFile(settingsPath, JSON.stringify(settings));
const env = { ...process.env, MODELTIDE_DATA_DIR: join(root, 'data'), MODELTIDE_CODEX_DIR: join(root, 'codex'), MODELTIDE_TEST_STANDALONE: '1' };
const pipe = '\\\\.\\pipe\\modeltide-' + createHash('sha256').update(env.MODELTIDE_DATA_DIR).digest('hex').slice(0, 16);
function request(method, params = {}) { return new Promise((resolve, reject) => {
  const socket = createConnection(pipe); let input = '';
  socket.setEncoding('utf8'); socket.setTimeout(4000, () => { socket.destroy(); reject(Error('timeout')); });
  socket.on('error', reject); socket.on('connect', () => socket.write(JSON.stringify({ method, params }) + '\n'));
  socket.on('data', data => { input += data; if (!input.includes('\n')) return; socket.end(); const reply = JSON.parse(input); reply.error ? reject(Error(reply.error)) : resolve(reply.result); });
}); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, timeout = 15000) { const end = Date.now() + timeout; while (Date.now() < end) { try { const result = await fn(); if (result) return result; } catch {} await sleep(250); } throw Error('Condition timed out'); }
const watcher = spawn(resolve('release/win-unpacked/ModelTide-Watcher.exe'), [], { env, windowsHide: true, stdio: 'ignore' });
try {
  const health = await until(() => request('health'));
  assert.ok(health.pid, 'watcher starts widget and collector when Codex is present');
  await writeFile(settingsPath, '{'); await sleep(2500);
  assert.equal(watcher.exitCode, null, 'watcher survives a partially written setting');
  await writeFile(settingsPath, JSON.stringify(settings));
  assert.equal((await request('state')).settings.language, 'zh-CN', 'legacy settings migrate to Chinese');
  assert.equal((await request('state')).settings.onlyInCodex, true, 'legacy settings retain Codex-only visibility');
  await request('settings', { onlyInCodex: false });
  assert.equal((await request('state')).settings.onlyInCodex, false);
  assert.equal(JSON.parse(await readFile(settingsPath, 'utf8')).onlyInCodex, false);
  await request('settings', { timezone: 'Asia/Shanghai', language: 'en', alwaysOnTop: false });
  assert.equal((await request('state')).settings.timezone, 'Asia/Shanghai');
  assert.equal((await request('state')).settings.alwaysOnTop, false);
  assert.equal((await request('state')).settings.language, 'en');
  assert.match((await request('snapshot')).usage.coverage.message, /Local records/);
  assert.equal(JSON.parse(await readFile(settingsPath, 'utf8')).language, 'en');
  await assert.rejects(() => request('settings', { language: 'invalid' }), /Unsupported interface language/);
  await request('reset');
  assert.equal(JSON.parse(await readFile(settingsPath, 'utf8')).offset, null);
  await request('quit');
  await until(async () => { try { process.kill(health.pid, 0); return false; } catch { return true; } });
  await sleep(4500);
  await assert.rejects(() => request('health'), 'manual quit must not immediately respawn the widget');
  assert.equal(watcher.exitCode, null);
  await writeFile(settingsPath, JSON.stringify({ ...settings, followCodex: false }));
  await until(() => watcher.exitCode !== null);
  assert.equal(watcher.exitCode, 0);
  const result = { passed: true, watcherStartsWidget: true, partialSettingsSurvived: true, manualQuitDoesNotRespawn: true, disableStopsWatcher: true, collectorExitsWithOwner: true };
  await writeFile(join(root, 'report.json'), JSON.stringify(result, null, 2));
  console.log(result);
} finally {
  await writeFile(settingsPath, JSON.stringify({ ...settings, followCodex: false }));
  await request('quit').catch(() => {});
  if (watcher.exitCode === null) watcher.kill();
}
