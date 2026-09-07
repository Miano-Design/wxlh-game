#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const srcPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(repoRoot, 'v5_full.json');
const dest = path.join(repoRoot, 'js', 'v5data.js');

function exit(msg, code=1){ console.error(msg); process.exit(code); }

if(!fs.existsSync(srcPath)){
  console.log('未找到 v5 全量数据文件：', srcPath);
  console.log('请将 V5 JSON 放到项目根并命名为 v5_full.json，或通过参数指定路径。');
  process.exit(0);
}

let raw;
try{ raw = fs.readFileSync(srcPath,'utf8') }catch(e){ exit('读取 v5 文件失败: '+e.message) }
let data;
try{ data = JSON.parse(raw) }catch(e){ exit('JSON 解析失败: '+e.message) }

// basic validation
const required = ['expTable','equipments','equipmentDrops','events','dungeons','characters','recruitRates'];
const missing = required.filter(k=>!(k in data));
if(missing.length) exit('缺少必需字段: '+missing.join(', '));

// optional checks
if(!Array.isArray(data.characters) || data.characters.length < 60){
  console.warn('警告：characters 数量少于 60（当前 '+ (Array.isArray(data.characters)?data.characters.length:0) +')');
}

// backup existing v5data.js
try{
  const bakPath = dest + '.bak.' + Date.now();
  if(fs.existsSync(dest)) fs.copyFileSync(dest, bakPath);
}catch(e){ console.warn('备份失败：'+e.message) }

// write new v5data.js
const out = `// Auto-generated v5data.js - generated from ${path.basename(srcPath)}\nwindow.V5 = (function(){\n  const data = ${JSON.stringify(data, null, 2)};\n  return data;\n})();\n`;
try{ fs.writeFileSync(dest, out, 'utf8'); console.log('已生成', dest); }
catch(e){ exit('写入失败：'+e.message) }

// summary
console.log('导入完成。角色数量:', (data.characters && data.characters.length) || 0, '装备数量:', (data.equipments && data.equipments.length) || 0);
process.exit(0);
