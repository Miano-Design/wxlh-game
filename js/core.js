window.GameCore = (function(){
  const KEY='wxlh_save_v1';
  let state = {
    points: 0,
    holy_crystal: 0,
    party: [],
    inBattle: false,
    idleOn: false,
    inventory: [],
    equips: {},
    collection: [],
    shards: {},
    recruitPity: { pullsSinceSR: 0 }
  };

  function expForLevel(lv){
    return Math.max(50, Math.floor(50 * Math.pow(1.075, lv-1)));
  }

  function init(){
    state.points = window.GAME_CONFIG.startPoints || 0;
    state.holy_crystal = window.GAME_CONFIG.startHolyCrystal || 0;
    // clone default characters into party (first 2)
    state.party = (window.GAME_CONFIG.characters || []).map(c=>Object.assign({}, c));
    state.inventory = (window.GAME_CONFIG.startingItems||[]).slice();
    state.equips = {};
    state.party.forEach(c=>{ state.equips[c.id] = { weapon:null, armor:null, accessory:null } });
    save();
  }

  function getState(){ return state }

  function save(){ localStorage.setItem(KEY, JSON.stringify(state)) }
  function load(){ const s=localStorage.getItem(KEY); if(s){ state=JSON.parse(s); // ensure new fields exist
      state.holy_crystal = state.holy_crystal || 0;
      state.recruitPity = state.recruitPity || { pullsSinceSR: 0 };
      state.collection = state.collection || [];
      state.shards = state.shards || {};
      return true }
    return false }

  function addPoints(n){ state.points = Math.max(0, (state.points||0) + Math.floor(n)); save() }

  function addHolyCrystal(n){ state.holy_crystal = Math.max(0, (state.holy_crystal||0) + Math.floor(n)); save(); }

  function spendHolyCrystal(n){ if((state.holy_crystal||0) < n) return false; state.holy_crystal -= n; save(); return true }

  function startBattle(){ if(state.inBattle) return false; state.inBattle=true; save(); return true }
  function endBattle(){ state.inBattle=false; save() }

  function battleRound(){
    // 基于角色实际属性与装备计算团队攻击力
    const team = (state.party||[]).map(ch=>getEffectiveStats(ch.id));
    const teamAttack = team.reduce((s,x)=>s + (x.atk||0), 0);
    // 按团队攻击计算伤害波动
    const dmg = Math.floor(teamAttack * (0.8 + Math.random()*0.6));
    const winChance = Math.min(0.9, 0.35 + teamAttack / 2000);
    const win = Math.random() < winChance;
    let log = '';
    if(win){
      const gain = Math.max(1, Math.floor(dmg * 0.6));
      state.points += gain;
      if(state.party[0]) addExp(state.party[0].id, Math.floor(gain/2));
      log = `队伍造成 ${dmg} 伤害（攻击 ${Math.round(teamAttack)}），胜利，获得点数 ${gain}`;
    } else {
      const loss = Math.max(1, Math.floor(dmg * 0.25));
      state.points = Math.max(0, state.points - loss);
      log = `队伍受到 ${dmg} 伤害（攻击 ${Math.round(teamAttack)}），失败，损失点数 ${loss}`;
    }
    save();
    return {log, state: JSON.parse(JSON.stringify(state)), win, teamAttack}
  }

  function getEffectiveStats(charId){
    const ch = findChar(charId);
    if(!ch) return null;
    const lvMul = 1 + ((ch.level||1)-1) * 0.035;
    const baseAtk = (ch.muscle || 0) * lvMul;
    const baseHp = (ch.cell || 0) * lvMul;
    const equip = state.equips[charId] || {};
    let weaponAtk = 0, armorHp = 0, crit = 0;
    if(equip.weapon){ const meta = (window.V5 && window.V5.equipments||[]).find(i=>i.id===equip.weapon); if(meta){ weaponAtk += meta.atk||0; crit += meta.crit||0 } }
    if(equip.armor){ const meta = (window.V5 && window.V5.equipments||[]).find(i=>i.id===equip.armor); if(meta){ armorHp += meta.hp||0 } }
    const atk = Math.floor(baseAtk + weaponAtk);
    const hp = Math.floor(baseHp + armorHp);
    return { atk, hp, crit };
  }

  function idleRatePerSecond(){
    const base = window.GAME_CONFIG.idleBasePerSecond || 1;
    const partyBonus = (state.party || []).reduce((s,c)=>s + (c.muscle||0)/100, 0);
    return base + partyBonus;
  }

  function tickIdle(seconds){
    if(!state.idleOn) return 0;
    const rate = idleRatePerSecond();
    const gain = rate * seconds;
    addPoints(gain);
    return gain;
  }

  function setIdle(on){ state.idleOn = !!on; save() }

  function findChar(id){ return state.party.find(c=>c.id===id) }

  function addExp(charId, amount){
    const ch = findChar(charId);
    if(!ch) return;
    ch.exp = (ch.exp||0) + amount;
    // 升级
    while(ch.exp >= expForLevel(ch.level || 1)){
      const need = expForLevel(ch.level || 1);
      ch.exp -= need;
      ch.level = (ch.level||1) + 1;
      // 升级增加少量属性
      ch.muscle = Math.floor(ch.muscle * 1.03);
      ch.cell = Math.floor(ch.cell * 1.03);
    }
    save();
  }

  // Inventory / Equipment
  function addItem(itemId){
    state.inventory = state.inventory || [];
    if(state.inventory.length >= (window.GAME_CONFIG.inventoryCapacity||40)) return false;
    state.inventory.push(itemId); save(); return true
  }

  // Recruitment and drops
  function weightedChoice(map){
    const entries = Object.entries(map);
    const total = entries.reduce((s,[,v])=>s+v,0);
    let r = Math.random() * total;
    for(const [k,v] of entries){ r -= v; if(r<=0) return k }
    return entries[entries.length-1][0];
  }

  function recruitOnce(costCrystals){
    const cost = typeof costCrystals === 'number' ? costCrystals : 1;
    if(!spendHolyCrystal(cost)) return { error: '圣晶不足' };
    const rates = (window.V5 && window.V5.recruitRates && window.V5.recruitRates.single) || { N:0.6, R:0.3, SR:0.08, SSR:0.015, UR:0.005 };
    // pity: 保证第10抽至少SR
    let rarity;
    if(state.recruitPity.pullsSinceSR >= 9){
      // pick from SR/SSR/UR weighted
      rarity = weightedChoice({ SR:0.9, SSR:0.09, UR:0.01 });
    } else {
      rarity = weightedChoice(rates);
    }
    const pool = (window.V5 && window.V5.characters || []).filter(c=>c.rarity === rarity);
    const chosen = pool.length ? pool[Math.floor(Math.random()*pool.length)] : ((window.V5 && window.V5.characters||[])[Math.floor(Math.random()*((window.V5 && window.V5.characters||[]).length||1))]);
    if(!chosen) return { error: '无可用角色' };
    const cid = chosen.id;
    let isNew = false; let shardsAdded = 0;
    if(state.collection.indexOf(cid) >= 0){
      // duplicate -> 转为碎片
      shardsAdded = rarity === 'N' ? 5 : rarity === 'R' ? 20 : rarity === 'SR' ? 50 : rarity === 'SSR' ? 180 : 600;
      state.shards[cid] = (state.shards[cid]||0) + shardsAdded;
    } else {
      state.collection.push(cid);
      // add base character instance
      const base = Object.assign({}, chosen, { level:1, exp:0 });
      state.party.push(base);
      state.equips[base.id] = { weapon:null, armor:null, accessory:null };
      isNew = true;
    }
    // update pity
    if(['SR','SSR','UR'].includes(rarity)) state.recruitPity.pullsSinceSR = 0; else state.recruitPity.pullsSinceSR++;
    save();
    return { rarity, id: cid, name: chosen.name, isNew, shardsAdded };
  }

  function recruitMulti(n, costEach){
    const results = [];
    for(let i=0;i<n;i++) results.push(recruitOnce(costEach));
    return results;
  }

  function getCollection(){ return { collection: state.collection||[], shards: state.shards||{} } }

  function removeItem(itemId){
    const i = (state.inventory||[]).indexOf(itemId);
    if(i>=0){ state.inventory.splice(i,1); save(); return true }
    return false
  }

  function equipItem(charId, slot, itemId){
    const item = (window.V5 && window.V5.equipments || []).find(it=>it.id===itemId);
    if(!item) return false;
    if(item.slot !== slot) return false;
    if(!removeItem(itemId)) return false;
    const cur = state.equips[charId] || {};
    if(cur[slot]) addItem(cur[slot]);
    cur[slot]=itemId; state.equips[charId]=cur; save(); return true
  }

  function unequipItem(charId, slot){
    const cur = state.equips[charId]||{};
    if(!cur[slot]) return false;
    const id = cur[slot]; cur[slot]=null; addItem(id); save(); return true
  }

  function getInventory(){ return state.inventory||[] }
  function getEquips(){ return state.equips || {} }

  // Events and dungeon
  function generateDungeon(dungeonId){
    const d = (window.V5 && window.V5.dungeons || []).find(x=>x.id===dungeonId);
    if(!d) return null;
    const nodes = [];
    for(let i=0;i<d.nodes;i++){
      const isEvent = Math.random() < 0.5;
      const evt = isEvent ? (d.eventPool && d.eventPool[Math.floor(Math.random()*(d.eventPool.length||1))]) : null;
      nodes.push({ idx:i+1, type: isEvent? 'event':'combat', eventId: evt });
    }
    return { dungeonId: d.id, name: d.name, nodes, cur:0, difficulty: d.difficulty || 1 };
  }

  function advanceDungeon(dg){
    if(!dg) return null;
    if(dg.cur >= dg.nodes.length) return { finished:true };
    const node = dg.nodes[dg.cur++];
    if(node.type === 'event'){
      const ev = (window.V5 && window.V5.events || []).find(e=>e.id===node.eventId);
      return { node, event: ev };
    } else {
      const res = battleRound();
      if(res.win && Math.random()<0.4){
        const loot = (window.V5 && window.V5.equipments || [])[Math.floor(Math.random()*((window.V5 && window.V5.equipments||[]).length||1))];
        if(loot) addItem(loot.id);
        // 额外掉落圣晶概率，基于副本难度
        const diff = dg.difficulty || 1;
        const crystalChance = diff === 1 ? 0.15 : diff === 2 ? 0.30 : 0.5;
        let crystalGot = 0;
        if(Math.random() < crystalChance){ addHolyCrystal(1); crystalGot = 1 }
        return { node, combat: res, loot: loot && loot.id, crystal: crystalGot };
      }
      return { node, combat: res };
    }
  }

  function handleEventChoice(eventId, choiceId){
    const ev = (window.V5 && window.V5.events || []).find(e=>e.id===eventId);
    if(!ev) return null;
    const choice = ev.choices.find(c=>c.id===choiceId);
    if(!choice) return null;
    if(choice.gain && choice.gain.points) addPoints(choice.gain.points);
    if(choice.gain && choice.gain.item) addItem(choice.gain.item);
    if(choice.gain && choice.gain.holy_crystal) addHolyCrystal(choice.gain.holy_crystal);
    return { result: choice.result, gain: choice.gain };
  }

  return { init, getState, save, load, startBattle, endBattle, battleRound, addPoints, tickIdle, idleRatePerSecond, setIdle, addExp, expForLevel,
    addItem, removeItem, equipItem, unequipItem, getInventory, getEquips, generateDungeon, advanceDungeon, handleEventChoice, getEffectiveStats }
})();