#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname,'..');
const genPath = path.join(repo,'data','equip_template.generated.json');
const rawReport = path.join(repo,'reports','equipments_extracted.txt');
const outPath = path.join(repo,'data','equip_template.generated.refined.json');

function read(p){ try{ return fs.readFileSync(p,'utf8'); }catch(e){ return null; } }
const raw = read(rawReport) || '';
const generated = JSON.parse(read(genPath) || '{"equipments":[]}');

// heuristics: collect affix keywords from report
const affixCandidates = [];
const affixRegex = /\|\s*([\u4e00-\u9fff]{2,6})\s*\|/g;
let m;
while((m=affixRegex.exec(raw))){ const a = m[1].trim(); if(a && affixCandidates.indexOf(a)===-1) affixCandidates.push(a); }
if(affixCandidates.length===0){ affixCandidates.push('攻击力','暴击率','暴击伤害','生命','防御'); }

const rarities = { 'N':[0,1], 'R':[1,1], 'SR':[1,2], 'SSR':[2,3], 'UR':[3,4] };
const rangesMap = { '攻击力':['2%','5%'], '暴击率':['1%','3%'], '暴击伤害':['5%','15%'], '生命':['3%','12%'], '防御':['2%','8%'], '技能伤害':['4%','16%'] };

generated.equipments.forEach(eq=>{
  const r = eq.rarity || 'N';
  const countRange = rarities[r] || [0,1];
  const count = Math.max(0, Math.floor((countRange[0]+countRange[1])/2));
  eq.affixes = [];
  for(let i=0;i<count;i++){
    const aff = affixCandidates[(i + (eq.id.charCodeAt(0)||0)) % affixCandidates.length];
    const rng = rangesMap[aff] || ['1%','10%'];
    eq.affixes.push({ name: aff, range: rng });
  }
  // add a simple quality score
  eq.qualityScore = (r==='UR')?100:(r==='SSR')?80:(r==='SR')?60:(r==='R')?40:20;
});

fs.writeFileSync(outPath, JSON.stringify(generated,null,2),'utf8');
console.log('已生成精填装备文件:', outPath);
