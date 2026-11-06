import { copyFile, writeFile, readFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
if (process.platform !== 'win32' || process.arch !== 'x64' || Number(process.versions.node.split('.')[0]) < 24) throw new Error('Packaging requires Windows x64 Node.js 24+.');
const resources = resolve('release/win-unpacked/resources');
await copyFile(process.execPath, join(resources, 'node.exe'));
await copyFile('LICENSE', join(resources, 'MODELTIDE-LICENSE.txt'));
const localLicense = join(dirname(process.execPath), 'LICENSE');
let license;
try { await access(localLicense); license = await readFile(localLicense, 'utf8'); }
catch {
  const response = await fetch(`https://raw.githubusercontent.com/nodejs/node/${process.version}/LICENSE`);
  if (!response.ok) throw new Error(`Node.js license download failed: ${response.status}`);
  license = await response.text();
}
await writeFile(join(resources, 'NODE-LICENSE.txt'), license);
await writeFile(join(resources, 'runtime-version.txt'), `Node.js ${process.version} Windows x64\n`);
console.log(`Bundled Node.js ${process.version}; end users do not need a separate runtime.`);
