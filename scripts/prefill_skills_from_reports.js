#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname,'..');
const worldsPath = path.join(repo,'reports','worlds_extracted.json');
const bossesPath = path.join(repo,'reports','bosses_extracted.json');
const outPath = path.join(repo,'data','skills_prefill.json');

function safeRead(p){ try{ return JSON.parse(fs.readFileSync(p,'utf8')); }catch(e){ return null; } }
const worlds = safeRead(worldsPath) || {};
const bosses = safeRead(bossesPath) || [];

const skills = {};
// attempt to extract simple stat-like lines as example skills
Object.keys(worlds).forEach(wk=>{
  const s = worlds[wk].sections || {};
  if(s.boss && Array.isArray(s.boss)){
    const name = wk + ' Boss';
    skills[`SK_${wk.replace(/\s/,'_')}_BOSS`] = { id:`SK_${wk}_BOSS`, name, type:'boss', example_description: s.boss.slice(0,5) };
  }
});

// from bosses report, try to find lines containing '阶段' or 'Phase' as candidate stages
bosses.forEach((b,idx)=>{
  if(b.block && b.block.length){
    const blk = b.block.join('\n');
    if(/阶段|Phase|Stage|释放/.test(blk)){
      skills[`SK_BOSS_AUTO_${idx}`] = { id:`SK_BOSS_AUTO_${idx}`, name:`自动_BOSS_${idx}`, type:'boss_phase', example_description: b.block.slice(0,10) };
    }
  }
});

fs.mkdirSync(path.join(repo,'data'),{recursive:true});
fs.writeFileSync(outPath, JSON.stringify({meta:{source:'reports'}, skills}, null,2),'utf8');
console.log('已生成', outPath, '技能预填条数', Object.keys(skills).length);
