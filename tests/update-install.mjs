import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile, link, unlink, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createConnection } from 'node:net';
import { resolve, join } from 'node:path';
const root = resolve('tests/tmp/update-install');
const appRoot = resolve(process.env.MODELTIDE_PACKAGED_ROOT || join(root, 'app with spaces'));
const data = join(root, 'data'), codex = join(root, 'codex');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const sourceInstaller = resolve(`release/ModelTide-${version}-Setup-x64.exe`);
await mkdir(join(codex, 'sessions'), { recursive: true }); await mkdir(data, { recursive: true });
// Each run writes a new synthetic timestamp. Reset only its mutable index so
// prior runs (including a moved workspace) cannot contribute extra fixture usage.
for (const name of ['usage.sqlite', 'usage.sqlite-wal', 'usage.sqlite-shm']) {
  await unlink(join(data, name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
const stub = join(root, 'CodexStub.exe');
execFileSync('C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe', ['/nologo', '/target:winexe', `/out:${stub}`, resolve('tests/CodexStub.cs')]);
const env = { ...process.env, MODELTIDE_DATA_DIR: data, MODELTIDE_CODEX_DIR: codex, MODELTIDE_TEST_STANDALONE: '1', MODELTIDE_TEST_CODEX_EXE: stub };
delete env.ELECTRON_RUN_AS_NODE;
const identity = 'modeltide-' + createHash('sha256').update(data).digest('hex').slice(0, 16);
const pipe = '\\\\.\\pipe\\' + identity;
function request(method) { return new Promise((resolve, reject) => {
  const socket = createConnection(pipe); let input = '';
  socket.setEncoding('utf8'); socket.setTimeout(5000, () => { socket.destroy(); reject(Error('timeout')); }); socket.on('error', reject);
  socket.on('connect', () => socket.write(JSON.stringify({ method }) + '\n'));
  socket.on('data', chunk => { input += chunk; if (!input.includes('\n')) return; socket.end(); const reply = JSON.parse(input); reply.error ? reject(Error(reply.error)) : resolve(reply.result); });
}); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, timeout = 25000) { const end = Date.now() + timeout; while (Date.now() < end) { try { const result = await fn(); if (result) return result; } catch {} await sleep(250); } throw Error('Update integration timed out'); }
function launch(exe, args = []) { return spawn(exe, args, { env, windowsHide: true, stdio: 'ignore' }); }
function completed(child) { return new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(Error(`Process exited ${code}`))); }); }
async function digest(path) { const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest('hex'); }
// Reuse CI's existing installation. Locally this installs one isolated runtime because
// the regular unpacked directory is the user's running application, not writable test data.
try { await access(join(appRoot, 'ModelTide.exe')); }
catch { const setup = spawn(sourceInstaller, ['/S /UPDATE /D=' + appRoot], { env, windowsHide: true, windowsVerbatimArguments: true, stdio: 'ignore' }); await completed(setup); }
const preferences = { timezone: 'Asia/Shanghai', language: 'en', theme: 'light', offset: { x: 8, y: 100 }, followCodex: true, launchAtLogin: false, alwaysOnTop: true, onlyInCodex: false };
await writeFile(join(data, 'settings.json'), JSON.stringify(preferences));
await writeFile(join(data, 'keep.txt'), 'user data must survive');
await writeFile(join(codex, 'sessions/fixture.jsonl'), [
  { type: 'session_meta', payload: { id: 'update-fixture' } },
  { type: 'turn_context', payload: { model: 'fixture-model' } },
  { type: 'event_msg', timestamp: new Date().toISOString(), payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 100, output_tokens: 20 } } } }
].map(JSON.stringify).join('\n') + '\n');
const fakeCodex = launch(stub);
const widget = launch(join(appRoot, 'ModelTide.exe'));
const watcher = launch(join(appRoot, 'ModelTide-Watcher.exe'));
let helper, newCollector;
try {
  const before = await until(() => request('health'));
  await until(async () => (await request('snapshot')).usage.summary?.total === 120);
  // Exercise closing the on-demand Electron child as part of an update.
  await request('open'); await sleep(3000);
  const download = join(root, `ModelTide-${version}-Setup-x64.exe`);
  await unlink(download).catch(e => { if (e.code !== 'ENOENT') throw e; });
  try { await link(sourceInstaller, download); } // Reuse bytes on NTFS.
  catch (error) {
    // exFAT workspaces cannot create hard links (Windows reports EISDIR).
    // The helper deletes this fixture after installation, so it needs its own file.
    if (!['EISDIR', 'ENOTSUP', 'EXDEV', 'EPERM'].includes(error.code)) throw error;
    await copyFile(sourceInstaller, download);
  }
  const helperPath = join(root, 'ModelTide-Update.exe');
  // Test the current helper even when reusing an older baseline installation.
  await copyFile(resolve('release/win-unpacked/ModelTide.exe'), helperPath);
  await copyFile(resolve('release/win-unpacked/ModelTide.exe.config'), helperPath + '.config');
  const plan = { Installer: download, Sha256: await digest(download), Directory: appRoot, Identity: identity, Language: 'en', Version: version, CollectorPid: before.pid };
  helper = launch(helperPath, ['--apply-update', Buffer.from(JSON.stringify(plan)).toString('base64')]);
  await completed(helper);
  assert.equal(widget.exitCode, 0); assert.equal(watcher.exitCode, 0);
  const after = await until(async () => { const result = await request('health'); return result.pid !== before.pid && result; });
  newCollector = after.pid;
  assert.equal((await request('state')).settings.theme, 'light', 'theme survives installation and restart');
  await until(async () => (await request('snapshot')).usage.summary?.total === 120);
  assert.deepEqual(JSON.parse(await readFile(join(data, 'settings.json'), 'utf8')), preferences);
  assert.equal(await readFile(join(data, 'keep.txt'), 'utf8'), 'user data must survive');
  await assert.rejects(access(download), 'successful update removes cached installer link');
  await writeFile(join(root, 'report.json'), JSON.stringify({ passed: true, version, oldCollector: before.pid, newCollector, settingsPreserved: true, usagePreserved: true, watcherStopped: true, restarted: true, installerCacheCleaned: true }, null, 2));
  console.log('PASS: verified installer, in-place update, process coordination, automatic restart, settings/index preservation and cache cleanup.');
} finally {
  await writeFile(join(data, 'settings.json'), JSON.stringify({ ...preferences, followCodex: false }));
  const remaining = await until(() => request('health'), 5000).catch(() => null);
  newCollector ??= remaining?.pid;
  await request('quit').catch(() => {});
  await until(() => { if (!newCollector) return true; try { process.kill(newCollector, 0); return false; } catch { return true; } }).catch(() => {});
  fakeCodex.kill();
  if (widget.exitCode === null) widget.kill(); if (watcher.exitCode === null) watcher.kill();
}
