import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
// Build scripts are native ESM and deliberately separate from renderer TypeScript.
const script = import('../scripts/release-version.mjs');
test('release tags accept SemVer versions and reject malformed or injected names', async () => {
  const { versionFromTag } = await script;
  for (const version of ['0.1.0', '1.2.3', '2.0.0-beta.1', '1.0.0-rc-next.0']) assert.equal(versionFromTag('v' + version), version);
  for (const tag of ['', 'main', '1.2.3', 'v01.2.3', 'v1.2', 'v1.2.3-beta.01', 'v1.2.3+build', 'v1.2.3\n', 'v1.2.3;echo injected']) assert.throws(() => versionFromTag(tag));
});
test('release version updates package and lock without changing dependency inputs', async () => {
  const { setReleaseVersion } = await script;
  const root = resolve('tests/tmp/release'); await mkdir(root, { recursive: true });
  const pkg = { name: 'fixture', version: '0.1.0', devDependencies: { example: '1.0.0' } };
  const lock = { version: '0.1.0', packages: { '': pkg, 'node_modules/example': { version: '1.0.0', integrity: 'unchanged' } } };
  await writeFile(join(root, 'package.json'), JSON.stringify(pkg));
  await writeFile(join(root, 'package-lock.json'), JSON.stringify(lock));
  assert.equal(await setReleaseVersion(root, 'v2.3.4-beta.1'), '2.3.4-beta.1');
  const actualPackage = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const actualLock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
  assert.equal(actualPackage.version, '2.3.4-beta.1');
  assert.equal(actualLock.version, actualPackage.version);
  assert.equal(actualLock.packages[''].version, actualPackage.version);
  assert.deepEqual(actualPackage.devDependencies, pkg.devDependencies);
  assert.deepEqual(actualLock.packages['node_modules/example'], lock.packages['node_modules/example']);
  await assert.rejects(() => setReleaseVersion(root, 'vinvalid'));
  assert.deepEqual(JSON.parse(await readFile(join(root, 'package.json'), 'utf8')), actualPackage);
});
