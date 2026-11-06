import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function versionFromTag(tag) {
  const match = /^v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$/.exec(tag || '');
  if (!match || match[0] !== tag) throw new Error('Release tags must use vMAJOR.MINOR.PATCH, optionally with a prerelease such as -beta.1.');
  const prerelease = match[1].split(/-(.*)/s)[1];
  if (prerelease?.split('.').some(part => /^\d+$/.test(part) && part.length > 1 && part.startsWith('0'))) throw new Error('Numeric prerelease identifiers must not have leading zeroes.');
  return match[1];
}

export async function setReleaseVersion(root, tag) {
  const version = versionFromTag(tag);
  const packagePath = resolve(root, 'package.json'), lockPath = resolve(root, 'package-lock.json');
  const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
  const lock = JSON.parse(await readFile(lockPath, 'utf8'));
  pkg.version = version; lock.version = version; lock.packages[''].version = version;
  await writeFile(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  await writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n');
  return version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(`Release version: ${await setReleaseVersion('.', process.env.GITHUB_REF_NAME)}`);
}
