import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pad, truncate, fmtMs } from '../src/ui.js';

test('pad: shorter is right-padded', () => {
  assert.equal(pad('abc', 6), 'abc   ');
});
test('pad: exact unchanged', () => {
  assert.equal(pad('abcdef', 6), 'abcdef');
});
test('pad: longer is truncated to width', () => {
  assert.equal(pad('abcdefgh', 5), 'abcde');
});

test('truncate: shorter unchanged', () => {
  assert.equal(truncate('abc', 5), 'abc');
});
test('truncate: exact unchanged', () => {
  assert.equal(truncate('abcde', 5), 'abcde');
});
test('truncate: longer gets ellipsis', () => {
  assert.equal(truncate('abcdefg', 5), 'abcd…');
});

test('fmtMs: sub-second', () => {
  assert.equal(fmtMs(500), '500ms');
});
test('fmtMs: seconds', () => {
  assert.equal(fmtMs(2500), '2.50s');
});
test('fmtMs: minutes', () => {
  assert.equal(fmtMs(65000), '1m5s');
});
