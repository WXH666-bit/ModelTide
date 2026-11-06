import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const child = spawn(resolve('dist/ModelTide.exe'), [], { detached: true, stdio: 'ignore', windowsHide: true });
child.unref();
