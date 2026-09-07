(function(){
  const el = id=>document.getElementById(id);
  function renderResources(s){ el('res-points').textContent = s.points }
  function renderParty(s){ const p=el('party'); p.innerHTML=''; s.party.forEach(c=>{
    const d=document.createElement('div'); d.className='char-card';
    d.innerHTML = `<h3>${c.name} (${c.rarity})</h3><div>职业：${c.role}</div><div>肌肉 ${c.muscle}</div>`;
    p.appendChild(d);
  }) }

  function showPanel(id){ document.querySelectorAll('.panel').forEach(n=>n.classList.add('hidden')); el(id).classList.remove('hidden') }

  document.addEventListener('DOMContentLoaded', ()=>{
    GameCore.init();
    const s = GameCore.getState(); renderResources(s); renderParty(s);

    el('btn-start').addEventListener('click', ()=>{ showPanel('home') });
    el('btn-venture').addEventListener('click', ()=>{ if(GameCore.startBattle()){ showPanel('battle'); el('battle-log').innerHTML='战斗开始\n' } });
    el('btn-save').addEventListener('click', ()=>{ GameCore.save(); alert('已保存') });
    el('btn-load').addEventListener('click', ()=>{ if(GameCore.load()){ const s=GameCore.getState(); renderResources(s); renderParty(s); alert('读取成功') } else alert('无存档') });
    el('btn-attack').addEventListener('click', ()=>{
      const res = GameCore.battleRound();
      const log = el('battle-log'); log.innerHTML += res.log + '\n'; log.scrollTop = log.scrollHeight; renderResources(res.state);
    });
    el('btn-end-battle').addEventListener('click', ()=>{ GameCore.endBattle(); showPanel('home'); const s=GameCore.getState(); renderResources(s) });
  });
})();