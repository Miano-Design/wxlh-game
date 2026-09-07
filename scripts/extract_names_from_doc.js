#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const docPath = path.resolve(process.cwd(), '..', 'V5.0《完整内容数据库》');
const outPath = path.join(process.cwd(), 'v5_names_extracted.json');

if (!fs.existsSync(docPath)) {
  console.error('文档未找到：', docPath);
  process.exit(1);
}
const raw = fs.readFileSync(docPath, 'utf8');
const lines = raw.split(/\r?\n/);

const rows = [];
const rowRe = /^\|\s*(C0\d{2})\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|?$/;
for (let i=0;i<lines.length;i++){
  const m = lines[i].match(rowRe);
  if (m) {
    const id = m[1].trim();
    const name = m[2].trim();
    const faction = m[3].trim();
    const bloodline = m[4].trim();
    const role = m[5].trim();
    rows.push({ id, name, faction, bloodline, role });
  }
}

fs.writeFileSync(outPath, JSON.stringify(rows, null, 2), 'utf8');
console.log('提取完成，条目数：', rows.length, '输出：', outPath);
process.exit(0);
