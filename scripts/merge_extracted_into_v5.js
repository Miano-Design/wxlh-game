#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const repo = path.resolve(__dirname,'..');
const v5Path = path.join(repo,'v5_full.merged.json');
const outPath = path.join(repo,'v5_full.merged.auto.json');

function safeRead(p){ try{ return JSON.parse(fs.readFileSync(p,'utf8')); }catch(e){ return null; } }
const v5 = safeRead(v5Path) || safeRead(path.join(repo,'v5_full.json'));
if(!v5){ console.error('未找到 v5_full.merged.json 或 v5_full.json'); process.exit(1); }

const equipPrefill = safeRead(path.join(repo,'data','equip_template.generated.json'));
const skillsPrefill = safeRead(path.join(repo,'data','skills_prefill.json'));
const skillsTemplate = safeRead(path.join(repo,'data','skills_template.json'));
const equipTemplate = safeRead(path.join(repo,'data','equip_template.json'));

v5._auto = v5._auto || {};
if(equipPrefill && equipPrefill.equipments){
  v5._auto.equipments_prefill = equipPrefill.equipments;
}
if(skillsPrefill && skillsPrefill.skills){
  v5._auto.skills_prefill = skillsPrefill.skills;
}
if(skillsTemplate) v5._auto.skills_template = skillsTemplate;
if(equipTemplate) v5._auto.equip_template = equipTemplate;

fs.writeFileSync(outPath, JSON.stringify(v5,null,2),'utf8');
console.log('已生成', outPath);

// call import to regenerate js/v5data.js
try{
  const importScript = path.join(repo,'scripts','import_v5.js');
  cp.execFileSync(process.execPath, [importScript, outPath], { stdio: 'inherit' });
  console.log('已使用合并后的自动数据生成 js/v5data.js');
}catch(e){ console.error('调用 import 失败:', e.message); }
