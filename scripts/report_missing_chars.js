#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const src = path.join(repoRoot, 'v5_full.json');
const outDir = path.join(repoRoot, 'reports');

if (!fs.existsSync(src)) {
  console.error('未找到 v5_full.json，无法生成报表。');
  process.exit(1);
}

const raw = fs.readFileSync(src, 'utf8');
let data;
try { data = JSON.parse(raw); } catch (e) { console.error('解析 v5_full.json 失败:', e.message); process.exit(1); }

const chars = Array.isArray(data.characters) ? data.characters : [];
const missing = chars.filter(c => {
  if (!c || !c.name) return true;
  if (/^角色\d+$/.test(c.name)) return true;
  if (c.name === '未知') return true;
  return false;
});

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
const outPath = path.join(outDir, 'missing_characters.json');
fs.writeFileSync(outPath, JSON.stringify(missing, null, 2), 'utf8');

console.log('缺失角色名数量：', missing.length);
missing.forEach(c => console.log(c.id, '|', c.name, '|', c.role || '—'));
console.log('\n已写入：', outPath);
process.exit(0);
