import fs from 'node:fs';
import path from 'node:path';
import { GUIDE } from './guide.js';
import { c, sym, banner } from './ui.js';

export function init(root, force) {
  fs.mkdirSync(root, { recursive: true });
  process.stderr.write(banner('init', root));

  const write = (rel, content, allowSkip) => {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs) && allowSkip && !force) {
      process.stderr.write(
        `  ${c.yellow('○')} ${c.yellow('skip')}   ${c.dim(rel)} ${c.gray('· exists')}\n`
      );
      return;
    }
    fs.writeFileSync(abs, content);
    process.stderr.write(`  ${c.green(sym.ok)} ${c.green('wrote')}  ${rel}\n`);
  };

  write('mcplite-guide.md', GUIDE, true);
  write('mcplite-tasks.json', '[]\n', false);
  write('mcplite-tasks-logs.json', '[]\n', false);

  process.stderr.write(
    `\n  ${c.dim('next')} ${c.gray(sym.arrow)} ` +
      `paste a JSON batch into ${c.bold('mcplite-tasks.json')}, ` +
      `then run ${c.bold('mcplite run')}\n\n`
  );
}