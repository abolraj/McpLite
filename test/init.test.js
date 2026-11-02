import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { init } from '../src/init.js';

function tmpRoot() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcplite-test-')));
}
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}
function quietInit(root, force) {
  const orig = process.stderr.write;
  process.stderr.write = () => true;
  try {
    init(root, force);
  } finally {
    process.stderr.write = orig;
  }
}

test('init: creates guide, tasks, logs', () => {
  const root = tmpRoot();
  try {
    quietInit(root, false);
    assert.ok(fs.existsSync(path.join(root, 'mcplite-guide.md')));
    assert.ok(fs.existsSync(path.join(root, 'mcplite-tasks.json')));
    assert.ok(fs.existsSync(path.join(root, 'mcplite-tasks-logs.json')));
    assert.equal(
      fs.readFileSync(path.join(root, 'mcplite-tasks.json'), 'utf8'),
      '[]\n',
    );
  } finally { cleanup(root); }
});

test('init: skips existing guide without --force', () => {
  const root = tmpRoot();
  try {
    fs.writeFileSync(path.join(root, 'mcplite-guide.md'), 'custom');
    quietInit(root, false);
    assert.equal(
      fs.readFileSync(path.join(root, 'mcplite-guide.md'), 'utf8'),
      'custom',
    );
  } finally { cleanup(root); }
});

test('init: --force overwrites guide', () => {
  const root = tmpRoot();
  try {
    fs.writeFileSync(path.join(root, 'mcplite-guide.md'), 'custom');
    quietInit(root, true);
    assert.notEqual(
      fs.readFileSync(path.join(root, 'mcplite-guide.md'), 'utf8'),
      'custom',
    );
  } finally { cleanup(root); }
});
