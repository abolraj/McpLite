import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  splitLines,
  countOccurrences,
  checkGlobPattern,
  safePath,
  readUtf8,
} from '../src/utils.js';

function tmpRoot() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcplite-test-')));
}
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test('splitLines: empty string → []', () => {
  assert.deepEqual(splitLines(''), []);
});
test('splitLines: single line, no terminator', () => {
  assert.deepEqual(splitLines('foo'), ['foo']);
});
test('splitLines: drops single trailing LF', () => {
  assert.deepEqual(splitLines('foo\n'), ['foo']);
});
test('splitLines: drops single trailing CRLF', () => {
  assert.deepEqual(splitLines('foo\r\n'), ['foo']);
});
test('splitLines: LF separated', () => {
  assert.deepEqual(splitLines('a\nb\nc'), ['a', 'b', 'c']);
});
test('splitLines: CRLF separated', () => {
  assert.deepEqual(splitLines('a\r\nb\r\nc'), ['a', 'b', 'c']);
});
test('splitLines: preserves internal blank lines', () => {
  assert.deepEqual(splitLines('a\n\nb\n'), ['a', '', 'b']);
});

test('countOccurrences: basic', () => {
  assert.equal(countOccurrences('abcabc', 'abc'), 2);
});
test('countOccurrences: non-overlapping (aaaa/aa = 2)', () => {
  assert.equal(countOccurrences('aaaa', 'aa'), 2);
});
test('countOccurrences: empty needle → 0', () => {
  assert.equal(countOccurrences('abc', ''), 0);
});
test('countOccurrences: missing → 0', () => {
  assert.equal(countOccurrences('abc', 'xyz'), 0);
});

test('checkGlobPattern: relative patterns accepted', () => {
  assert.doesNotThrow(() => checkGlobPattern('src/**/*.js'));
  assert.doesNotThrow(() => checkGlobPattern('**/*'));
  assert.doesNotThrow(() => checkGlobPattern('a/b/c'));
});
test('checkGlobPattern: absolute rejected', () => {
  assert.throws(() => checkGlobPattern('/etc/passwd'), /relative/);
});
test('checkGlobPattern: parent escape rejected', () => {
  assert.throws(() => checkGlobPattern('../foo'), /escapes/);
  assert.throws(() => checkGlobPattern('a/../../b'), /escapes/);
});
test('checkGlobPattern: non-string rejected', () => {
  assert.throws(() => checkGlobPattern(123), /string/);
});

test('safePath: nested path inside root', () => {
  const root = tmpRoot();
  try {
    assert.equal(safePath('a/b.txt', root), path.join(root, 'a/b.txt'));
  } finally { cleanup(root); }
});
test('safePath: root itself', () => {
  const root = tmpRoot();
  try {
    assert.equal(safePath('.', root), root);
  } finally { cleanup(root); }
});
test('safePath: parent escape rejected', () => {
  const root = tmpRoot();
  try {
    assert.throws(() => safePath('../x', root), /escapes/);
    assert.throws(() => safePath('/etc/passwd', root), /escapes/);
  } finally { cleanup(root); }
});

test('readUtf8: valid file', () => {
  const root = tmpRoot();
  try {
    const p = path.join(root, 'f.txt');
    fs.writeFileSync(p, 'hello');
    assert.equal(readUtf8(p), 'hello');
  } finally { cleanup(root); }
});
test('readUtf8: invalid UTF-8 throws', () => {
  const root = tmpRoot();
  try {
    const p = path.join(root, 'f.bin');
    fs.writeFileSync(p, Buffer.from([0xff, 0xfe, 0xfd]));
    assert.throws(() => readUtf8(p), /invalid UTF-8/);
  } finally { cleanup(root); }
});
