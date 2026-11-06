import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { request } from './protocol';
import type { Query } from './types';
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-features', 'MediaRouter');
app.setPath('userData', process.env.MODELTIDE_DATA_DIR || join(app.getPath('appData'), 'ModelTide'));
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
let win: BrowserWindow, collector: ChildProcess | undefined, timer: NodeJS.Timeout;
let dragging: { cursor: Electron.Point; origin: Electron.Point } | null = null, dragTimer: NodeJS.Timeout;
function stopDragging() { clearInterval(dragTimer); dragging = null; }
function clamp(p: Electron.Rectangle) { const a = screen.getDisplayMatching(p).workArea; return { ...p, x: Math.max(a.x, Math.min(p.x, a.x + a.width - p.width)), y: Math.max(a.y, Math.min(p.y, a.y + a.height - p.height)) }; }
async function notify() { try { const s = await request('state'); if (win && !win.isDestroyed()) { win.setAlwaysOnTop(s.settings.alwaysOnTop); win.webContents.send('state', s); } } catch {} }
async function action(name: string) {
  if (name === 'collapse' || name === 'toggle') app.quit();
  else if (name === 'refresh') { await request('refresh'); await notify(); }
  else if (name === 'reset') await request('reset');
  else if (name === 'quit') { await request('quit'); app.quit(); }
  else if (name === 'drag-start' && !dragging) {
    const [x, y] = win.getPosition(); dragging = { cursor: screen.getCursorScreenPoint(), origin: { x, y } };
    dragTimer = setInterval(() => { if (!dragging) return; const p = screen.getCursorScreenPoint(); win.setBounds(clamp({ x: dragging.origin.x + p.x - dragging.cursor.x, y: dragging.origin.y + p.y - dragging.cursor.y, width: 420, height: 560 })); }, 20);
  } else if (name === 'drag-end') stopDragging();
}
if (locked) app.whenReady().then(async () => {
  try { await request('health'); } catch {
    if (app.isPackaged) throw new Error('请从 ModelTide.exe 启动原生挂件');
    collector = spawn(process.env.MODELTIDE_NODE_PATH || 'node', ['--max-old-space-size=64', '--max-semi-space-size=4', join(__dirname, 'collector.cjs'), `--owner-pid=${process.pid}`], { windowsHide: true, stdio: 'ignore' });
    for (let i = 0; i < 60; i++) { await wait(100); try { await request('health'); break; } catch { if (i === 59) throw new Error('统计服务无法启动，需要 Node.js 24 或更新版本'); } }
  }
  const args = process.argv;
  const x = Number(args.find(a => a.startsWith('--x='))?.slice(4) ?? 150), y = Number(args.find(a => a.startsWith('--y='))?.slice(4) ?? 140);
  win = new BrowserWindow({ ...clamp({ x, y, width: 420, height: 560 }), icon: join(__dirname, 'ui/assets/logo.png'), minWidth: 420, minHeight: 560, frame: false, transparent: true, resizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true, show: false, alwaysOnTop: true, hasShadow: false,
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: true, spellcheck: false } });
  win.setMenu(null); win.webContents.setWindowOpenHandler(() => ({ action: 'deny' })); win.webContents.on('will-navigate', e => e.preventDefault());
  ipcMain.handle('query', (_e, q: Query) => request('query', q)); ipcMain.handle('state', () => request('state')); ipcMain.handle('action', (_e, name: string) => action(name));
  ipcMain.handle('settings', async (_e, value) => { const s = await request('settings', value); await notify(); return s; });
  await win.loadFile(join(__dirname, 'ui/index.html')); win.show();
  timer = setInterval(() => void notify(), 10000);
  app.on('second-instance', () => { win.show(); win.focus(); });
}).catch(e => { console.error(e); app.quit(); });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { clearInterval(timer); stopDragging(); collector?.kill(); });
