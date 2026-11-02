import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { dispatch } from '../src/tools.js';

function tmpRoot() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcplite-test-')));
}
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test('read: whole file', async () => {
  const root = tmpRoot();
  try {
    fs.writeFileSync(path.join(root, 'f.txt'), 'a\nb\nc');
    const r = await dispatch('read', { path: 'f.txt' }, root);
    assert.equal(r.path, 'f.txt');
    assert.equal(r.totalLines, 3);
    assert.equal(r.offset, 0);
    assert.equal(r.content, 'a\nb\nc');
  } finally { cleanup(root); }
});

test('read: offset and limit', async () => {
  const root = tmpRoot();
  try {
    fs.writeFileSync(path.join(root, 'f.txt'), 'a\nb\nc\nd\ne');
    const r = await dispatch('read', { path: 'f.txt', offset: 1, limit: 2 }, root);
    assert.equal(r.content, 'b\nc');
  } finally { cleanup(root); }
});

test('read: missing path throws', async () => {
  const root = tmpRoot();
  try {
    await assert.rejects(dispatch('read', {}, root), /path required/);
  } finally { cleanup(root); }
});

test('write: creates parent dirs and returns byte count', async () => {
  const root = tmpRoot();
  try {
    const r = await dispatch('write', { path: 'a/b/f.txt', content: 'hi' }, root);
    assert.equal(r.path, 'a/b/f.txt');
    assert.equal(r.bytes, 2);
    assert.equal(fs.readFileSync(path.join(root, 'a/b/f.txt'), 'utf8'), 'hi');
  } finally { cleanup(root); }
});

test('edit: single replacement', async () => {
  const root = tmpRoot();
  try {
    fs.writeFileSync(path.join(root, 'f.txt'), 'hello world');
    const r = await dispatch('edit', {
      path: 'f.txt', old_string: 'world', new_string: 'there',
    }, root);
    assert.equal(r.replacements, 1);
    assert.equal(fs.readFileSync(path.join(root, 'f.txt'), 'utf8'), 'hello there');
  } finally { cleanup(root); }
});

test('edit: ambiguous match rejected without replace_all', async () => {
  const root = tmpRoot();
  try {
    fs.writeFileSync(path.join(root, 'f.txt'), 'a a a');
    await assert.rejects(
      dispatch('edit', { path: 'f.txt', old_string: 'a', new_string: 'b' }, root),
      /appears 3 times/,
    );
  } finally { cleanup(root); }
});

test('edit: replace_all replaces every occurrence', async () => {
  const root = tmpRoot();
  try {
    fs.writeFileSync(path.join(root, 'f.txt'), 'a a a');
    const r = await dispatch('edit', {
      path: 'f.txt', old_string: 'a', new_string: 'b', replace_all: true,
    }, root);
    assert.equal(r.replacements, 3);
    assert.equal(fs.readFileSync(path.join(root, 'f.txt'), 'utf8'), 'b b b');
  } finally { cleanup(root); }
});

test('edit: not found throws', async () => {
  const root = tmpRoot();
  try {
    fs.writeFileSync(path.join(root, 'f.txt'), 'abc');
    await assert.rejects(
      dispatch('edit', { path: 'f.txt', old_string: 'xyz', new_string: 'q' }, root),
      /not found/,
    );
  } finally { cleanup(root); }
});

test('edit: empty old_string rejected', async () => {
  const root = tmpRoot();
  try {
    fs.writeFileSync(path.join(root, 'f.txt'), 'abc');
    await assert.rejects(
      dispatch('edit', { path: 'f.txt', old_string: '', new_string: 'q' }, root),
      /must not be empty/,
    );
  } finally { cleanup(root); }
});

test('glob: matches pattern, sorted', async () => {
  const root = tmpRoot();
  try {
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src/a.js'), '');
    fs.writeFileSync(path.join(root, 'src/b.js'), '');
    fs.writeFileSync(path.join(root, 'src/c.txt'), '');
    const r = await dispatch('glob', { pattern: 'src/**/*.js' }, root);
    assert.equal(r.count, 2);
    assert.deepEqual(r.files, ['src/a.js', 'src/b.js']);
  } finally { cleanup(root); }
});

test('grep: finds matching lines', async () => {
  const root = tmpRoot();
  try {
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src/a.js'), 'foo\nbar\nfoo');
    const r = await dispatch('grep', { pattern: 'foo' }, root);
    assert.equal(r.count, 2);
    assert.deepEqual(r.hits.map((h) => h.line), [1, 3]);
    assert.equal(r.hits[0].file, 'src/a.js');
  } finally { cleanup(root); }
});

test('grep: ignore_case', async () => {
  const root = tmpRoot();
  try {
    fs.writeFileSync(path.join(root, 'f.txt'), 'Foo\nfoo\nFOO');
    const r = await dispatch('grep', { pattern: 'foo', ignore_case: true }, root);
    assert.equal(r.count, 3);
  } finally { cleanup(root); }
});

test('grep: invalid regex throws', async () => {
  const root = tmpRoot();
  try {
    await assert.rejects(dispatch('grep', { pattern: '(' }, root), /invalid regex/);
  } finally { cleanup(root); }
});

test('bash: captures stdout and exit code 0', async () => {
  const root = tmpRoot();
  try {
    const r = await dispatch('bash', { command: 'echo hi' }, root);
    assert.equal(r.exitCode, 0);
    assert.equal(r.stdout, 'hi\n');
    assert.equal(r.stderr, '');
  } finally { cleanup(root); }
});

test('bash: non-zero exit does not throw', async () => {
  const root = tmpRoot();
  try {
    const r = await dispatch('bash', { command: 'exit 7' }, root);
    assert.equal(r.exitCode, 7);
  } finally { cleanup(root); }
});

test('dispatch: unknown tool throws', async () => {
  const root = tmpRoot();
  try {
    await assert.rejects(dispatch('nope', {}, root), /unknown tool/);
  } finally { cleanup(root); }
});
