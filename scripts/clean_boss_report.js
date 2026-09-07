#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname,'..');
const inPath = path.join(repo,'reports','bosses_extracted.json');
const outPath = path.join(repo,'reports','bosses_extracted_clean.json');

let arr;
try{ arr = JSON.parse(fs.readFileSync(inPath,'utf8')); }catch(e){ console.error('读取 boss 报表失败:', e.message); process.exit(1); }

const cleaned = arr.map(item => {
  const block = (item.block||[]).filter(l=> !!l && !/^```/.test(l));
  const interesting = block.filter(l=> /阶段|Phase|Stage|技能|释放|普攻|被动|冷却/.test(l));
  return { anchor: item.anchorLine, interesting: interesting.slice(0,20), rawCount: block.length };
});

fs.writeFileSync(outPath, JSON.stringify(cleaned,null,2),'utf8');
console.log('已生成清洗后的 Boss 报表:', outPath);
