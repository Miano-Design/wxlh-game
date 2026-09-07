#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const docPath = path.join(repoRoot, '..', 'V5.0《完整内容数据库》');
const outDir = path.join(repoRoot, 'reports');
if(!fs.existsSync(docPath)){ console.error('未找到 V5 文档:', docPath); process.exit(1) }
const raw = fs.readFileSync(docPath,'utf8');
const lines = raw.split(/\r?\n/);
if(!fs.existsSync(outDir)) fs.mkdirSync(outDir);

// Helper: find nearest header above index that contains '世界' or '世界' + number
function findNearestWorldHeader(i){ for(let j=i;j>=0;j--){ const l=lines[j]; if(/世界/.test(l) && /\d|十四|十三|十二|十|一|二|三|四|五|六|七|八|九/.test(l)) return l.trim(); if(/^#/.test(l) && /世界/.test(l)) return l.trim(); } return null }

// Extract world sections based on '## Wxx' headers and parse following code blocks for 普通敌人 / 精英 / Boss
const worlds = {};
for(let i=0;i<lines.length;i++){
  const line = lines[i];
  const m = line.match(/^##\s*(W\d{2})\s*(.*)$/);
  if(m){
    const wid = m[1]; const wname = (m[2]||'').trim();
    const key = wid + ' ' + wname;
    worlds[key] = worlds[key] || { id: wid, name: wname, sections: {} };
    // scan forward for next header or blank separator up to 200 lines
    let j=i+1;
    while(j<lines.length && !/^##\s*W\d{2}/.test(lines[j]) && j<i+200){
      const l = lines[j].trim();
      if(/普通敌人/.test(l)){
        // find next code block
        let k=j+1; while(k<lines.length && !/```/.test(lines[k])) k++; if(k<lines.length && /```/.test(lines[k])){ const start=k+1; let end=start; while(end<lines.length && !/```/.test(lines[end])) end++; const block = lines.slice(start,end).map(s=>s.trim()).filter(Boolean); worlds[key].sections.common = block; j=end; }
      }
      if(/精英/.test(l)){
        let k=j+1; while(k<lines.length && !/```/.test(lines[k])) k++; if(k<lines.length){ const start=k+1; let end=start; while(end<lines.length && !/```/.test(lines[end])) end++; const block = lines.slice(start,end).map(s=>s.trim()).filter(Boolean); worlds[key].sections.elite = block; j=end; }
      }
      if(/Boss/.test(l) || /Boss：/.test(l)){
        // capture following code block or numeric lines
        let k=j+1; while(k<lines.length && !/```/.test(lines[k]) && lines[k].trim()=== '') k++; if(k<lines.length && /```/.test(lines[k])){ const start=k+1; let end=start; while(end<lines.length && !/```/.test(lines[end])) end++; const block = lines.slice(start,end).map(s=>s.trim()).filter(Boolean); worlds[key].sections.boss = block; j=end; } else {
          // capture next few non-empty lines
          const block = []; for(let t=j+1;t<j+8 && t<lines.length;t++){ if(lines[t].trim()==='') break; block.push(lines[t].trim()); } worlds[key].sections.boss = block; j +=8;
        }
      }
      j++;
    }
  }
}

// Extract Boss blocks: find lines containing 'Boss' and grab subsequent numeric lines
const bosses = [];
for(let i=0;i<lines.length;i++){
  const l = lines[i];
  if(/Boss/.test(l) || /Boss：/.test(l) || /^Boss$/i.test(l.trim())){
    // collect following lines up to 10 lines for HP/ATK/DEF/SPD and mechanism
    const block = [];
    for(let j=i+1;j<i+12 && j<lines.length;j++){
      if(lines[j].trim()==='') break;
      block.push(lines[j].trim());
    }
    bosses.push({ anchorLine: l.trim(), block });
  }
}

// Extract currency table (look for '玩家核心货币总表' and following markdown table)
let currencies = [];
for(let i=0;i<lines.length;i++){
  if(/玩家核心货币总表/.test(lines[i])){
    // scan forward for table rows starting with '| ID' or '| ID' header
    let j=i+1; while(j<lines.length && !lines[j].trim().startsWith('|')) j++;
    // now collect table rows
    while(j<lines.length && lines[j].trim().startsWith('|')){
      const cols = lines[j].split('|').map(s=>s.trim()).filter(s=>s.length>0);
      if(cols.length>=3) currencies.push(cols);
      j++;
    }
    break;
  }
}

// Extract equipment headings and nearby lists (simple heuristic)
const equipments = [];
for(let i=0;i<lines.length;i++){
  const l=lines[i];
  if(/装备/.test(l) && /id|ID|装备列表/.test(l)===false && l.length<80){
    // look ahead for lines that look like equipment entries (id-like or name-like)
    for(let j=i+1;j< i+60 && j<lines.length;j++){
      const s = lines[j].trim();
      if(s.startsWith('{') || s.startsWith('[') ) break;
      if(s.startsWith('|') && /id|名称|name/.test(s)) continue;
      if(/WPN_|ARM_|ACC_|装备|稀有度/.test(s) || /^\|/.test(s)) equipments.push(s);
    }
  }
}

// Extract event table rows: lines starting with '| E' or '| E0'
const events = [];
for(let i=0;i<lines.length;i++){
  const l = lines[i].trim();
  if(/^\|\s*C?E?0?\d{1,3}/.test(l) || /^\|\s*E\d{1,3}/.test(l)){
    const cols = l.split('|').map(s=>s.trim()).filter(s=>s.length>0);
    events.push(cols);
  }
}

// Write outputs
fs.writeFileSync(path.join(outDir,'worlds_extracted.json'), JSON.stringify(worlds, null, 2), 'utf8');
fs.writeFileSync(path.join(outDir,'bosses_extracted.json'), JSON.stringify(bosses, null, 2), 'utf8');
fs.writeFileSync(path.join(outDir,'currencies_extracted.json'), JSON.stringify(currencies, null, 2), 'utf8');
fs.writeFileSync(path.join(outDir,'equipments_extracted.txt'), equipments.join('\n'), 'utf8');
fs.writeFileSync(path.join(outDir,'events_extracted.json'), JSON.stringify(events, null, 2), 'utf8');

console.log('提取完成：worlds_extracted.json, bosses_extracted.json, currencies_extracted.json, equipments_extracted.txt, events_extracted.json');
process.exit(0);
