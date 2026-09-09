#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const repo = path.resolve(__dirname,'..');
const eventsPath = path.join(repo,'data','events_placeholders.json');
const srcCandidates = [
  path.join(repo,'v5_full.merged.auto.refinedmerged.json'),
  path.join(repo,'v5_full.merged.auto.updated.json'),
  path.join(repo,'v5_full.merged.json')
];
let v5Path = srcCandidates.find(p=>fs.existsSync(p));
if(!v5Path){ console.error('未找到 v5 文件'); process.exit(1); }
const v5 = JSON.parse(fs.readFileSync(v5Path,'utf8'));

let ev = { meta:{generatedFrom:'expand_and_apply_events'}, events:[] };
try{ ev = JSON.parse(fs.readFileSync(eventsPath,'utf8')); }catch(e){ /* ignore */ }

const targetCount = 30;
const base = ev.events && ev.events.length? ev.events : [];
for(let i=0;i<targetCount;i++){
  if(base[i]) continue;
  const id = `EVENT_${String(i+1).padStart(4,'0')}`;
  base[i] = { id, title:`占位事件 ${i+1}`, world:`W${String((i%14)+1).padStart(2,'0')}`, description:'自动占位事件，后续替换', choices:[{id:'c1',text:'A',outcome:{gain:{points:100}}},{id:'c2',text:'B',outcome:{gain:{holy_crystal:1}}}] };
}
ev.events = base.slice(0,targetCount);
fs.writeFileSync(eventsPath, JSON.stringify(ev,null,2),'utf8');
console.log('已扩展并写入事件占位:', eventsPath);

v5.events = v5.events || [];
// append events that don't exist by id
const existIds = new Set(v5.events.map(e=>e.id));
let added=0;
ev.events.forEach(e=>{ if(!existIds.has(e.id)){ v5.events.push(e); existIds.add(e.id); added++; } });

const outPath = path.join(repo,'v5_full.merged.auto.events_injected.json');
fs.writeFileSync(outPath, JSON.stringify(v5,null,2),'utf8');
console.log('事件注入完成，追加数:', added, 'out:', outPath);

try{
  const importScript = path.join(repo,'scripts','import_v5.js');
  cp.execFileSync(process.execPath, [importScript, outPath], { stdio: 'inherit' });
  console.log('已使用带事件的 v5 生成 js/v5data.js');
}catch(e){ console.error('导出失败:', e.message); }
