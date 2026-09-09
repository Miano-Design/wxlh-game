#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname,'..');
const v5Path = path.join(repo,'v5_full.merged.auto.refinedmerged.json');
const outPath = path.join(repo,'reports','validation_report.json');

function read(p){ try{ return JSON.parse(fs.readFileSync(p,'utf8')); }catch(e){ return null; } }
const v5 = read(v5Path) || read(path.join(repo,'v5_full.merged.auto.updated.json')) || read(path.join(repo,'v5_full.merged.json'));
if(!v5){ console.error('未找到可用的 v5_full 文件进行校验'); process.exit(1); }

const report = { checkedAt: new Date().toISOString(), issues: [] };

// check core keys
const requiredKeys = ['expTable','equipments','equipmentDrops','events','dungeons','characters','recruitRates'];
requiredKeys.forEach(k=>{ if(!(k in v5)) report.issues.push({key:k, issue:'missing'}); });

// check characters have id/name/skills
if(Array.isArray(v5.characters)){
  v5.characters.slice(0,200).forEach(ch=>{
    if(!ch.id) report.issues.push({type:'character', id:ch.id||null, issue:'missing id'});
    if(!ch.name || /^角色\d+/.test(ch.name)) report.issues.push({type:'character', id:ch.id||null, issue:'placeholder name'});
    if(!ch.skills || ch.skills.length===0) report.issues.push({type:'character', id:ch.id||null, issue:'missing skills'});
  });
} else report.issues.push({key:'characters', issue:'not array'});

// check equipments fields
if(Array.isArray(v5.equipments)){
  v5.equipments.slice(0,500).forEach(eq=>{
    if(!eq.id) report.issues.push({type:'equip', issue:'missing id', sample:eq});
    if(!eq.slot) report.issues.push({type:'equip', id:eq.id||null, issue:'missing slot'});
    if(!eq.rarity) report.issues.push({type:'equip', id:eq.id||null, issue:'missing rarity'});
    if(!eq.base_stats) report.issues.push({type:'equip', id:eq.id||null, issue:'missing base_stats'});
  });
} else report.issues.push({key:'equipments', issue:'not array'});

// check events
if(!Array.isArray(v5.events) || v5.events.length < 10) report.issues.push({key:'events', issue:'too few events or missing array'});

// check bosses presence in worlds mapping
const worldsReport = [];
const worlds = read(path.join(repo,'reports','worlds_extracted.json')) || {};
Object.keys(worlds).forEach(wk=>{ const s = worlds[wk].sections||{}; if(!s.boss) report.issues.push({key:'world_boss', world:wk, issue:'boss block missing'}); });

fs.writeFileSync(outPath, JSON.stringify(report,null,2),'utf8');
console.log('校验完成，输出:', outPath);
