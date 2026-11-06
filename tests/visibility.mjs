import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const root = resolve('tests/tmp/visibility');
await mkdir(root, { recursive: true });
const executable = join(root, 'VisibilityTests.exe');
execFileSync('C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe', ['/nologo', '/target:exe', `/out:${executable}`, resolve('tests/VisibilityTests.cs')], { stdio: 'inherit', windowsHide: true });
const output = execFileSync(executable, [resolve('release/win-unpacked/ModelTide.exe')], { encoding: 'utf8', windowsHide: true });
await writeFile(join(root, 'report.txt'), output); console.log(output.trim());
