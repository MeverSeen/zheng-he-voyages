// 生成单文件版本：node tools/build.mjs [--artifact 输出路径]
//   默认：dist/zheng-he-voyages-standalone.html —— 所有脚本、样式、数据都内联，可离线双击打开
//   --artifact：Leaflet 改从 cdnjs 加载，并去掉 <html>/<head>/<body> 外壳（用于 claude.ai Artifact 发布）
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const args = process.argv.slice(2);
const artifactOut = args[0] === '--artifact' ? args[1] : null;

let html = read('index.html');
const safeJs = (s) => s.replace(/<\/script/gi, '<\\/script');

html = html.replace(/<link rel="stylesheet" href="((?:vendor|css)\/[^"]+)">/g, (_, href) => `<style>\n${read(href)}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  if (src === 'vendor/leaflet/leaflet.js' && artifactOut) {
    return '<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>';
  }
  return `<script>\n${safeJs(read(src))}\n</script>`;
});

if (artifactOut) {
  html = html
    .replace(/<!doctype html>\s*/i, '')
    .replace(/<html[^>]*>\s*/i, '')
    .replace(/<\/html>\s*$/i, '')
    .replace(/<head>\s*/i, '')
    .replace(/<\/head>\s*/i, '')
    .replace(/<meta charset="utf-8">\s*/i, '')
    .replace(/<meta name="viewport"[^>]*>\s*/i, '')
    .replace(/<body>\s*/i, '')
    .replace(/<\/body>\s*/i, '');
  // <title> 必须出现在文件开头 8KB 以内
  const title = html.match(/<title>[^<]*<\/title>/)[0];
  html = title + '\n' + html.replace(title, '');
  fs.writeFileSync(artifactOut, html);
  console.log('artifact:', artifactOut, (html.length / 1024).toFixed(0) + ' KB');
} else {
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  const out = path.join(root, 'dist', 'zheng-he-voyages-standalone.html');
  fs.writeFileSync(out, html);
  console.log('standalone:', out, (html.length / 1024).toFixed(0) + ' KB');
}
