// Release: turn `## [Unreleased]` in CHANGELOG.md into `## [X.Y.Z] - date`, bump the version,
// make the release commit, tag it vX.Y.Z, publish gh-pages and push it.
// Usage: npm run release -- X.Y.Z   (docs/dev/versioning.md §4)

import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const changelogPath = path.join(root, 'CHANGELOG.md');
const version = process.argv[2] ?? '';

function run(command, args) {
  return execFileSync(command, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}
function runVisible(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}
function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}
function parts(v) {
  return v.split('.').map(Number);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) fail('usage: npm run release -- X.Y.Z');
if (run('git', ['branch', '--show-current']) !== 'main') fail('releases are made on main');
if (run('git', ['status', '--porcelain', '--untracked-files=no']) !== '') fail('the worktree has uncommitted changes; commit them first');
if (run('git', ['tag', '--list', `v${version}`]) !== '') fail(`tag v${version} already exists`);

const current = parts(JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version);
const next = parts(version);
const newer = next[0] !== current[0] ? next[0] > current[0] : next[1] !== current[1] ? next[1] > current[1] : next[2] > current[2];
if (!newer) fail(`${version} is not newer than the current version`);

const changelog = await readFile(changelogPath, 'utf8');
const match = /^## \[Unreleased\][ \t]*\r?\n([\s\S]*?)(?=^## \[)/im.exec(changelog);
if (match === null || !/^- /m.test(match[1])) fail('CHANGELOG.md has no `## [Unreleased]` section with items');

const date = new Date().toISOString().slice(0, 10);
await writeFile(changelogPath, changelog.replace(/^## \[Unreleased\]/im, `## [${version}] - ${date}`));
runVisible('npm', ['version', version, '--no-git-tag-version']);
runVisible('npm', ['run', 'check']);

runVisible('git', ['add', 'CHANGELOG.md', 'package.json', 'package-lock.json']);
runVisible('git', ['commit', '-m', `Release v${version}`]);
runVisible('git', ['tag', '-a', `v${version}`, '-m', `v${version}`]);
runVisible('npm', ['run', 'publish:pages']);
runVisible('git', ['push', 'origin', 'gh-pages']);
console.log(`Released v${version}. The commit and tag stay local; push them with: git push origin main v${version}`);
