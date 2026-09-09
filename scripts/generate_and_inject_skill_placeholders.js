#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const repo = path.resolve(__dirname,'..');
const srcCandidates = [
  path.join(repo,'v5_full.merged.auto.refinedmerged.json'),
  path.join(repo,'v5_full.merged.auto.updated.json'),
  path.join(repo,'v5_full.merged.json'),
  path.join(repo,'v5_full.json')
];
let v5Path = srcCandidates.find(p=>fs.existsSync(p));
if(!v5Path){ console.error('未找到 v5 文件'); process.exit(1); }
const v5 = JSON.parse(fs.readFileSync(v5Path,'utf8'));

v5._auto = v5._auto || {};
v5._auto.skills_prefill = v5._auto.skills_prefill || {};
v5.skills = v5.skills || [];

let addedSkills = 0;
v5.characters = v5.characters || [];
v5.characters.forEach(ch=>{
  if(!ch) return;
  const cid = ch.id || (`CHAR_${Math.random().toString(36).slice(2,8)}`);
  ch.id = cid;
  ch.skills = ch.skills || [];
  if(ch.skills.length === 0){
    // create 2 active + 2 passive placeholder skills
    const newSkillIds = [];
    for(let t=1;t<=4;t++){
      const sid = `SK_${cid}_${t}`;
      if(!v5._auto.skills_prefill[sid]){
        v5._auto.skills_prefill[sid] = { id: sid, name: `占位技能_${cid}_${t}`, type: t<=2? 'active':'passive', example_description: [`占位技能 ${t} for ${cid}`] };
        addedSkills++;
      }
      newSkillIds.push(sid);
    }
    ch.skills = newSkillIds;
  }
});

const outPath = path.join(repo,'v5_full.merged.auto.skills_injected.json');
fs.writeFileSync(outPath, JSON.stringify(v5,null,2),'utf8');
console.log('已写入', outPath, '追加技能数:', addedSkills);

// regenerate js/v5data.js
try{
  const importScript = path.join(repo,'scripts','import_v5.js');
  cp.execFileSync(process.execPath, [importScript, outPath], { stdio: 'inherit' });
  console.log('已使用带技能占位的 v5 生成 js/v5data.js');
}catch(e){ console.error('导出失败:', e.message); }
