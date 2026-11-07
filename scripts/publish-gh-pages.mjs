// Build and prepare a gh-pages branch commit from dist/ without changing the current worktree.

import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const branch = 'gh-pages';
const worktree = await mkdtemp(path.join(os.tmpdir(), 'webskat-gh-pages-'));
let worktreeAdded = false;

function git(args, cwd = root) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}

try {
  execFileSync('npm', ['run', 'check'], { cwd: root, stdio: 'inherit' });
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });

  const branchExists = git(['branch', '--list', branch]) !== '';

  if (branchExists) {
    git(['worktree', 'add', worktree, branch]);
  } else {
    git(['worktree', 'add', '--orphan', '-b', branch, worktree]);
  }
  worktreeAdded = true;

  const status = git(['status', '--porcelain'], worktree);
  if (status !== '') {
    throw new Error(`The ${branch} worktree is not clean; refusing to overwrite it.`);
  }

  for (const entry of await readdir(worktree)) {
    if (entry !== '.git') await rm(path.join(worktree, entry), { recursive: true, force: true });
  }
  await cp(path.join(root, 'dist'), worktree, { recursive: true });
  await writeFile(path.join(worktree, '.nojekyll'), '');

  git(['add', '--all'], worktree);
  const changes = git(['status', '--porcelain'], worktree);
  if (changes === '') {
    console.log(`The ${branch} branch already matches dist/.`);
  } else {
    const sourceRevision = git(['rev-parse', '--short', 'HEAD']);
    git(['commit', '-m', `Deploy ${sourceRevision}`], worktree);
    console.log(`Prepared a new ${branch} deployment commit from ${sourceRevision}.`);
  }
  console.log(`Push it with: git push origin ${branch}`);
} finally {
  if (worktreeAdded) {
    git(['worktree', 'remove', '--force', worktree]);
  }
  await rm(worktree, { recursive: true, force: true });
}
