// src/ui.js — tiny ANSI helpers, no deps.
// Respects NO_COLOR / FORCE_COLOR / TTY detection.
const isTTY = process.stdout.isTTY === true || process.stderr.isTTY === true;
const useColor =
  process.env.FORCE_COLOR === '1' ||
  (process.env.FORCE_COLOR !== '0' && !process.env.NO_COLOR && isTTY);

const wrap = (open, close) => (s) =>
  useColor ? `\x1b[${open}m${s}\x1b[${close}m` : String(s);

export const c = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  cyan: wrap(36, 39),
  gray: wrap(90, 39),
};

// ✓/✗/› render fine even without color; keep them consistent.
export const sym = { ok: '✓', fail: '✗', run: '›', arrow: '→', dot: '·' };

export function fmtMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`;
}

// Pad plain strings — call BEFORE applying color codes.
export function pad(s, n) {
  s = String(s);
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

export function truncate(s, n) {
  s = String(s);
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

// Block banner at the top of `init` / `run`.
export function banner(cmd, root, extra = {}) {
  const lines = [
    `${c.cyan('▶')} ${c.bold('mcplite')} ${c.gray('·')} ${c.cyan(cmd)}`,
    `  ${c.dim('root')}  ${root}`,
  ];
  if (extra.tasks !== undefined) {
    lines.push(`  ${c.dim('tasks')} ${extra.tasks}`);
  }
  lines.push('');
  return lines.join('\n') + '\n';
}

// Horizontal rule that looks the same in every terminal width.
export function rule(width = 56) {
  return c.gray('  ' + '─'.repeat(width));
}