import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createConnection } from 'node:net';
const root = resolve('tests/tmp/native');
await mkdir(join(root, 'data'), { recursive: true });
await mkdir(join(root, 'codex/sessions'), { recursive: true });
for (const name of ['usage.sqlite', 'usage.sqlite-wal', 'usage.sqlite-shm']) {
  await unlink(join(root, 'data', name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
await writeFile(join(root, 'codex/sessions/lifecycle.jsonl'), [
  { type: 'session_meta', timestamp: new Date().toISOString(), payload: { id: 'lifecycle' } },
  { type: 'turn_context', payload: { model: 'synthetic' } },
  { type: 'event_msg', timestamp: new Date().toISOString(), payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 100, output_tokens: 20 }, last_token_usage: { input_tokens: 100, output_tokens: 20 } } } }
].map(JSON.stringify).join('\n') + '\n');
const settingsPath = join(root, 'data/settings.json');
const settings = { followCodex: true, launchAtLogin: false, alwaysOnTop: true, timezone: 'America/Los_Angeles', offset: null };
await writeFile(settingsPath, JSON.stringify(settings));
const stub = join(root, 'CodexStub.exe');
execFileSync('C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe', ['/nologo', '/target:winexe', `/out:${stub}`, resolve('tests/CodexStub.cs')]);
const env = { ...process.env, MODELTIDE_DATA_DIR: join(root, 'data'), MODELTIDE_CODEX_DIR: join(root, 'codex'), MODELTIDE_TEST_STANDALONE: '1', MODELTIDE_TEST_CODEX_EXE: stub };
const pipe = '\\\\.\\pipe\\modeltide-' + createHash('sha256').update(env.MODELTIDE_DATA_DIR).digest('hex').slice(0, 16);
function request(method, params = {}) { return new Promise((resolve, reject) => {
  const socket = createConnection(pipe); let input = '';
  socket.setEncoding('utf8'); socket.setTimeout(4000, () => { socket.destroy(); reject(Error('timeout')); });
  socket.on('error', reject); socket.on('connect', () => socket.write(JSON.stringify({ method, params }) + '\n'));
  socket.on('data', data => { input += data; if (!input.includes('\n')) return; socket.end(); const reply = JSON.parse(input); reply.error ? reject(Error(reply.error)) : resolve(reply.result); });
}); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, timeout = 15000) { const end = Date.now() + timeout; while (Date.now() < end) { try { const result = await fn(); if (result) return result; } catch {} await sleep(250); } throw Error('Condition timed out'); }
const children = [];
const launch = (exe, args = []) => { const child = spawn(exe, args, { env, windowsHide: true, stdio: 'ignore' }); children.push(child); return child; };
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const stopped = async health => until(() => !alive(health.pid) && !alive(health.ownerPid));
const watcher = spawn(resolve('release/win-unpacked/ModelTide-Watcher.exe'), [], { env, windowsHide: true, stdio: 'ignore' });
try {
  await sleep(2500);
  await assert.rejects(() => request('health'), 'no widget or collector while Codex is absent');
  let codex = launch(stub);
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
  await assert.rejects(() => request('shutdown', { ownerPid: -1 }), 'unrelated caller cannot shut down the collector');
  const second = launch(stub);
  codex.kill(); await until(() => !alive(codex.pid)); await sleep(4500);
  assert.equal((await request('health')).pid, health.pid, 'another Codex instance keeps the session alive');
  second.kill(); await stopped(health);
  assert.equal(watcher.exitCode, null, 'only watcher survives closing the last Codex instance');
  const idleMemory = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-Process -Id ${watcher.pid} | Select-Object WorkingSet64,PrivateMemorySize64 | ConvertTo-Json -Compress`], { encoding: 'utf8', windowsHide: true }));
  // Reopen and close with the Electron detail process running.
  codex = launch(stub);
  const reopened = await until(() => request('health'));
  assert.notEqual(reopened.pid, health.pid);
  assert.equal((await request('query')).summary.total, 120, 'usage survives shutdown and restart without duplication');
  await request('open');
  const detailPid = await until(() => {
    const value = execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "ParentProcessId=${reopened.ownerPid}" | Where-Object Name -eq 'ModelTide-Details.exe' | Select-Object -ExpandProperty ProcessId`], { encoding: 'utf8', windowsHide: true }).trim();
    return value && Number(value);
  });
  codex.kill(); await stopped(reopened); await until(() => !alive(detailPid));
  codex = launch(stub);
  const restarted = await until(() => request('health'));
  await request('quit');
  await stopped(restarted);
  await until(async () => { try { process.kill(restarted.pid, 0); return false; } catch { return true; } });
  await sleep(4500);
  await assert.rejects(() => request('health'), 'manual quit must not immediately respawn the widget');
  assert.equal(watcher.exitCode, null);
  codex.kill(); await until(() => !alive(codex.pid)); await sleep(2500);
  codex = launch(stub);
  const next = await until(() => request('health'));
  // Reopen immediately after one detector interval; old and new owners must not share a collector.
  codex.kill(); await until(() => !alive(codex.pid)); await sleep(2100);
  codex = launch(stub);
  const rapid = await until(async () => { const h = await request('health'); return h.pid !== next.pid && h; });
  await sleep(3000);
  assert.equal((await request('health')).pid, rapid.pid, 'restart collector remains alive after the old owner exits');
  // Updating must stop the watcher without relaunching anything.
  const signal = launch(stub, ['--event', 'Local\\' + pipe.split('\\').at(-1) + '-updating']);
  await stopped(rapid); await until(() => watcher.exitCode !== null);
  await until(() => signal.exitCode !== null);
  // Starting the widget manually restores a saved follow preference.
  const manual = launch(resolve('release/win-unpacked/ModelTide.exe'));
  const manualHealth = await until(() => request('health'));
  assert.equal(manualHealth.ownerPid, manual.pid);
  const restoredWatcher = await until(() => {
    const value = execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "ParentProcessId=${manual.pid}" | Where-Object Name -eq 'ModelTide-Watcher.exe' | Select-Object -ExpandProperty ProcessId`], { encoding: 'utf8', windowsHide: true }).trim();
    return value && Number(value);
  });
  codex.kill(); await stopped(manualHealth);
  await writeFile(settingsPath, JSON.stringify({ ...settings, followCodex: false }));
  await until(() => !alive(restoredWatcher));
  assert.equal(watcher.exitCode, 0);
  const result = { passed: true, idleMemory, codexExitStopsAll: true, multipleInstances: true, hiddenProcessStaysAlive: true, reopenAndRapidRestart: true, updateStopsWatcher: true, savedPreferenceRestoresWatcher: true, watcherStartsWidget: true, partialSettingsSurvived: true, manualQuitDoesNotRespawn: true, disableStopsWatcher: true, collectorExitsWithOwner: true };
  await writeFile(join(root, 'report.json'), JSON.stringify(result, null, 2));
  console.log(result);
} finally {
  await writeFile(settingsPath, JSON.stringify({ ...settings, followCodex: false }));
  await request('quit').catch(() => {});
  if (watcher.exitCode === null) watcher.kill();
  for (const child of children) if (child.exitCode === null) child.kill();
  await sleep(2500); // let the automatically restored watcher observe followCodex=false
}
