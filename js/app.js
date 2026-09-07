(function(){
  const el = id=>document.getElementById(id);
  function renderResources(s){ el('res-points').textContent = Math.floor(s.points||0); const rc = el('res-crystal'); if(rc) rc.textContent = s.holy_crystal || 0 }
  function renderParty(s){ const p=el('party'); p.innerHTML=''; s.party.forEach(c=>{
    const d=document.createElement('div'); d.className='char-card';
    d.innerHTML = `<h3>${c.name} (${c.rarity})</h3><div>职业：${c.role}</div><div>等级：${c.level || 1}（EXP ${c.exp||0}/${GameCore.expForLevel(c.level||1)}）</div><div>肌肉 ${c.muscle}</div>`;
    p.appendChild(d);
  }) }

  function renderIdle(s){ const rate = GameCore.idleRatePerSecond(); el('idle-rate').textContent = rate.toFixed(2); el('btn-toggle-idle').textContent = s.idleOn ? '关闭挂机' : '开启挂机' }
  function renderInventory(s){ const box = el('inventory-list'); box.innerHTML=''; const items = GameCore.getInventory() || []; if(items.length===0){ box.innerHTML='<div>空</div>'; return }
    items.forEach(id=>{
      const meta = (window.V5 && window.V5.equipments||[]).find(it=>it.id===id) || {name:id};
      const d = document.createElement('div'); d.className='item-card';
      d.innerHTML = `<div><strong>${meta.name}</strong></div><div>稀有度: ${meta.rarity||'-'}</div><div>atk: ${meta.atk||0} hp: ${meta.hp||0}</div>`;
      const row=document.createElement('div'); row.style.display='flex'; row.style.gap='6px';
      const btnEq = document.createElement('button'); btnEq.textContent='装备'; btnEq.addEventListener('click', ()=>{
        // 简单选择：装备到第一个角色支持的槽
        const char = s.party[0]; if(!char){ alert('无角色'); return }
        const slot = meta.slot || 'weapon';
        if(GameCore.equipItem(char.id, slot, id)){ alert('装备成功'); renderAll(); } else { alert('装备失败，检查背包或槽位') }
      });
      const btnDrop = document.createElement('button'); btnDrop.textContent='丢弃'; btnDrop.addEventListener('click', ()=>{ if(confirm('丢弃该物品？')){ GameCore.removeItem(id); renderAll(); } });
      row.appendChild(btnEq); row.appendChild(btnDrop); d.appendChild(row); box.appendChild(d);
    }) }

  function renderEquips(s){ const box=el('equips-list'); box.innerHTML=''; const equips = GameCore.getEquips() || {}; Object.keys(equips).forEach(charId=>{
    const e = equips[charId]; const ch = s.party.find(x=>x.id===charId) || {name:charId}; const d=document.createElement('div'); d.className='item-card'; d.innerHTML=`<strong>${ch.name}</strong>`;
    const ul=document.createElement('div'); ul.style.fontSize='13px'; ul.innerHTML = `<div>武器: ${e.weapon||'-'}</div><div>护甲: ${e.armor||'-'}</div><div>饰品: ${e.accessory||'-'}</div>`;
    const btn=document.createElement('button'); btn.textContent='卸下全部'; btn.addEventListener('click', ()=>{ if(e.weapon) GameCore.unequipItem(charId,'weapon'); if(e.armor) GameCore.unequipItem(charId,'armor'); if(e.accessory) GameCore.unequipItem(charId,'accessory'); renderAll(); }); d.appendChild(ul); d.appendChild(btn); box.appendChild(d);
  }) }

  let currentDungeon = null;
  function renderDungeonLog(text, append){ const box = el('dungeon-log'); if(!append) box.innerHTML=''; box.innerHTML += text + '<br>'; box.scrollTop = box.scrollHeight }

  function showEventModal(ev){ el('event-title').textContent = ev.title; el('event-desc').textContent = ev.desc; const choices = el('event-choices'); choices.innerHTML=''; ev.choices.forEach(ch=>{ const b=document.createElement('button'); b.textContent=ch.text; b.addEventListener('click', ()=>{ const res = GameCore.handleEventChoice(ev.id, ch.id); renderAll(); renderDungeonLog(`事件选择：${ch.text} → ${res.result}`, true); el('event-modal').classList.add('hidden'); }); choices.appendChild(b); }); el('event-modal').classList.remove('hidden'); }

  // allow closing modal by background click or ESC key
  (function enableModalDismiss(){
    const modal = el('event-modal');
    if(!modal) return;
    modal.addEventListener('click', (e)=>{
      if(e.target === modal){ modal.classList.add('hidden'); }
    });
    const content = modal.querySelector('.modal-content');
    if(content) content.addEventListener('click', (e)=>{ e.stopPropagation(); });
    document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape'){ modal.classList.add('hidden'); } });
  })();

  function renderRecruitLog(lines){ const box = el('battle-log'); if(!lines) return; if(!Array.isArray(lines)) lines=[lines]; lines.forEach(l=>{ box.innerHTML += l + '<br>' }); box.scrollTop = box.scrollHeight }

  function renderCollection(s){ const c = GameCore.getCollection(); const node = document.getElementById('party'); // reuse party area to show collection count small
    const info = document.createElement('div'); info.style.marginTop='8px'; info.style.fontSize='13px'; info.textContent = `收藏：${c.collection.length} 名，碎片种类 ${Object.keys(c.shards||{}).length}`;
    // remove old info if exists
    const old = document.getElementById('collection-info'); if(old) old.remove(); info.id='collection-info'; node.parentNode.insertBefore(info, node);
  }

  function showPanel(id){ document.querySelectorAll('.panel').forEach(n=>n.classList.add('hidden')); el(id).classList.remove('hidden') }

  document.addEventListener('DOMContentLoaded', ()=>{
    GameCore.init();
    const s = GameCore.getState(); renderResources(s); renderParty(s);
    function renderAll(){ const s = GameCore.getState(); renderResources(s); renderParty(s); renderIdle(s); renderInventory(s); renderEquips(s); }

    renderAll();

    el('btn-start').addEventListener('click', ()=>{ showPanel('home') });
    el('btn-venture').addEventListener('click', ()=>{ if(GameCore.startBattle()){ showPanel('battle'); el('battle-log').innerHTML='战斗开始\n' } });
    el('btn-save').addEventListener('click', ()=>{ GameCore.save(); alert('已保存') });
    el('btn-load').addEventListener('click', ()=>{ if(GameCore.load()){ renderAll(); alert('读取成功') } else alert('无存档') });
    el('btn-save').addEventListener('click', ()=>{ /* keep existing */ });
    // Slot-based save/load
    const selSlot = el('select-save-slot');
    el('btn-save').addEventListener('click', ()=>{
      const slot = parseInt(selSlot.value,10)||1; if(GameCore.saveSlot(slot)){ alert('已保存到槽 '+slot) } else alert('保存失败')
    });
    el('btn-load').addEventListener('click', ()=>{ const slot = parseInt(selSlot.value,10)||1; if(GameCore.loadSlot(slot)){ renderAll(); alert('已从槽 '+slot+' 读取') } else alert('该槽无存档') });
    el('btn-export-slot').addEventListener('click', ()=>{
      const slot = parseInt(selSlot.value,10)||1; const data = GameCore.getSlotData(slot) || JSON.stringify(GameCore.getState());
      const blob = new Blob([data], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `wxlh_slot${slot}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });
    el('btn-import-slot').addEventListener('click', ()=>{ el('input-import-file').click(); });
    el('input-import-file').addEventListener('change', (ev)=>{ const f = ev.target.files && ev.target.files[0]; if(!f) return; const reader = new FileReader(); reader.onload = function(){ try{ const json = reader.result; const slot = parseInt(selSlot.value,10)||1; if(GameCore.importSlotData(slot, json)){ alert('已导入到槽 '+slot); if(GameCore.loadSlot(slot)){ renderAll(); } } else alert('导入失败：格式错误'); }catch(e){ alert('导入失败：'+e.message) } }; reader.readAsText(f); });
    el('btn-toggle-idle').addEventListener('click', ()=>{ const s = GameCore.getState(); GameCore.setIdle(!s.idleOn); renderAll(); });
    el('btn-attack').addEventListener('click', ()=>{ const res = GameCore.battleRound(); const log = el('battle-log'); log.innerHTML += res.log + '\n'; log.scrollTop = log.scrollHeight; renderAll(); });
    el('btn-end-battle').addEventListener('click', ()=>{ GameCore.endBattle(); showPanel('home'); renderAll() });

    // inventory / equips
    el('btn-open-inventory').addEventListener('click', ()=>{ // 简单：跳转到 inventory panel
      showPanel('home'); const inv = el('inventory-panel'); inv.scrollIntoView({behavior:'smooth'});
    });

    // dungeon
    el('btn-start-dungeon').addEventListener('click', ()=>{
      currentDungeon = GameCore.generateDungeon('D01'); if(!currentDungeon){ alert('无法生成副本'); return }
      showPanel('dungeon'); el('dungeon-log').innerHTML = `进入副本：${currentDungeon.name}\n`;
    });
    el('btn-next-node').addEventListener('click', ()=>{
      if(!currentDungeon) return;
      const res = GameCore.advanceDungeon(currentDungeon);
      if(res.finished){ renderDungeonLog('副本已完成'); currentDungeon=null; return }
      if(res.event){ renderDungeonLog(`节点 ${res.node.idx}：事件 ${res.event.title}`, true); showEventModal(res.event); }
      else if(res.combat){ renderDungeonLog(`节点 ${res.node.idx}：战斗 → ${res.combat.log || res.combat}`, true); if(res.loot){ renderDungeonLog(`获得战利品：${res.loot}`, true); } if(res.crystal){ renderDungeonLog(`获得圣晶 x${res.crystal}`, true); } }
    });
    el('btn-exit-dungeon').addEventListener('click', ()=>{ currentDungeon=null; showPanel('home'); renderAll(); });

    el('btn-close-event').addEventListener('click', ()=>{ el('event-modal').classList.add('hidden') });

    // 招募
    el('btn-recruit-one').addEventListener('click', ()=>{
      const res = GameCore.recruitOnce(); if(res.error){ alert(res.error); return }
      renderRecruitLog(`招募：${res.name} (${res.rarity}) ${res.isNew? '新获得':'已拥有，转为碎片 x'+res.shardsAdded}`);
      renderAll(); renderCollection();
    });
    el('btn-recruit-ten').addEventListener('click', ()=>{
      const results = GameCore.recruitMulti(10);
      results.forEach(r=>{ if(r.error) renderRecruitLog(`招募失败：${r.error}`); else renderRecruitLog(`招募：${r.name} (${r.rarity}) ${r.isNew? '新获得':'转为碎片 x'+r.shardsAdded}`) });
      renderAll(); renderCollection();
    });
  });

  // 挂机计时器（每秒结算）
  setInterval(()=>{
    const gain = GameCore.tickIdle(1);
    if(gain){ const s = GameCore.getState(); renderResources(s); renderIdle(s) }
  }, 1000);
})();