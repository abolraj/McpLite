import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { run } from '../src/run.js';

function tmpRoot() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcplite-test-')));
}
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}
async function quietRun(root, stopOnError) {
  const orig = process.stderr.write;
  process.stderr.write = () => true;
  try {
    await run(root, stopOnError);
  } finally {
    process.stderr.write = orig;
  }
}

test('run: executes tasks and writes log', async () => {
  const root = tmpRoot();
  try {
    fs.writeFileSync(path.join(root, 'mcplite-tasks.json'), JSON.stringify([
      { id: 't1', tool: 'write', args: { path: 'out.txt', content: 'hi' } },
      { id: 't2', tool: 'read', args: { path: 'out.txt' } },
    ]));
    await quietRun(root, true);

    const log = JSON.parse(
      fs.readFileSync(path.join(root, 'mcplite-tasks-logs.json'), 'utf8'),
    );
    assert.equal(log.length, 1);
    assert.equal(log[0].total, 2);
    assert.equal(log[0].ok, true);
    assert.equal(log[0].results.length, 2);
    assert.equal(log[0].results[0].ok, true);
    assert.equal(log[0].results[1].ok, true);
    assert.equal(log[0].results[1].result.content, 'hi');
  } finally { cleanup(root); }
});

test('run: stopOnError halts on failure', async () => {
  const root = tmpRoot();
  try {
    fs.writeFileSync(path.join(root, 'mcplite-tasks.json'), JSON.stringify([
      { id: 't1', tool: 'read', args: { path: 'nope.txt' } },
      { id: 't2', tool: 'write', args: { path: 'out.txt', content: 'hi' } },
    ]));
    await quietRun(root, true);

    const log = JSON.parse(
      fs.readFileSync(path.join(root, 'mcplite-tasks-logs.json'), 'utf8'),
    );
    assert.equal(log[0].ok, false);
    assert.equal(log[0].results.length, 1);
    assert.equal(fs.existsSync(path.join(root, 'out.txt')), false);
  } finally { cleanup(root); }
});

test('run: empty array throws', async () => {
  const root = tmpRoot();
  try {
    fs.writeFileSync(path.join(root, 'mcplite-tasks.json'), '[]');
    await assert.rejects(quietRun(root, true), /no tasks/);
  } finally { cleanup(root); }
});

test('run: invalid JSON throws', async () => {
  const root = tmpRoot();
  try {
    fs.writeFileSync(path.join(root, 'mcplite-tasks.json'), 'not json');
    await assert.rejects(quietRun(root, true), /parse/);
  } finally { cleanup(root); }
});

test('run: missing id throws', async () => {
  const root = tmpRoot();
  try {
    fs.writeFileSync(path.join(root, 'mcplite-tasks.json'), JSON.stringify([
      { tool: 'read', args: { path: 'x' } },
    ]));
    await assert.rejects(quietRun(root, true), /id must be a string/);
  } finally { cleanup(root); }
});
