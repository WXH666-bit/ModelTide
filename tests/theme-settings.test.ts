import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { request } from '../src/protocol';
test('collector restores saved themes, migrates legacy preferences and rejects invalid themes', async () => {
  const root = resolve('tests/tmp/theme-settings');
  await mkdir(join(root, 'data'), { recursive: true });
  await mkdir(join(root, 'codex'), { recursive: true });
  const file = join(root, 'data/settings.json');
  const previous = process.env.MODELTIDE_DATA_DIR;
  process.env.MODELTIDE_DATA_DIR = join(root, 'data');
  let child: ChildProcess | undefined;
  async function start() {
    child = spawn(process.execPath, ['--import', 'tsx', 'src/collector.ts', `--owner-pid=${process.pid}`], { env: { ...process.env, MODELTIDE_CODEX_DIR: join(root, 'codex') }, windowsHide: true, stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
      try { await request('health'); return; } catch { await wait(100); }
    }
    throw Error('Collector did not start');
  }
  async function stop() {
    const owned = child; if (!owned) return;
    const ended = new Promise<void>(resolve => owned.once('exit', () => resolve()));
    await request('shutdown', { ownerPid: process.pid });
    await ended; child = undefined;
  }
  try {
    await writeFile(file, JSON.stringify({ language: 'en', followCodex: false }));
    await start();
    assert.equal((await request('state')).settings.theme, 'violet');
    await request('settings', { theme: 'light' });
    assert.equal(JSON.parse(await readFile(file, 'utf8')).theme, 'light');
    await assert.rejects(request('settings', { theme: 'invalid' }), /Unsupported interface theme/);
    assert.equal((await request('state')).settings.theme, 'light');
    await stop(); await start();
    assert.equal((await request('state')).settings.theme, 'light', 'theme survives a full collector restart');
    await stop();
    await writeFile(file, JSON.stringify({ language: 'en', followCodex: false, theme: 'future-theme' }));
    await start();
    assert.equal((await request('state')).settings.theme, 'violet');
    await stop();
  } finally {
    if (child) child.kill();
    if (previous === undefined) delete process.env.MODELTIDE_DATA_DIR; else process.env.MODELTIDE_DATA_DIR = previous;
  }
});
