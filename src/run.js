import fs from 'node:fs';
import path from 'node:path';
import { dispatch } from './tools.js';
import { c, sym, pad, truncate, fmtMs, banner, rule } from './ui.js';

export async function run(root, stopOnError) {
  const tasksPath = path.join(root, 'mcplite-tasks.json');
  const logsPath = path.join(root, 'mcplite-tasks-logs.json');

  const raw = fs.readFileSync(tasksPath, 'utf8');
  let tasks;
  try {
    tasks = JSON.parse(raw);
  } catch (e) {
    throw new Error(`parse mcplite-tasks.json: ${e.message}`);
  }
  if (!Array.isArray(tasks)) {
    throw new Error('mcplite-tasks.json must be a JSON array');
  }
  for (const t of tasks) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) {
      throw new Error('each task must be an object with {id, tool, args}');
    }
    if (typeof t.id !== 'string') throw new Error('task.id must be a string');
    if (typeof t.tool !== 'string') throw new Error(`task ${t.id}: tool must be a string`);
    if (t.label !== undefined && typeof t.label !== 'string') {
      throw new Error(`task ${t.id}: label must be a string if present`);
    }
  }
  if (tasks.length === 0) {
    throw new Error('mcplite-tasks.json contains no tasks');
  }

  process.stderr.write(banner('run', root, { tasks: tasks.length }));

  const results = [];
  const batchStart = Date.now();

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const label = (task.label && task.label.trim()) || task.id;
    const idx = pad(`[${i + 1}/${tasks.length}]`, 7);
    const lbl = pad(truncate(label, 46), 46);

    process.stderr.write(
      `  ${c.cyan(sym.run)} ${c.gray(idx)} ${c.bold(lbl)} ${c.dim(task.tool)}\n`
    );

    const started = Date.now();
    try {
      const value = await dispatch(task.tool, task.args, root);
      const ms = Date.now() - started;
      results.push({
        id: task.id,
        tool: task.tool,
        ...(task.label ? { label: task.label } : {}),
        ok: true,
        duration_ms: ms,
        result: value,
      });
      process.stderr.write(
        `    ${c.green(sym.ok)} ${c.green('done')} ${c.gray(sym.dot)} ${c.dim(fmtMs(ms))}\n`
      );
    } catch (e) {
      const ms = Date.now() - started;
      results.push({
        id: task.id,
        tool: task.tool,
        ...(task.label ? { label: task.label } : {}),
        ok: false,
        duration_ms: ms,
        error: e.message,
      });
      process.stderr.write(
        `    ${c.red(sym.fail)} ${c.red('failed')} ${c.gray(sym.dot)} ${c.dim(fmtMs(ms))}\n`
      );
      process.stderr.write(`      ${c.gray('└─')} ${c.red(e.message)}\n`);

      if (stopOnError) {
        const remaining = tasks.length - (i + 1);
        if (remaining > 0) {
          process.stderr.write(
            `    ${c.yellow('!')} ${c.yellow(
              `stopped early · ${remaining} task${remaining === 1 ? '' : 's'} skipped`
            )}\n`
          );
        }
        break;
      }
    }
  }

  const totalMs = Date.now() - batchStart;
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  // ── summary ────────────────────────────────────────────────────────────────
  process.stderr.write('\n' + rule() + '\n');

  if (failed === 0) {
    process.stderr.write(
      `  ${c.green(sym.ok)} ${c.green(`${passed} passed`)}  ${c.gray(sym.dot)}  ` +
        `${c.dim(`${results.length}/${tasks.length} tasks`)}  ${c.gray(sym.dot)}  ` +
        `${c.dim(fmtMs(totalMs))}\n`
    );
  } else {
    process.stderr.write(
      `  ${c.green(sym.ok)} ${c.green(`${passed} passed`)}   ` +
        `${c.red(sym.fail)} ${c.red(`${failed} failed`)}  ${c.gray(sym.dot)}  ` +
        `${c.dim(`${results.length}/${tasks.length} tasks`)}  ${c.gray(sym.dot)}  ` +
        `${c.dim(fmtMs(totalMs))}\n`
    );
    for (const r of results.filter((x) => !x.ok)) {
      const name = r.label ? truncate(r.label, 40) : r.id;
      process.stderr.write(
        `    ${c.red(sym.fail)} ${c.bold(name)}  ${c.gray(sym.arrow)}  ${c.red(r.error)}\n`
      );
    }
  }
  process.stderr.write(`  ${c.gray('📄')} ${c.dim(logsPath)}\n\n`);

  // ── append log ─────────────────────────────────────────────────────────────
  const log = {
    timestamp: String(Math.floor(Date.now() / 1000)),
    root,
    total: tasks.length,
    ok: results.every((r) => r.ok),
    results,
  };

  let allLogs = [];
  if (fs.existsSync(logsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
      if (Array.isArray(parsed)) allLogs = parsed;
    } catch {
      // corrupt log → reset
    }
  }
  allLogs.push(log);
  fs.writeFileSync(logsPath, JSON.stringify(allLogs, null, 2));
}