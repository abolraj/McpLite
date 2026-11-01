import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import fg from 'fast-glob';
import {
  safePath,
  checkGlobPattern,
  readUtf8,
  splitLines,
  countOccurrences,
} from './utils.js';

export async function dispatch(tool, rawArgs, root) {
  const args =
    rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs) ? rawArgs : {};

  switch (tool) {
    case 'bash':  return bash(args, root);
    case 'read':  return read(args, root);
    case 'write': return write(args, root);
    case 'edit':  return edit(args, root);
    case 'glob':  return glob(args, root);
    case 'grep':  return grep(args, root);
    default:      throw new Error(`unknown tool \`${tool}\``);
  }
}

// ── bash ────────────────────────────────────────────────────────────────────
function bash(args, root) {
  const cmd = args.command;
  if (typeof cmd !== 'string') throw new Error('command required');
  const cwd = typeof args.cwd === 'string' ? safePath(args.cwd, root) : root;
  const timeoutMs = typeof args.timeout === 'number' ? args.timeout : 60_000;

  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', cmd], { cwd });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });

    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`failed to spawn: ${e.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code === null ? -1 : code,
        stdout,
        stderr,
        timedOut,
        timeoutMs,
      });
    });
  });
}

// ── read ────────────────────────────────────────────────────────────────────
function read(args, root) {
  const p = args.path;
  if (typeof p !== 'string') throw new Error('path required');
  const offset =
    typeof args.offset === 'number' ? Math.max(0, Math.floor(args.offset)) : 0;
  const limit =
    typeof args.limit === 'number' ? Math.max(0, Math.floor(args.limit)) : undefined;

  const abs = safePath(p, root);
  const content = readUtf8(abs);
  const lines = splitLines(content);

  const start = Math.min(offset, lines.length);
  const end = limit === undefined ? lines.length : Math.min(offset + limit, lines.length);

  return {
    path: p,
    totalLines: lines.length,
    offset,
    content: lines.slice(start, end).join('\n'),
  };
}

// ── write ───────────────────────────────────────────────────────────────────
function write(args, root) {
  const p = args.path;
  if (typeof p !== 'string') throw new Error('path required');
  const content = args.content;
  if (typeof content !== 'string') throw new Error('content required');

  const abs = safePath(p, root);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);

  return { path: p, bytes: Buffer.byteLength(content, 'utf8') };
}

// ── edit ────────────────────────────────────────────────────────────────────
function edit(args, root) {
  const p = args.path;
  if (typeof p !== 'string') throw new Error('path required');
  const oldStr = args.old_string;
  if (typeof oldStr !== 'string') throw new Error('old_string required');
  if (oldStr === '') throw new Error('old_string must not be empty');
  const newStr = args.new_string;
  if (typeof newStr !== 'string') throw new Error('new_string required');
  const replaceAll = args.replace_all === true;

  const abs = safePath(p, root);
  const content = readUtf8(abs);

  const count = countOccurrences(content, oldStr);
  if (count === 0) throw new Error(`old_string not found in ${p}`);
  if (count > 1 && !replaceAll) {
    throw new Error(`old_string appears ${count} times — use replace_all`);
  }

  const next = replaceAll
    ? content.split(oldStr).join(newStr)
    : content.slice(0, content.indexOf(oldStr)) +
      newStr +
      content.slice(content.indexOf(oldStr) + oldStr.length);

  fs.writeFileSync(abs, next);
  return { path: p, replacements: replaceAll ? count : 1 };
}

// ── glob ────────────────────────────────────────────────────────────────────
async function glob(args, root) {
  const pattern = typeof args.pattern === 'string' ? args.pattern : '**/*';
  checkGlobPattern(pattern);

  const entries = await fg(pattern, {
    cwd: root,
    onlyFiles: true,
    dot: true,
    absolute: false,
  });

  const files = entries.map((e) => e.replace(/\\/g, '/')).sort();
  return { pattern, count: files.length, files };
}

// ── grep ────────────────────────────────────────────────────────────────────
async function grep(args, root) {
  const pattern = args.pattern;
  if (typeof pattern !== 'string') throw new Error('pattern required');
  const base = typeof args.path === 'string' ? args.path : '.';
  const globPat = typeof args.glob === 'string' ? args.glob : '**/*';
  const ignoreCase = args.ignore_case === true;

  const baseAbs = safePath(base, root);
  checkGlobPattern(globPat);

  let re;
  try {
    re = new RegExp(pattern, ignoreCase ? 'i' : '');
  } catch (e) {
    throw new Error(`invalid regex: ${e.message}`);
  }

  const entries = await fg(globPat, {
    cwd: baseAbs,
    onlyFiles: true,
    dot: true,
    absolute: false,
  });

  const hits = [];
  for (const entry of entries) {
    const abs = path.join(baseAbs, entry);
    let content;
    try {
      content = readUtf8(abs);
    } catch {
      continue; // skip binaries / unreadables — matches "read_to_string ok" gate in Rust
    }
    const lines = splitLines(content);
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        hits.push({
          file: path.relative(root, abs).replace(/\\/g, '/'),
          line: i + 1,
          text: lines[i].slice(0, 300),
        });
      }
    }
  }

  return { pattern, count: hits.length, hits };
}