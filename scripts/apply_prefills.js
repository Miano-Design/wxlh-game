#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const repo = path.resolve(__dirname,'..');
const v5Path = path.join(repo,'v5_full.merged.auto.json');
const equipGen = path.join(repo,'data','equip_template.generated.json');
const skillsPrefill = path.join(repo,'data','skills_prefill.json');
const outPath = path.join(repo,'v5_full.merged.auto.updated.json');

function safeRead(p){ try{ return JSON.parse(fs.readFileSync(p,'utf8')); }catch(e){ return null; } }
const v5 = safeRead(v5Path);
if(!v5) { console.error('找不到', v5Path); process.exit(1); }
const eq = safeRead(equipGen);
const sp = safeRead(skillsPrefill);

v5.equipments = v5.equipments || [];
if(eq && Array.isArray(eq.equipments)){
  // avoid id collisions: only add those ids not present
  const existing = new Set(v5.equipments.map(e=>e.id));
  let added=0;
  eq.equipments.forEach(e=>{ if(!existing.has(e.id)){ v5.equipments.push(e); added++; } });
  console.log('追加装备数量:', added);
}

v5.skills = v5.skills || [];
if(sp && sp.skills){
  const existingSkillIds = new Set(v5.skills.map(s=>s.id));
  let added=0;
  Object.keys(sp.skills).forEach(k=>{
    const s = sp.skills[k];
    const id = s.id || k;
    if(existingSkillIds.has(id)) return;
    const tmplLevels = {};
    for(let i=1;i<=10;i++) tmplLevels[i] = { power:0, cost:0, cooldown:0 };
    const obj = { id, name: s.name || id, type: s.type || 'unknown', description: s.example_description || [], levels: tmplLevels };
    v5.skills.push(obj); added++;
  });
  console.log('注入技能样例数量:', added);
}

fs.writeFileSync(outPath, JSON.stringify(v5,null,2),'utf8');
console.log('已写入', outPath);

// regenerate v5data
try{
  const importScript = path.join(repo,'scripts','import_v5.js');
  cp.execFileSync(process.execPath, [importScript, outPath], { stdio: 'inherit' });
  console.log('已使用更新后的数据生成 js/v5data.js');
}catch(e){ console.error('调用 import 失败:', e.message); }
