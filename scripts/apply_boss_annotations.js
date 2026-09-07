#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const repo = path.resolve(__dirname,'..');
const annPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
if(!annPath || !fs.existsSync(annPath)){ console.error('usage: node apply_boss_annotations.js <annotations.json>'); process.exit(1); }

const v5Path = path.join(repo,'v5_full.merged.auto.updated.json');
if(!fs.existsSync(v5Path)){ console.error('请先生成 v5_full.merged.auto.updated.json（run apply_prefills.js）'); process.exit(1); }

const v5 = JSON.parse(fs.readFileSync(v5Path,'utf8'));
const ann = JSON.parse(fs.readFileSync(annPath,'utf8'));
v5._auto = v5._auto || {};
v5._auto.boss_annotations = ann;
const out = v5Path.replace('.updated.json','.annotated.json');
fs.writeFileSync(out, JSON.stringify(v5,null,2),'utf8');
console.log('已写入', out);

try{
  const importScript = path.join(repo,'scripts','import_v5.js');
  cp.execFileSync(process.execPath, [importScript, out], { stdio: 'inherit' });
  console.log('已更新 js/v5data.js（含 boss_annotations）');
}catch(e){ console.error('调用 import 失败:', e.message); }
