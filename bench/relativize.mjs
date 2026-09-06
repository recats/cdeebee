// vitest --outputJson records absolute file paths; keep the committed baseline machine-independent.
import { readFileSync, writeFileSync } from 'node:fs';
import { relative, isAbsolute } from 'node:path';
import process from 'node:process';

const file = process.argv[2] ?? 'bench/baseline.json';
const baseline = JSON.parse(readFileSync(file, 'utf8'));
for (const entry of baseline.files ?? []) {
  if (isAbsolute(entry.filepath)) entry.filepath = relative(process.cwd(), entry.filepath).split('\\').join('/');
}
writeFileSync(file, `${JSON.stringify(baseline, null, 2)}\n`);
