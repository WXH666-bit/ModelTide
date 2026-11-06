import { execFileSync } from 'node:child_process';
import { access, readdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const root = resolve('release/win-unpacked');
for (const file of ['ModelTide.exe', 'ModelTide-Details.exe', 'ModelTide-Watcher.exe', 'resources/node.exe', 'resources/collector.cjs']) await access(join(root, file));
const files = [], directories = [];
async function walk(relative = '') {
  for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
    const path = relative ? `${relative}\\${entry.name}` : entry.name;
    if (entry.isDirectory()) { directories.push(path); await walk(path); }
    else if (entry.isFile()) files.push(path);
  }
}
await walk();
// Delete only files shipped by this installer. Never recursively delete user-chosen directories.
const escape = value => value.replaceAll('$', '$$').replaceAll('"', '$\\"');
await writeFile('release/uninstall-files.nsh', [
  ...files.map(path => `Delete "$INSTDIR\\${escape(path)}"`),
  ...directories.sort((a, b) => b.length - a.length).map(path => `RMDir "$INSTDIR\\${escape(path)}"`)
].join('\n'));
let compiler = process.env.MODELTIDE_MAKENSIS;
if (!compiler) {
  const candidates = ['C:/Program Files (x86)/NSIS/makensis.exe', 'C:/Program Files/NSIS/makensis.exe'];
  const cache = join(process.env.LOCALAPPDATA || '', 'electron-builder/Cache/nsis-3.0.4.1');
  try { for (const entry of await readdir(cache, { withFileTypes: true })) if (entry.isDirectory()) candidates.push(join(cache, entry.name, 'makensis.exe')); } catch {}
  for (const path of candidates) { try { await access(path); compiler = path; break; } catch {} }
}
if (!compiler) throw new Error('Install NSIS 3 or set MODELTIDE_MAKENSIS to makensis.exe.');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
execFileSync(compiler, ['/V2', `/DAPP_VERSION=${version}`, `/DPROJECT_ROOT=${resolve('.')}`, resolve('scripts/installer.nsi')], { stdio: 'inherit', windowsHide: true });
console.log(`Created release/ModelTide-${version}-Setup-x64.exe`);
