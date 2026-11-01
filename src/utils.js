import fs from 'node:fs';
import path from 'node:path';

/** Rust's `str::lines()` semantics: split on \n / \r\n, drop a single trailing terminator. */
export function splitLines(s) {
  if (s === '') return [];
  let content = s;
  if (content.endsWith('\r\n')) content = content.slice(0, -2);
  else if (content.endsWith('\n')) content = content.slice(0, -1);
  return content.split(/\r\n|\n/);
}

/**
 * Resolve a caller-supplied path against `root`, guarantee containment, and return
 * the lexically-normalized absolute path (works for files that don't exist yet).
 */
export function safePath(p, root) {
  if (typeof p !== 'string') throw new Error('path must be a string');
  const abs = path.resolve(root, p);

  // Try to canonicalize (resolves symlinks) for existing paths.
  let canon = abs;
  try {
    canon = fs.realpathSync(abs);
  } catch {
    // doesn't exist yet — lexical path is authoritative
  }

  const rel = path.relative(root, canon);
  if (rel === '') return abs; // exactly the root itself
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
    throw new Error(`path escapes root: ${p}`);
  }
  return abs;
}

/** Reject glob patterns that would walk outside root. */
export function checkGlobPattern(pattern) {
  if (typeof pattern !== 'string') throw new Error('pattern must be a string');
  if (path.isAbsolute(pattern)) throw new Error('pattern must be relative');
  if (pattern.split(/[\\/]/).includes('..')) throw new Error('pattern escapes root');
}

/** Read a file as strict UTF-8 (fatal on bad bytes, preserves BOM). */
export function readUtf8(p) {
  const buf = fs.readFileSync(p);
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buf);
  } catch {
    throw new Error(`invalid UTF-8 in ${p}`);
  }
}

/** Non-overlapping occurrence count (matches Rust's `str::matches().count()`). */
export function countOccurrences(haystack, needle) {
  if (needle === '') return 0;
  let count = 0;
  let i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) {
    count++;
    i += needle.length;
  }
  return count;
}