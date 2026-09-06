import assert from 'node:assert/strict';
import process from 'node:process';
import console from 'node:console';
import { execFileSync } from 'node:child_process';
import { accessSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { URL } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const temporary = mkdtempSync(join(tmpdir(), 'cdeebee-package-'));
try {
  execFileSync('pnpm', ['pack', '--pack-destination', temporary], { stdio: 'pipe' });
  const archive = readdirSync(temporary).find(name => name.endsWith('.tgz'));
  assert.ok(archive, 'pnpm pack must produce a package');
  const packageDirectory = join(temporary, 'node_modules', '@recats', 'cdeebee');
  mkdirSync(packageDirectory, { recursive: true });
  execFileSync('tar', ['-xzf', join(temporary, archive), '-C', packageDirectory, '--strip-components=1']);
  const manifest = JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8'));
  for (const entry of Object.values(manifest.exports)) {
    accessSync(join(packageDirectory, entry.types));
    accessSync(join(packageDirectory, entry.import.default));
    accessSync(join(packageDirectory, entry.require.default));
  }
  const check = (specifier, format) => {
    const filename = join(temporary, `consumer.${format}`);
    const load = format === 'mjs' ? `import * as db from '${specifier}';` : `const db = require('${specifier}');`;
    writeFileSync(filename, `${load}
      const store = db.createCdeebee({ fetch: {}, primaryKeyList: { userList: 'userID' } });
      store.setEntity('userList', 1, { name: 'Ada' });
      if (store.getState().storage.userList[1].name !== 'Ada') throw new Error('store smoke check failed');
      if (typeof db.queryQueue !== 'function') throw new Error('plugin export missing');
      ${specifier.endsWith('/core') ? '' : "if (typeof db.createCdeebeeHooks !== 'function') throw new Error('React export missing');"}
    `);
    execFileSync(process.execPath, [filename], { cwd: temporary, stdio: 'pipe', env: { ...process.env, NODE_PATH: '' } });
  };
  const checkTypes = fileList => {
    for (const file of fileList) copyFileSync(new URL(`./fixtures/${file}`, import.meta.url), join(temporary, file));
    writeFileSync(join(temporary, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        strict: true, noEmit: true, skipLibCheck: false,
        target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
        lib: ['ES2022', 'DOM'], types: [],
      },
      files: fileList,
    }));
    execFileSync('pnpm', ['exec', 'tsc', '--project', join(temporary, 'tsconfig.json')], { stdio: 'inherit' });
  };
  // A packed core consumer must work without React installed.
  check('@recats/cdeebee/core', 'mjs');
  check('@recats/cdeebee/core', 'cjs');
  checkTypes(['core.ts']);
  symlinkSync(dirname(require.resolve('react/package.json')), join(temporary, 'node_modules', 'react'), 'dir');
  check('@recats/cdeebee', 'mjs');
  check('@recats/cdeebee', 'cjs');
  checkTypes(['core.ts', 'react.ts']);
  console.log('Packed ESM/CJS entry points, strict consumer types, and React-free core passed.');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
