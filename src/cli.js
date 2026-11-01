import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { init } from './init.js';
import { run } from './run.js';

const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

export async function main(argv) {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') {
    printHelp();
    return;
  }
  if (cmd === '-V' || cmd === '--version') {
    console.log(pkg.version);
    return;
  }

  switch (cmd) {
    case 'init': {
      const { root, force } = parseInitArgs(rest);
      const r = resolveRoot(root);
      init(r, force);
      return;
    }
    case 'run': {
      const { root, stopOnError } = parseRunArgs(rest);
      const r = resolveRoot(root);
      await run(r, stopOnError);
      return;
    }
    default:
      throw new Error(`unknown command \`${cmd}\` (try \`mcplite --help\`)`);
  }
}

import { c } from './ui.js';

function printHelp() {
  const h = (s) => c.cyan(c.bold(s));
  const cmd = (name, desc) =>
    `  ${c.green(name.padEnd(6))} ${desc}`;
  console.log(
    `${c.cyan('▶')} ${c.bold('mcplite')} ${c.dim(`v${pkg.version}`)} ${c.gray('·')} ${pkg.description}

${h('USAGE')}
  mcplite <COMMAND> [OPTIONS]

${h('COMMANDS')}
${cmd('init', 'Scaffold guide, tasks and logs into the project root')}
${cmd('run', 'Execute tasks from mcplite-tasks.json and append to the log')}
${cmd('help', 'Show this message')}

${h('OPTIONS')}
  ${c.green('--root <DIR>')}            Project directory (defaults to cwd)
  ${c.green('--force')}                 ${c.dim('init only')} — overwrite existing files
  ${c.green('--stop-on-error <BOOL>')}  ${c.dim('run only')}  — default ${c.bold('true')}
  ${c.green('-h, --help')}              Show help
  ${c.green('-V, --version')}           Print version

${h('EXAMPLES')}
  ${c.dim('$')} mcplite init
  ${c.dim('$')} mcplite run
  ${c.dim('$')} mcplite run --stop-on-error false
`);
}

function parseInitArgs(rest) {
  const out = { root: undefined, force: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--root') {
      out.root = rest[++i];
      if (!out.root) throw new Error('--root requires a value');
    } else if (a.startsWith('--root=')) {
      out.root = a.slice('--root='.length);
    } else if (a === '--force') {
      out.force = true;
    } else if (a === '-h' || a === '--help') {
      console.log('Usage: mcplite init [--root <DIR>] [--force]');
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${a}`);
    }
  }
  return out;
}

function parseRunArgs(rest) {
  const out = { root: undefined, stopOnError: true };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--root') {
      out.root = rest[++i];
      if (!out.root) throw new Error('--root requires a value');
    } else if (a.startsWith('--root=')) {
      out.root = a.slice('--root='.length);
    } else if (a === '--stop-on-error') {
      const v = rest[++i];
      if (v === undefined) throw new Error('--stop-on-error requires true or false');
      out.stopOnError = parseBool(v);
    } else if (a.startsWith('--stop-on-error=')) {
      out.stopOnError = parseBool(a.slice('--stop-on-error='.length));
    } else if (a === '-h' || a === '--help') {
      console.log('Usage: mcplite run [--root <DIR>] [--stop-on-error <BOOL>]');
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${a}`);
    }
  }
  return out;
}

function parseBool(s) {
  if (s === 'true') return true;
  if (s === 'false') return false;
  throw new Error(`expected true or false, got \`${s}\``);
}

function resolveRoot(rootArg) {
  const p = rootArg || process.cwd();
  const abs = fs.realpathSync(path.resolve(p)); // realpath errors if missing — same as Rust canonicalize
  if (!fs.statSync(abs).isDirectory()) {
    throw new Error(`root is not a directory: ${abs}`);
  }
  return abs;
}