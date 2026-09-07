#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

// Usage: node merge_v5_names.js names.json
const repoRoot = path.resolve(__dirname, '..');
const v5Path = path.join(repoRoot, 'v5_full.json');
const namesPath = process.argv[2] ? path.resolve(process.argv[2]) : null;

if (!namesPath || !fs.existsSync(namesPath)) {
  console.error('请提供名称映射 JSON 文件路径，例如: node merge_v5_names.js v5_names.json');
  process.exit(1);
}
if (!fs.existsSync(v5Path)) {
  console.error('未找到 v5_full.json');
  process.exit(1);
}

let v5;
try { v5 = JSON.parse(fs.readFileSync(v5Path, 'utf8')); } catch (e) { console.error('解析 v5_full.json 失败:', e.message); process.exit(1); }
let names;
try { names = JSON.parse(fs.readFileSync(namesPath, 'utf8')); } catch (e) { console.error('解析 names 文件失败:', e.message); process.exit(1); }

const map = {};
if (Array.isArray(names)) {
  // array of objects with id field
  names.forEach(n => { if (n && n.id) map[n.id] = n; });
} else if (typeof names === 'object') {
  // object mapping id -> {name:..}
  Object.keys(names).forEach(k => { map[k] = names[k]; });
}

let updated = 0;
v5.characters = v5.characters.map(ch => {
  if (!ch || !ch.id) return ch;
  const r = map[ch.id];
  if (r) {
    updated++;
    return Object.assign({}, ch, r);
  }
  return ch;
});

// backup original
const bakPath = v5Path + '.bak.' + Date.now();
fs.copyFileSync(v5Path, bakPath);
fs.writeFileSync(path.join(repoRoot, 'v5_full.merged.json'), JSON.stringify(v5, null, 2), 'utf8');
console.log('已合并', updated, '个角色条目。备份写入：', bakPath);

// regenerate js/v5data.js by invoking existing import script
try {
  const importScript = path.join(repoRoot, 'scripts', 'import_v5.js');
  cp.execFileSync(process.execPath, [importScript, path.join(repoRoot, 'v5_full.merged.json')], { stdio: 'inherit' });
  console.log('已使用合并后的数据生成 js/v5data.js');
} catch (e) {
  console.error('执行 import_v5 失败:', e.message);
  process.exit(1);
}

process.exit(0);
