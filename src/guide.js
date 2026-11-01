import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const guidePath = fileURLToPath(new URL('./guide.md', import.meta.url));
export const GUIDE = fs.readFileSync(guidePath, 'utf8');