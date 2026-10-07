#!/usr/bin/env node
/* =====================================================================
   tools/build-solar.mjs — 打包自包含单文件 dist/solar-system.html
   - three 模块 → import map 里的 data: URL（无需网络、无需 CDN）
   - 地球 / 月球贴图 → data URL，注入 window.TEX_URLS
   - main.js 内联为 <script type="module">
   用法： node tools/build-solar.mjs
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const three = fs.readFileSync(path.join(ROOT, 'lib/three.module.min.js'), 'utf8');
let main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const earth = fs.readFileSync(path.join(ROOT, 'tex/earth.jpg')).toString('base64');
const moon = fs.readFileSync(path.join(ROOT, 'tex/moon.jpg')).toString('base64');

// 贴图路径改为运行时注入的 data URL
main = main.replace("loader.load('tex/earth.jpg'", "loader.load(TEX_URLS.earth");
main = main.replace("loader.load('tex/moon.jpg'", "loader.load(TEX_URLS.moon)");
if (!/TEX_URLS\.earth/.test(main)) throw new Error('main.js 里找不到贴图加载点');

const importMap =
  '<script type="importmap">\n{ "imports": { "three": "data:text/javascript;base64,' +
  Buffer.from(three).toString('base64') +
  '" } }\n</script>';
const texBoot =
  '<script>window.TEX_URLS = {\n' +
  "  earth: 'data:image/jpeg;base64," + earth + "',\n" +
  "  moon: 'data:image/jpeg;base64," + moon + "'\n" +
  '};\n</script>';
const mainTag = '<script type="module">\n' + main + '\n</script>';

html = html.replace('</head>', importMap + '\n' + texBoot + '\n</head>');
html = html.replace('<script type="module" src="main.js"></script>', mainTag);
html = '<!-- 由 tools/build-solar.mjs 自动生成，请勿直接修改。源码见 ../index.html 与 ../main.js -->\n' + html;

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist/solar-system.html');
fs.writeFileSync(out, html);
console.log('打包完成 → dist/solar-system.html  (' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB)');
