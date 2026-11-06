import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
// Reuse the resource editor already bundled with electron-winstaller.
execFileSync(resolve('node_modules/electron-winstaller/vendor/rcedit.exe'), [
  resolve('release/win-unpacked/ModelTide-Details.exe'), '--set-icon', resolve('src/ui/assets/modeltide.ico')
], { stdio: 'inherit', windowsHide: true });
