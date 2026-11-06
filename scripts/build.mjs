import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await Promise.all([
  build({ entryPoints: ['src/main.ts'], outfile: 'dist/main.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['electron', 'koffi'], target: 'node24' }),
  build({ entryPoints: ['src/preload.ts'], outfile: 'dist/preload.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ entryPoints: ['src/mcp.ts'], outfile: 'dist/mcp.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22' }),
  build({ entryPoints: ['src/collector.ts'], outfile: 'dist/collector.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node24' }),
  build({ entryPoints: ['src/ui/index.tsx'], outdir: 'dist/ui', bundle: true, splitting: true, format: 'esm', minify: true, define: { 'process.env.NODE_ENV': '"production"' }, target: 'chrome140' })
]);
await copyFile('src/ui/index.html', 'dist/ui/index.html');
await mkdir('dist/ui/assets', { recursive: true });
await copyFile('src/ui/assets/character.png', 'dist/ui/assets/character.png');
await copyFile('src/ui/assets/logo.png', 'dist/ui/assets/logo.png');
