#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const distRoot = path.resolve(process.cwd(), 'node_modules', 'rollup', 'dist');
const source = path.join(distRoot, 'es', 'shared', 'parseAst.js');
const target = path.join(distRoot, 'es', 'parseAst.js');

try {
  if (fs.existsSync(target)) {
    process.exit(0);
  }

  if (!fs.existsSync(source)) {
    console.warn('[ensure-rollup-parseAst] skip: expected source not found at', source);
    process.exit(0);
  }

  const contents = `export * from './shared/parseAst.js';\n`;
  fs.writeFileSync(target, contents, 'utf8');
  console.log('[ensure-rollup-parseAst] created', path.relative(process.cwd(), target));
} catch (error) {
  console.warn('[ensure-rollup-parseAst] failed to create shim:', error);
}
