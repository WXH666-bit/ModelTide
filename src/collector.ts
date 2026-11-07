import { createServer } from 'node:net';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { UsageStore } from './store';
import { pipeName } from './protocol';
import { validTimezone } from './time';
import type { Settings } from './types';
import { coverageText, t, translateError, validLanguage } from './locale';
import { defaultTheme, validTheme } from './theme';
const run = promisify(execFile);
const dataDir = process.env.MODELTIDE_DATA_DIR || join(process.env.APPDATA || homedir(), 'ModelTide');
let settings: Settings = { timezone: 'America/Los_Angeles', language: 'zh-CN', theme: defaultTheme, offset: null, launchAtLogin: false, followCodex: false, alwaysOnTop: true, onlyInCodex: true };
let store: UsageStore, error: string | undefined, quitting = false;
let command = '', commandSequence = 0;
const owner = Number(process.argv.find(a => a.startsWith('--owner-pid='))?.split('=')[1]);
const settingFile = join(dataDir, 'settings.json');
const persist = () => writeFile(settingFile, JSON.stringify(settings, null, 2));
async function updateSettings(update: Partial<Settings>) {
  let watcher: string | undefined;
  if (update.language !== undefined && !validLanguage(update.language)) throw new Error(t(settings.language, 'invalidLanguage'));
  if (update.theme !== undefined && !validTheme(update.theme)) throw new Error(t(settings.language, 'invalidTheme'));
  if (update.timezone !== undefined) { if (!validTimezone(update.timezone)) throw new Error('无效的 IANA 时区'); settings.timezone = update.timezone; }
  if ('offset' in update) {
    if (update.offset !== null && (!Number.isFinite(update.offset?.x) || !Number.isFinite(update.offset?.y))) throw new Error('无效的位置');
    settings.offset = update.offset ?? null;
  }
  if (update.launchAtLogin !== undefined) {
    const exe = process.env.MODELTIDE_WIDGET_EXE;
    if (!exe) throw new Error('请从原生挂件启动后设置开机启动');
    if (update.launchAtLogin) await run('reg.exe', ['add', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', 'ModelTide', '/t', 'REG_SZ', '/d', `"${exe}"`, '/f'], { windowsHide: true });
    else { try { await run('reg.exe', ['delete', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', 'ModelTide', '/f'], { windowsHide: true }); } catch (e: any) { if (e.code !== 1) throw e; } }
    settings.launchAtLogin = Boolean(update.launchAtLogin);
  }
  if (update.followCodex !== undefined) {
    const exe = process.env.MODELTIDE_WIDGET_EXE;
    if (!exe) throw new Error('请从原生挂件启动后设置跟随启动');
    watcher = join(dirname(exe), 'ModelTide-Watcher.exe');
    if (update.followCodex) await run('reg.exe', ['add', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', 'ModelTideWatcher', '/t', 'REG_SZ', '/d', `"${watcher}"`, '/f'], { windowsHide: true });
    else { try { await run('reg.exe', ['delete', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', 'ModelTideWatcher', '/f'], { windowsHide: true }); } catch (e: any) { if (e.code !== 1) throw e; } }
    settings.followCodex = Boolean(update.followCodex);
  }
  if (update.alwaysOnTop !== undefined) settings.alwaysOnTop = Boolean(update.alwaysOnTop);
  if (update.onlyInCodex !== undefined) settings.onlyInCodex = Boolean(update.onlyInCodex);
  if (update.language !== undefined) settings.language = update.language;
  if (update.theme !== undefined) settings.theme = update.theme;
  await persist();
  if (watcher && settings.followCodex) { const child = spawn(watcher, [], { windowsHide: true, detached: true, stdio: 'ignore' }); child.unref(); }
  return settings;
}
function query(params: any) {
  const usage = store.query(params ?? {}, Date.now(), settings.timezone);
  return { ...usage, coverage: { ...usage.coverage, message: coverageText(usage.coverage, settings.language) } };
}
function readError() { return error ? `${t(settings.language, 'readFailed')}: ${error}` : undefined; }
const server = createServer(socket => {
  let input = ''; socket.setEncoding('utf8'); socket.setTimeout(10000, () => socket.destroy()); socket.on('error', () => {});
  socket.on('data', async data => {
    input += data;
    if (input.length > 16384) { socket.destroy(); return; }
    const end = input.indexOf('\n'); if (end < 0) return; socket.pause();
    try {
      const { method, params } = JSON.parse(input.slice(0, end)); let result;
      if (!store) throw new Error('统计服务正在启动');
      if (method === 'query') result = query(params);
      else if (method === 'snapshot') result = { usage: query({ range: 'today' }), settings, error: readError(), command, commandSequence };
      else if (method === 'state') result = { expanded: true, attached: !!process.env.MODELTIDE_WIDGET_EXE, settings, error: readError() };
      else if (method === 'settings') result = await updateSettings(params ?? {});
      else if (method === 'refresh') { await scan(); result = { refreshed: true }; }
      else if (method === 'reset') { settings.offset = null; await persist(); command = 'reset'; commandSequence++; result = { reset: true }; }
      else if (method === 'open') { command = 'open'; commandSequence++; result = { opened: true }; }
      else if (method === 'quit') { command = 'quit'; commandSequence++; result = { quitting: true }; }
      else if (method === 'shutdown' && owner && params?.ownerPid === owner) result = { stopping: true };
      else if (method === 'health') result = { ready: true, indexing: store.indexing, memory: process.memoryUsage(), pid: process.pid, ownerPid: owner || null, error };
      else throw new Error('未知方法');
      socket.end(JSON.stringify({ result }) + '\n');
      if (method === 'shutdown') void quit();
    } catch (e: any) { socket.end(JSON.stringify({ error: translateError(e.message, settings.language) }) + '\n'); }
  });
});
async function scan() { try { await store.scan(); error = undefined; } catch (e: any) { error = e.message; } }
let scanTimer: NodeJS.Timeout, ownerTimer: NodeJS.Timeout;
async function quit() { if (quitting) return; quitting = true; clearInterval(scanTimer); clearInterval(ownerTimer); server.close(); await store?.close(); process.exit(0); }
async function start() {
  await mkdir(dataDir, { recursive: true });
  try { settings = { ...settings, ...JSON.parse(await readFile(settingFile, 'utf8')) }; if (!validTimezone(settings.timezone)) settings.timezone = 'America/Los_Angeles'; } catch {}
  if (!validLanguage(settings.language)) settings.language = 'zh-CN';
  if (!validTheme(settings.theme)) settings.theme = defaultTheme;
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(pipeName(), resolve); });
  store = await UsageStore.create(process.env.MODELTIDE_CODEX_DIR || process.env.CODEX_HOME || join(homedir(), '.codex'), join(dataDir, 'usage.sqlite'));
  void scan(); scanTimer = setInterval(() => void scan(), 10000);
  if (owner) ownerTimer = setInterval(() => { try { process.kill(owner, 0); } catch { void quit(); } }, 2000);
}
process.on('SIGTERM', () => void quit()); process.on('SIGINT', () => void quit());
start().catch(e => { if (e.code !== 'EADDRINUSE') console.error(e); process.exit(e.code === 'EADDRINUSE' ? 0 : 1); });
