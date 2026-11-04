import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
for(const page of ['index','voyages','fleet']) {
  const html=fs.readFileSync(new URL('../dist/'+page+'.html',import.meta.url),'utf8');
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length>0);
  for(const m of scripts)new vm.Script(m[1],{filename:page});
  assert.ok(!/<script[^>]+(?:src=|type="module")/.test(html),page+' must inline executable scripts');
  assert.ok(!/<link[^>]+rel="stylesheet"/.test(html),page+' must inline styles');
  assert.ok(html.endsWith('</html>\n'));
  console.log(page+': inline scripts parse; no external script/style dependencies');
}
