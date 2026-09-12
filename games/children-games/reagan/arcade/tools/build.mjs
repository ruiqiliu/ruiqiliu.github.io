#!/usr/bin/env node
/* =====================================================================
   tools/build.mjs — 打包成单文件
   把 index.html + css 目录 + js 目录里的所有模块，内联成 dist/arcade.html。

   为什么需要这一步：
   源码是「ES module + 多个 css」的多文件结构，站着看很清爽，
   但要么用本地服务器打开，要么就得打包。打包后的 dist/arcade.html
   是自包含的，双击就能玩，也可以直接丢进任何预览面板。

   打包方式：给每个模块包一层工厂函数，用一个小小的 __req 模拟模块系统。
   因为源码风格很规矩（具名导出、单行 import），逐行改写就够用了。

   用法： node tools/build.mjs
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ENTRY = 'js/main.js';
const OUTPUT = 'dist/arcade.html';

/** id → 改写后的模块代码。id 是相对项目根的 posix 路径 */
const modules = new Map();

function resolveId(fromId, spec) {
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromId), spec));
}

/**
 * 把一份 ES module 改写成「工厂函数体」：
 *   import {a} from './x.js'  →  const {a} = __req('.../x.js')
 *   export const a = ...      →  const a = ...           (+ 末尾统一挂到 exports)
 *   import * as ns            →  const ns = __req(...)
 */
function transform(src, id, deps) {
  const out = [];
  const exported = [];

  src.split('\n').forEach((line, i) => {
    const t = line.trim();
    if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) {
      out.push(line);
      return;
    }

    let m;

    if ((m = t.match(/^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?$/))) {
      const dep = resolveId(id, m[2]);
      deps.push(dep);
      const names = m[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((spec) => {
          const parts = spec.split(/\s+as\s+/);
          return parts[1] ? parts[0] + ': ' + parts[1] : parts[0];
        });
      out.push('const { ' + names.join(', ') + ' } = __req(' + JSON.stringify(dep) + ');');
      return;
    }

    if ((m = t.match(/^import\s*\*\s*as\s+([A-Za-z0-9_$]+)\s*from\s*['"]([^'"]+)['"];?$/))) {
      const dep = resolveId(id, m[2]);
      deps.push(dep);
      out.push('const ' + m[1] + ' = __req(' + JSON.stringify(dep) + ');');
      return;
    }

    if ((m = t.match(/^import\s*['"]([^'"]+)['"];?$/))) {
      const dep = resolveId(id, m[1]);
      deps.push(dep);
      out.push('__req(' + JSON.stringify(dep) + ');');
      return;
    }

    if ((m = t.match(/^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/))) {
      exported.push(m[1]);
      out.push(line.replace(/^(\s*)export\s+/, '$1'));
      return;
    }

    if (/^export\b/.test(t)) {
      throw new Error('build: 不支持的 export 写法 → ' + id + ':' + (i + 1) + '  ' + t);
    }
    if (/^import\b/.test(t)) {
      throw new Error('build: 不支持的 import 写法 → ' + id + ':' + (i + 1) + '  ' + t);
    }

    out.push(line);
  });

  if (exported.length) out.push('\nObject.assign(exports, { ' + exported.join(', ') + ' });');
  return out.join('\n');
}

function collect(id) {
  if (modules.has(id)) return;
  const src = fs.readFileSync(path.join(ROOT, id), 'utf8');
  const deps = [];
  const code = transform(src, id, deps);
  modules.set(id, code);
  deps.forEach(collect);
}

function bundle() {
  const parts = [
    '(function () {',
    "'use strict';",
    'const __factories = {};',
    'const __cache = {};',
    'function __req(id) {',
    '  if (__cache[id]) return __cache[id].exports;',
    '  const module = (__cache[id] = { exports: {} });',
    '  __factories[id](module.exports, module);',
    '  return module.exports;',
    '}'
  ];

  for (const [id, code] of modules) {
    parts.push('__factories[' + JSON.stringify(id) + '] = function (exports) {\n' + code + '\n};');
  }

  parts.push('__req(' + JSON.stringify(ENTRY) + ');');
  parts.push('})();');
  return parts.join('\n');
}

/* ---------------- 走起 ---------------- */

collect(ENTRY);

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let cssCount = 0;
html = html.replace(/<link rel="stylesheet" href="([^"]+)"\s*\/?>/g, (_, href) => {
  cssCount++;
  const css = fs.readFileSync(path.join(ROOT, href), 'utf8').trim();
  return '<style>\n' + css + '\n</style>';
});

if (!/<script type="module" src="[^"]+"><\/script>/.test(html)) {
  throw new Error('build: index.html 里找不到 <script type="module" src="...">');
}
html = html.replace(
  /<script type="module" src="[^"]+"><\/script>/,
  '<script>\n' + bundle() + '\n</script>'
);

html = '<!-- 由 tools/build.mjs 自动生成，请勿直接修改。源码见 ../index.html 与 ../js/、../css/ -->\n' + html;

const outPath = path.join(ROOT, OUTPUT);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log('打包完成 → ' + OUTPUT + '  (' + modules.size + ' 个 js 模块, ' + cssCount + ' 个 css, ' + kb + ' KB)');
