#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const clsxRoot = path.resolve(process.cwd(), 'node_modules', 'clsx');
const distDir = path.join(clsxRoot, 'dist');

const esmFile = path.join(distDir, 'clsx.mjs');
const cjsFile = path.join(distDir, 'clsx.js');

const esmSource = `function toValue(mix) {\n  if (mix === null || mix === undefined) {\n    return '';\n  }\n\n  if (typeof mix === 'string' || typeof mix === 'number') {\n    return String(mix);\n  }\n\n  if (Array.isArray(mix)) {\n    let str = '';\n    for (let i = 0; i < mix.length; i++) {\n      const value = toValue(mix[i]);\n      if (value) {\n        str && (str += ' ');\n        str += value;\n      }\n    }\n    return str;\n  }\n\n  if (typeof mix === 'object') {\n    let str = '';\n    for (const key in mix) {\n      if (Object.prototype.hasOwnProperty.call(mix, key) && mix[key]) {\n        str && (str += ' ');\n        str += key;\n      }\n    }\n    return str;\n  }\n\n  return '';\n}\n\nfunction clsx(...inputs) {\n  let str = '';\n  for (let i = 0; i < inputs.length; i++) {\n    const value = toValue(inputs[i]);\n    if (value) {\n      str && (str += ' ');\n      str += value;\n    }\n  }\n  return str;\n}\n\nexport { clsx };\nexport default clsx;\n`;

const cjsSource = `function toValue(mix) {\n  if (mix === null || mix === undefined) {\n    return '';\n  }\n\n  if (typeof mix === 'string' || typeof mix === 'number') {\n    return String(mix);\n  }\n\n  if (Array.isArray(mix)) {\n    var str = '';\n    for (var i = 0; i < mix.length; i++) {\n      var value = toValue(mix[i]);\n      if (value) {\n        str && (str += ' ');\n        str += value;\n      }\n    }\n    return str;\n  }\n\n  if (typeof mix === 'object') {\n    var str = '';\n    for (var key in mix) {\n      if (Object.prototype.hasOwnProperty.call(mix, key) && mix[key]) {\n        str && (str += ' ');\n        str += key;\n      }\n    }\n    return str;\n  }\n\n  return '';\n}\n\nfunction clsx() {\n  var str = '';\n  for (var i = 0; i < arguments.length; i++) {\n    var value = toValue(arguments[i]);\n    if (value) {\n      str && (str += ' ');\n      str += value;\n    }\n  }\n  return str;\n}\n\nmodule.exports = clsx;\nmodule.exports.clsx = clsx;\nmodule.exports.default = clsx;\n`;

try {
  if (!fs.existsSync(clsxRoot)) {
    console.warn('[ensure-clsx-dist] clsx package not installed');
    process.exit(0);
  }

  fs.mkdirSync(distDir, { recursive: true });

  if (!fs.existsSync(esmFile)) {
    fs.writeFileSync(esmFile, esmSource, 'utf8');
    console.log('[ensure-clsx-dist] created', path.relative(process.cwd(), esmFile));
  }

  if (!fs.existsSync(cjsFile)) {
    fs.writeFileSync(cjsFile, cjsSource, 'utf8');
    console.log('[ensure-clsx-dist] created', path.relative(process.cwd(), cjsFile));
  }
} catch (error) {
  console.warn('[ensure-clsx-dist] failed to ensure clsx runtime files:', error);
}
