#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const repo = path.resolve(__dirname,'..');
const v5Path = path.join(repo,'v5_full.merged.auto.updated.json');
const refinedPath = path.join(repo,'data','equip_template.generated.refined.json');
const outPath = path.join(repo,'v5_full.merged.auto.refinedmerged.json');

function read(p){ try{ return JSON.parse(fs.readFileSync(p,'utf8')); }catch(e){ return null; } }
const v5 = read(v5Path);
const refined = read(refinedPath);
if(!v5) { console.error('未找到', v5Path); process.exit(1); }
if(!refined) { console.error('未找到', refinedPath); process.exit(1); }

v5.equipments = v5.equipments || [];
const exist = new Set(v5.equipments.map(e=>e.id));
let added=0, updated=0;
refined.equipments.forEach(e=>{
  const idx = v5.equipments.findIndex(x=>x.id===e.id);
  if(idx>=0){ v5.equipments[idx] = Object.assign({}, v5.equipments[idx], e); updated++; }
  else { v5.equipments.push(e); added++; }
});

fs.writeFileSync(outPath, JSON.stringify(v5,null,2),'utf8');
console.log('合并完成，added:',added,'updated:',updated,'out:',outPath);

try{
  const importScript = path.join(repo,'scripts','import_v5.js');
  cp.execFileSync(process.execPath, [importScript, outPath], { stdio: 'inherit' });
  console.log('已使用合并后的数据生成 js/v5data.js');
}catch(e){ console.error('调用 import 失败:', e.message); }
