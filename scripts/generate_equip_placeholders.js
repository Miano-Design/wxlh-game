#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname,'..');
const outPath = path.join(repo,'data','equip_template.generated.json');
const reports = path.join(repo,'reports','equipments_extracted.txt');

function loadReports(){
  try{ return fs.readFileSync(reports,'utf8'); }catch(e){ return null; }
}

const raw = loadReports() || '';

// simple heuristics: find rarity tables and drop sources
const rarityMatches = {};
if(/\|\s*N\s*\|\s*45%/i.test(raw)) rarityMatches['normal']=true;

const entries = [];
const slots = ['weapon','head','chest','legs','accessory'];
for(let i=1;i<=250;i++){
  const id = 'E_' + String(i).padStart(4,'0');
  const rarity = (i%50===0)?'UR':(i%10===0)?'SSR':(i%4===0)?'SR':(i%2===0)?'R':'N';
  const slot = slots[i%slots.length];
  const entry = {
    id, name: `占位装备${i}`, slot, rarity,
    base_stats: {muscle: Math.floor(5 + i%10), cell: Math.floor(3 + (i+2)%8)},
    affixes: [], set: null,
    drop_sources: [ (i%7===0)?`boss:W${String((i%14)+1).padStart(2,'0')}_boss`:`world:W${String((i%14)+1).padStart(2,'0')}` ]
  };
  entries.push(entry);
}

const out = { meta:{generatedFrom:'generate_equip_placeholders.js',count:entries.length}, equipments: entries };
fs.mkdirSync(path.join(repo,'data'),{recursive:true});
fs.writeFileSync(outPath, JSON.stringify(out,null,2),'utf8');
console.log('已生成', outPath);
