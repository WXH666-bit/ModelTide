// Test-only transpilation: no release files, installer, dependency copies or version changes.
import { build } from 'esbuild';
import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';
const root = resolve('tests/tmp/themes'), runtime = join(root, 'runtime');
await mkdir(join(runtime, 'ui/assets'), { recursive: true });
await mkdir(join(root, 'resources'), { recursive: true });
await Promise.all([
  ...['main', 'preload', 'collector', 'mcp'].map(name => build({ entryPoints: [`src/${name}.ts`], outfile: join(runtime, `${name}.cjs`), bundle: true, platform: 'node', format: 'cjs', target: 'node24', external: ['electron', 'koffi'] })),
  build({ entryPoints: ['src/ui/index.tsx'], outdir: join(runtime, 'ui'), bundle: true, splitting: true, format: 'esm', minify: true, define: { 'process.env.NODE_ENV': '"production"' }, target: 'chrome140' })
]);
await copyFile('src/ui/index.html', join(runtime, 'ui/index.html'));
await copyFile('src/ui/assets/logo.png', join(runtime, 'ui/assets/logo.png'));
await copyFile('src/ui/assets/logo.png', join(root, 'resources/logo.png'));
const framework = 'C:/Windows/Microsoft.NET/Framework64/v4.0.30319';
const refs = ['System.dll', 'System.Core.dll', 'System.Net.Http.dll', 'System.Web.Extensions.dll', 'System.Windows.Forms.dll', 'System.Drawing.dll', 'WPF/WindowsBase.dll', 'WPF/PresentationCore.dll', 'WPF/PresentationFramework.dll', 'System.Xaml.dll'];
const native = join(root, 'ThemeTests.exe');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile(join(root, 'Version.cs'), `[assembly: System.Reflection.AssemblyInformationalVersion(${JSON.stringify(version)})]`);
execFileSync(`${framework}/csc.exe`, ['/nologo', '/codepage:65001', '/target:exe', '/main:ThemeTests', `/out:${native}`, join(root, 'Version.cs'), `/resource:${resolve('src/localization.json')},ModelTide.locales.json`, `/resource:${resolve('src/themes.json')},ModelTide.themes.json`, ...refs.map(p => `/reference:${framework}/${p}`), ...['tests/ThemeTests.cs', 'native/Widget.cs', 'native/Theme.cs', 'native/Locale.cs', 'native/UpdateClient.cs', 'native/UpdateInstaller.cs'].map(p => resolve(p))], { stdio: 'inherit', windowsHide: true });
await copyFile('native/ModelTide.exe.config', native + '.config');
const output = execFileSync(native, [root], { encoding: 'utf8', windowsHide: true });
await writeFile(join(root, 'native-report.txt'), output); console.log(output.trim());
execFileSync(process.execPath, ['tests/ui.mjs'], { stdio: 'inherit', env: { ...process.env, MODELTIDE_TEST_RUNTIME: runtime }, windowsHide: true });
// A review sheet of the actual rendered overview, using the same CSS and real fixture output.
await writeFile(join(root, 'preview.html'), '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#e4e4e7;font:16px "Segoe UI",sans-serif;display:flex;gap:16px;padding:16px}section{width:420px;flex:none}h2{font-size:16px;margin:0 0 10px}iframe{width:420px;height:560px;border:0}</style>' + ['dark', 'light', 'violet'].map((id, i) => `<section><h2>${['深色 · 适配 Codex 深色', '浅色 · 适配 Codex 浅色', '龙娘淡紫 · 原有风格'][i]}</h2><iframe src="theme-${id}.html"></iframe></section>`).join(''));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1324, height: 622 }, deviceScaleFactor: 1 });
  await page.goto('file:///' + join(root, 'preview.html').replaceAll('\\', '/'));
  await page.screenshot({ path: join(root, 'themes.png') });
} finally { await browser.close(); }
console.log('PASS: local-only theme review sheet saved to tests/tmp/themes/themes.png');
