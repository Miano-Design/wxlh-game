/* 《无限轮回》核心逻辑：状态 / 存档 / 挂机 / 养成 / 经济 */
window.Core = (function () {
  const D = window.DATA;
  const SAVE_KEY = 'wxlh_save_v5';
  const SLOT_COUNT = 3;
  const slotKey = n => `${SAVE_KEY}_slot${n}`;
  let S = null;
  let uidCounter = 1;

  /* ================= 存档 ================= */
  function defaultState() {
    return {
      v: 5,
      createdAt: Date.now(),
      player: { name: '轮回者', level: 1, exp: 0, geneLock: 0, reincarnations: 0, talents: { body: 0, energy: 0, nerve: 0, grace: 0 } },
      cur: { points: 0, story: 0, otherworld: 0, holy: 0, skillChip: 0, bloodCrystal: 0, corridor: 0, rp: 0 },
      chars: {},            // id → {lv, exp, star, shards, skillLv:[1,1,1], bloodlineLv}
      party: [null, null, null, null],   // 0,1 前排；2,3 后排
      equips: {},           // uid → 装备实例
      equipped: {},         // charId → {weapon, armor, accessory}
      items: {},            // itemId → count
      buildings: { core: 1, training: 1, medical: 1, workshop: 1, geneLab: 1 },
      worlds: {},           // worldId → {unlocked, stages: {normal:[stars×12], hard, hell}}
      corridor: { floor: 1, best: 0 },
      recruit: { pityAdv: 0, pityLim: 0, lastFree: '' },
      shop: { dailyDate: '', dailyItems: [], bought: {} },
      tasks: { date: '', daily: {}, claimed: {}, allClaimed: false },
      login: { day: 0, lastClaim: '' },
      idle: { bankSec: 0, lastTs: Date.now() },
      stats: { battles: 0, wins: 0, bosses: 0, runs: 0, recruits: 0, enhances: 0, bestFloor: 0 },
      settings: { speed: 1, autoSellN: false, autoSellR: false, muted: false },
      codex: { chars: [], equipsSeen: 0 },
      achievements: {},
      unlocks: {},
      quests: { claimed: [] },
      ssrTicket: 0,
      tutorial: false,
    };
  }

  function save() {
    S.idle.lastTs = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || data.v !== 5) return false;
      S = Object.assign(defaultState(), data);
      return true;
    } catch (e) { return false; }
  }
  function newGame() {
    S = defaultState();
    S.player.name = '';   // 创建角色时填写
    // 新手资源（V5.0 §113）
    addCur('points', D.STARTER.points);
    addCur('holy', D.STARTER.holy);
    Object.entries(D.STARTER.items).forEach(([k, v]) => addItem(k, v));
    D.STARTER.chars.forEach(id => addChar(id));
    S.party = ['C001', null, null, null];
    unlockWorld('W01');
    save();
  }
  function setPlayerName(name) {
    name = String(name || '').trim().slice(0, 12);
    if (!name) return false;
    S.player.name = name;
    save();
    return true;
  }
  // 主角显示名（C001 即玩家本人）
  function charName(id) {
    if (id === 'C001' && S.player.name) return S.player.name;
    return D.charById[id] ? D.charById[id].name : id;
  }
  function exportSave() { return JSON.stringify(S); }
  function importSave(json) {
    try {
      const data = JSON.parse(json);
      if (!data || data.v !== 5) return { ok: false, msg: '存档版本不兼容' };
      S = Object.assign(defaultState(), data);
      save();
      return { ok: true };
    } catch (e) { return { ok: false, msg: '存档文件损坏' }; }
  }
  function saveSlot(n) { try { localStorage.setItem(slotKey(n), JSON.stringify(S)); return true; } catch (e) { return false; } }
  function loadSlot(n) {
    try {
      const raw = localStorage.getItem(slotKey(n));
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.v !== 5) return false;
      S = Object.assign(defaultState(), data);
      save();
      return true;
    } catch (e) { return false; }
  }
  function slotInfo() {
    const out = [];
    for (let i = 1; i <= SLOT_COUNT; i++) {
      const raw = localStorage.getItem(slotKey(i));
      let meta = null;
      if (raw) { try { const d = JSON.parse(raw); meta = { level: d.player.level, floor: d.corridor.best, time: d.idle && d.idle.lastTs }; } catch (e) {} }
      out.push({ slot: i, exists: !!raw, meta });
    }
    return out;
  }

  /* ================= 货币 ================= */
  function addCur(id, n) {
    if (!n) return;
    S.cur[id] = Math.max(0, (S.cur[id] || 0) + Math.floor(n));
  }
  function canAfford(cost) {
    return Object.entries(cost).every(([k, v]) => (S.cur[k] || 0) >= v);
  }
  function spend(cost) {
    if (!canAfford(cost)) return false;
    Object.entries(cost).forEach(([k, v]) => { S.cur[k] -= v; });
    return true;
  }

  /* ================= 道具 ================= */
  function addItem(id, n = 1) {
    S.items[id] = (S.items[id] || 0) + n;
  }
  function removeItem(id, n = 1) {
    if ((S.items[id] || 0) < n) return false;
    S.items[id] -= n;
    if (S.items[id] <= 0) delete S.items[id];
    return true;
  }

  /* ================= 角色 ================= */
  function addChar(id) {
    const base = D.charById[id];
    if (!base) return { isNew: false };
    if (S.chars[id]) {
      const gain = D.DUP_SHARDS[base.rarity];
      S.chars[id].shards += gain;
      return { isNew: false, shards: gain };
    }
    S.chars[id] = { lv: 1, exp: 0, star: 1, shards: 0, skillLv: [1, 1, 1], bloodlineLv: 0 };
    S.equipped[id] = { weapon: null, armor: null, accessory: null };
    if (!S.codex.chars.includes(id)) S.codex.chars.push(id);
    return { isNew: true };
  }
  function addShards(id, n) {
    if (S.chars[id]) S.chars[id].shards += n;
    else { addChar(id); S.chars[id].shards += n; }
  }
  function levelCost(charId) {
    const c = S.chars[charId];
    if (!c || c.lv >= 100) return null;
    return { exp: D.EXP_TABLE[c.lv], points: D.LEVEL_POINTS[c.lv] };
  }
  function levelUp(charId, times = 1) {
    const c = S.chars[charId];
    if (!c) return { ok: false, msg: '未拥有该角色' };
    let ups = 0;
    for (let i = 0; i < times; i++) {
      if (c.lv >= 100) break;
      const cost = levelCost(charId);
      if (c.exp < cost.exp || S.cur.points < cost.points) break;
      c.exp -= cost.exp; S.cur.points -= cost.points;
      c.lv++; ups++;
    }
    save();
    return { ok: ups > 0, ups, msg: ups > 0 ? `升到 Lv.${c.lv}` : '经验或点数不足' };
  }
  function useExpItem(charId, itemId) {
    const item = D.ITEMS[itemId];
    if (!item || item.type !== 'exp') return { ok: false, msg: '不是经验道具' };
    const c = S.chars[charId];
    if (!c) return { ok: false, msg: '未拥有该角色' };
    if (!removeItem(itemId)) return { ok: false, msg: '道具不足' };
    c.exp += item.exp;
    task('item1', 1);
    save();
    return { ok: true, msg: `+${item.exp} EXP` };
  }
  function starUp(charId) {
    const c = S.chars[charId];
    const base = D.charById[charId];
    if (!c) return { ok: false, msg: '未拥有该角色' };
    const maxStar = D.RARITY_MAXSTAR[base.rarity];
    if (c.star >= maxStar) return { ok: false, msg: '已达最高星级' };
    const need = D.STAR_COST[c.star];
    if (c.shards < need) return { ok: false, msg: `碎片不足（${c.shards}/${need}）` };
    c.shards -= need;
    c.star++;
    save();
    return { ok: true, msg: `升到 ${c.star}★` };
  }
  const SKILL_CHIP_COST = [10, 20, 35, 55, 80, 110, 150, 200, 260];
  function skillUp(charId, idx) {
    const c = S.chars[charId];
    if (!c) return { ok: false, msg: '未拥有该角色' };
    const lv = c.skillLv[idx];
    if (lv >= 10) return { ok: false, msg: '已满级' };
    const cost = SKILL_CHIP_COST[lv - 1];
    if (S.cur.skillChip < cost) return { ok: false, msg: `技能芯片不足（${S.cur.skillChip}/${cost}）` };
    S.cur.skillChip -= cost;
    c.skillLv[idx]++;
    save();
    return { ok: true, msg: `技能升到 Lv.${c.skillLv[idx]}` };
  }

  /* ================= 血统 / 基因锁 ================= */
  function bloodlineUpgrade(charId) {
    const c = S.chars[charId];
    const base = D.charById[charId];
    if (!c) return { ok: false, msg: '未拥有该角色' };
    if (c.bloodlineLv >= D.BLOODLINE_MAX) return { ok: false, msg: '血统已满级' };
    let cost = D.bloodlineCost(c.bloodlineLv);
    const discount = Math.min(0.4, S.buildings.geneLab * 0.01);
    cost = { bloodCrystal: Math.ceil(cost.bloodCrystal * (1 - discount)), points: Math.ceil(cost.points * (1 - discount)) };
    if (!spend(cost)) return { ok: false, msg: '血统结晶或点数不足' };
    c.bloodlineLv++;
    save();
    return { ok: true, msg: `${base.bloodline}血统 Lv.${c.bloodlineLv}` };
  }
  function geneLockInfo() {
    const cur = S.player.geneLock;
    if (cur >= 5) return { max: true };
    const next = D.GENE_LOCKS[cur];
    const reqs = [];
    const worldReq = ['W01', 'W03', 'W06', 'W09', 'W12'][cur];
    const lvReq = [1, 20, 40, 60, 80][cur];
    const cleared = S.worlds[worldReq] && S.worlds[worldReq].stages.normal.every(s => s > 0);
    if (!cleared) reqs.push(`通关${D.WORLDS.find(w => w.id === worldReq).name}·普通`);
    if (S.player.level < lvReq) reqs.push(`玩家等级达到 Lv.${lvReq}`);
    if (S.cur.bloodCrystal < next.cost.bloodCrystal) reqs.push(`血统结晶 ${S.cur.bloodCrystal}/${next.cost.bloodCrystal}`);
    return { max: false, next, can: reqs.length === 0, reqs };
  }
  function geneLockUnlock() {
    const info = geneLockInfo();
    if (info.max) return { ok: false, msg: '基因锁已完全解锁' };
    if (!info.can) return { ok: false, msg: info.reqs.join('；') };
    S.cur.bloodCrystal -= info.next.cost.bloodCrystal;
    S.player.geneLock++;
    save();
    return { ok: true, msg: `基因锁 ${info.next.name} 已解锁！` };
  }

  /* ================= 属性计算 ================= */
  // 装备面板数值（含强化）
  function equipStats(eq) {
    const mult = 1 + eq.enhance * 0.05;
    const out = { atk: 0, def: 0, hp: 0, spd: 0, critPct: 0 };
    Object.entries(eq.base).forEach(([k, v]) => { out[k] = (out[k] || 0) + v * mult; });
    const affix = {};
    eq.affixes.forEach(a => { affix[a.k] = (affix[a.k] || 0) + a.v; });
    return { flat: out, affix };
  }
  function effectiveStats(charId) {
    const c = S.chars[charId];
    const base = D.charById[charId];
    if (!c || !base) return null;
    const lvMult = 1 + (c.lv - 1) * 0.035;
    const starMult = D.STAR_MULT[c.star - 1];
    const a = {};
    Object.keys(base.attrs).forEach(k => { a[k] = base.attrs[k] * lvMult * starMult; });
    // 百分比加成（加算区）
    const pct = { atkPct: 0, hpPct: 0, defPct: 0, spdPct: 0, critPct: 0, critDmg: 0, skillPct: 0, evaPct: 0, resPct: 0, lifesteal: 0, spiritPct: 0 };
    // 血统
    const bl = D.BLOODLINES[base.bloodline];
    if (bl && c.bloodlineLv > 0) {
      const blm = c.bloodlineLv * (S.player.geneLock >= 4 ? 1.5 : 1);
      if (bl.atkPct) pct.atkPct += bl.atkPct * blm;
      if (bl.hpPct) pct.hpPct += bl.hpPct * blm;
      if (bl.defPct) pct.defPct += bl.defPct * blm;
      if (bl.skillPct) pct.skillPct += bl.skillPct * blm;
      if (bl.critPct) pct.critPct += bl.critPct * blm;
      if (bl.lifesteal) pct.lifesteal += bl.lifesteal * blm;
      if (bl.spdPct) pct.spdPct += bl.spdPct * blm;
      if (bl.spiritPct) pct.spiritPct += bl.spiritPct * blm;
      if (bl.allPct) { pct.atkPct += bl.allPct * blm; pct.hpPct += bl.allPct * blm; pct.defPct += bl.allPct * blm; pct.spdPct += bl.allPct * blm; }
    }
    // 基因锁
    if (S.player.geneLock >= 1) { pct.atkPct += 0.05; pct.hpPct += 0.05; pct.defPct += 0.05; pct.spdPct += 0.05; }
    if (S.player.geneLock >= 2) pct.skillPct += 0.15;
    if (S.player.geneLock >= 5) { pct.atkPct += 0.15; pct.hpPct += 0.15; pct.defPct += 0.15; pct.spdPct += 0.15; }
    // 转生天赋
    const t = S.player.talents;
    pct.hpPct += [0, .05, .05, 0, .08, 0, .12, 0, 0, .20, 0].slice(0, t.body + 1).reduce((x, y) => x + y, 0);
    pct.defPct += [0, 0, .05, 0, 0, 0, 0, .08, 0, 0, 0].slice(0, t.body + 1).reduce((x, y) => x + y, 0);
    pct.spiritPct += [0, .05, 0, 0, .08, 0, 0, .12, 0, 0, 0].slice(0, t.energy + 1).reduce((x, y) => x + y, 0);
    pct.skillPct += [0, 0, .05, 0, 0, .08, 0, 0, .12, 0, .25].slice(0, t.energy + 1).reduce((x, y) => x + y, 0);
    pct.spdPct += [0, .05, 0, 0, .08, 0, 0, .12, 0, 0, .20].slice(0, t.nerve + 1).reduce((x, y) => x + y, 0);
    pct.critPct += [0, 0, .03, 0, 0, 0, 0, .05, 0, 0, 0].slice(0, t.nerve + 1).reduce((x, y) => x + y, 0);
    pct.critDmg += [0, 0, 0, 0, 0, .10, 0, 0, 0, 0, 0].slice(0, t.nerve + 1).reduce((x, y) => x + y, 0);
    pct.evaPct += [0, 0, 0, .02, 0, 0, 0, 0, .04, 0, 0].slice(0, t.nerve + 1).reduce((x, y) => x + y, 0);
    // 装备
    const eq = S.equipped[charId] || {};
    const flat = { atk: 0, def: 0, hp: 0, spd: 0 };
    let sets = {};
    Object.values(eq).forEach(uid => {
      if (!uid || !S.equips[uid]) return;
      const e = S.equips[uid];
      const st = equipStats(e);
      Object.keys(flat).forEach(k => { flat[k] += st.flat[k] || 0; });
      flat.spd += st.flat.spd || 0;
      pct.critPct += st.flat.critPct || 0;
      Object.entries(st.affix).forEach(([k, v]) => { pct[k] = (pct[k] || 0) + v; });
      sets[e.set] = (sets[e.set] || 0) + 1;
    });
    Object.entries(sets).forEach(([setId, n]) => {
      const set = D.SETS[setId];
      if (!set) return;
      if (n >= 2 && set.b2) Object.entries(set.b2).forEach(([k, v]) => { pct[k] += v; });
      if (n >= 3 && set.b3) Object.entries(set.b3).forEach(([k, v]) => { if (k !== 'text') pct[k] += v; });
    });
    // 主攻击属性
    const atkAttr = D.ATK_ATTR[base.kind] || 'muscle';
    if (pct.spiritPct) a.spirit *= (1 + pct.spiritPct);
    const atk = (a[atkAttr] * 1.8 + flat.atk) * (1 + pct.atkPct);
    const def = (a.immune * 1.6 + flat.def) * (1 + pct.defPct);
    const hp = (a.cell * 25 + flat.hp) * (1 + pct.hpPct);
    const spd = (a.nerve * 1.2 + flat.spd) * (1 + pct.spdPct);
    const crit = Math.min(0.6, 0.05 + a.intelligence * 0.0008 + pct.critPct);
    const eva = Math.min(0.6, a.nerve * 0.0012 + pct.evaPct);
    const skillMult = 1 + a.spirit * 0.006 + pct.skillPct;
    return {
      atk: Math.round(atk), def: Math.round(def), hp: Math.round(hp), spd: Math.round(spd),
      crit, critDmg: 2.0 + pct.critDmg, eva, skillMult,
      lifesteal: pct.lifesteal + (base.kind === 'vampire' ? 0.1 : 0),
      resPct: pct.resPct || 0,
      attrs: a, sets,
    };
  }
  function power(charId) {
    const st = effectiveStats(charId);
    if (!st) return 0;
    return Math.round(st.atk * 2 + st.def + st.hp * 0.2 + st.spd * 3);
  }
  function teamPower() {
    return S.party.filter(Boolean).reduce((sum, id) => sum + power(id), 0);
  }
  function factionBuffs(partyIds) {
    const count = {};
    partyIds.filter(Boolean).forEach(id => { const f = D.charById[id].faction; count[f] = (count[f] || 0) + 1; });
    let atkPct = 0, hpPct = 0, skillPct = 0;
    Object.values(count).forEach(n => {
      if (n >= 4) { atkPct += 0.10; hpPct += 0.10; skillPct += 0.05; }
      else if (n >= 3) { atkPct += 0.06; hpPct += 0.06; }
      else if (n >= 2) { atkPct += 0.03; }
    });
    return { atkPct, hpPct, skillPct, count };
  }

  /* ================= 装备操作 ================= */
  function grantEquip(worldId, rarity, slot) {
    const uid = 'eq' + Date.now().toString(36) + '_' + (uidCounter++);
    const slots = slot ? [slot] : ['weapon', 'armor', 'accessory'];
    const s = slots[Math.floor(Math.random() * slots.length)];
    const eq = D.makeEquip(worldId, s, rarity, uid);
    S.equips[uid] = eq;
    S.codex.equipsSeen++;
    // 自动出售
    if ((rarity === 'N' && S.settings.autoSellN) || (rarity === 'R' && S.settings.autoSellR)) {
      const gain = D.DECOMPOSE_GAIN[rarity];
      delete S.equips[uid];
      addCur('otherworld', gain);
      return { sold: true, gain };
    }
    return { equip: eq };
  }
  function equipItem(charId, uid) {
    const eq = S.equips[uid];
    if (!eq || !S.chars[charId]) return false;
    S.equipped[charId][eq.slot] = uid;
    save();
    return true;
  }
  function unequipItem(charId, slot) {
    if (!S.equipped[charId]) return false;
    S.equipped[charId][slot] = null;
    save();
    return true;
  }
  function enhanceCost(eq) {
    const base = Math.round((100 + eq.enhance * 60) * D.EQUIP_RARITY_MULT[eq.rarity]);
    const discount = Math.min(0.4, S.buildings.workshop * 0.01);
    return { points: Math.ceil(base * (1 - discount)), otherworld: 2 + Math.floor(eq.enhance / 5) * 2 };
  }
  function enhance(uid) {
    const eq = S.equips[uid];
    if (!eq) return { ok: false, msg: '装备不存在' };
    if (eq.enhance >= 20) return { ok: false, msg: '已满强化' };
    const cost = enhanceCost(eq);
    if (!spend(cost)) return { ok: false, msg: '点数或异界结晶不足' };
    const rate = D.ENHANCE_RATE[eq.enhance];
    S.stats.enhances++;
    task('enhance1', 1);
    if (Math.random() < rate) {
      eq.enhance++;
      save();
      return { ok: true, msg: `强化成功 +${eq.enhance}` };
    }
    save();
    return { ok: false, fail: true, msg: `强化失败（成功率 ${Math.round(rate * 100)}%），装备未降级` };
  }
  function decompose(uid) {
    const eq = S.equips[uid];
    if (!eq) return { ok: false };
    let gain = D.DECOMPOSE_GAIN[eq.rarity];
    gain += Math.floor(eq.enhance * 3);   // 强化投入部分返还
    // 若装备中先卸下
    Object.values(S.equipped).forEach(slots => {
      Object.keys(slots).forEach(k => { if (slots[k] === uid) slots[k] = null; });
    });
    delete S.equips[uid];
    addCur('otherworld', gain);
    save();
    return { ok: true, gain };
  }
  function inventoryEquips() {
    const equippedUids = new Set();
    Object.values(S.equipped).forEach(slots => Object.values(slots).forEach(u => u && equippedUids.add(u)));
    return Object.values(S.equips).sort((a, b) => D.RARITIES.indexOf(b.rarity) - D.RARITIES.indexOf(a.rarity) || b.enhance - a.enhance);
  }

  /* ================= 招募 ================= */
  function rollRarityInPool(pool) {
    let r = Math.random(), acc = 0;
    for (const [rar, p] of Object.entries(D.RECRUIT_POOLS[pool].rates)) {
      acc += p;
      if (r <= acc) return rar;
    }
    return 'R';
  }
  function pickCharOfRarity(rar, pool) {
    let poolChars = D.characters.filter(c => c.rarity === rar && !c.hidden && c.id !== 'C001');
    if (pool === 'limited') poolChars = poolChars.concat(D.characters.filter(c => c.hidden));
    return poolChars[Math.floor(Math.random() * poolChars.length)];
  }
  function recruitOnce(pool) {
    const p = D.RECRUIT_POOLS[pool];
    if (!spend(p.cost)) return { error: '货币不足' };
    S.stats.recruits++;
    task('recruit1', 1);
    const pityKey = pool === 'limited' ? 'pityLim' : 'pityAdv';
    let rar = rollRarityInPool(pool);
    if (pool !== 'normal') {
      S.recruit[pityKey]++;
      if (S.recruit[pityKey] >= D.PITY.UR) rar = 'UR';
      else if (S.recruit[pityKey] >= D.PITY.SSR && D.RARITIES.indexOf(rar) < 3) rar = 'SSR';
    }
    if (D.RARITIES.indexOf(rar) >= 3) S.recruit[pityKey] = 0;
    const base = pickCharOfRarity(rar, pool);
    const res = addChar(base.id);
    save();
    return { id: base.id, name: base.name, rarity: base.rarity, isNew: res.isNew, shards: res.shards || 0 };
  }
  function recruitTen(pool) {
    const cost = pool === 'normal' ? { points: 45000 } : D.RECRUIT_TEN_COST;
    if (!canAfford(cost)) return { error: '货币不足' };
    const results = [];
    let hasSR = false;
    for (let i = 0; i < 10; i++) {
      const r = recruitOnce(pool);
      if (r.error) return { error: r.error, results };
      if (D.RARITIES.indexOf(r.rarity) >= 2) hasSR = true;
      results.push(r);
    }
    // 十连保证至少 1 个 SR
    if (!hasSR) {
      const base = pickCharOfRarity('SR', pool);
      const res = addChar(base.id);
      results[results.length - 1] = { id: base.id, name: base.name, rarity: 'SR', isNew: res.isNew, shards: res.shards || 0, pityFix: true };
    }
    save();
    return { results };
  }
  function freeRecruitAvailable() {
    const today = new Date().toDateString();
    return S.recruit.lastFree !== today;
  }
  function freeRecruit() {
    if (!freeRecruitAvailable()) return { error: '今日已领取' };
    S.recruit.lastFree = new Date().toDateString();
    const rar = Math.random() < 0.5 ? 'N' : Math.random() < 0.85 ? 'R' : 'SR';
    const base = pickCharOfRarity(rar, 'normal');
    const res = addChar(base.id);
    task('recruit1', 1);
    save();
    return { id: base.id, name: base.name, rarity: base.rarity, isNew: res.isNew, shards: res.shards || 0 };
  }
  function ssrTicketUse(charId) {
    const base = D.charById[charId];
    if (!base || base.rarity !== 'SSR' || S.ssrTicket <= 0) return { ok: false, msg: '无法选择' };
    S.ssrTicket--;
    addChar(charId);
    save();
    return { ok: true, msg: `获得 ${base.name}` };
  }

  /* ================= 挂机 ================= */
  function idleRates() {
    const lv = S.player.level;
    const coreBonus = 1 + S.buildings.core * 0.02 + (S.player.geneLock >= 1 ? 0.10 : 0) + talentGraceMult();
    return {
      pointsPerMin: (8 + lv * 0.2) * coreBonus,
      expPerMin: (5 + lv * 0.15) * (1 + S.buildings.training * 0.03),
      otherworldPer10Min: 1 + Math.floor(lv / 50),
      storyPer30Min: 1,
    };
  }
  function talentGraceMult() {
    const t = S.player.talents.grace;
    return [0, .05, 0, 0, .08, 0, .12, 0, 0, .20, 0].slice(0, t + 1).reduce((x, y) => x + y, 0);
  }
  function offlineCapHours() {
    let cap = 12 + (S.player.geneLock >= 5 ? 12 : 0);
    cap += S.buildings.medical * 0.2;
    return cap;
  }
  function offlineEfficiency() {
    return Math.min(1.5, 0.85 + S.buildings.medical * 0.01 + (S.player.talents.grace >= 10 ? 0.15 : 0));
  }
  // 上线结算离线收益
  function settleOffline() {
    const now = Date.now();
    const last = S.idle.lastTs || now;
    if (now < last - 60000) { S.idle.lastTs = now; return { cheat: true }; }   // 防改时间
    const elapsedSec = Math.min((now - last) / 1000, offlineCapHours() * 3600);
    if (elapsedSec < 60) { S.idle.lastTs = now; return null; }
    const eff = offlineEfficiency();
    const r = idleRates();
    const mins = elapsedSec / 60 * eff;
    const gains = {
      points: Math.round(r.pointsPerMin * mins),
      exp: Math.round(r.expPerMin * mins),
      otherworld: Math.floor(elapsedSec / 600) * r.otherworldPer10Min,
      story: Math.floor(elapsedSec / 1800) * r.storyPer30Min,
    };
    S.idle.lastTs = now;
    save();
    return { seconds: elapsedSec, gains, efficiency: eff };
  }
  // 在线挂机：每秒累计
  function onlineTick(dtSec) {
    S.idle.bankSec += dtSec;
  }
  function idleBankGains() {
    const r = idleRates();
    const mins = S.idle.bankSec / 60;
    return {
      points: Math.floor(r.pointsPerMin * mins),
      exp: Math.floor(r.expPerMin * mins),
      otherworld: Math.floor(S.idle.bankSec / 600) * r.otherworldPer10Min,
      story: Math.floor(S.idle.bankSec / 1800) * r.storyPer30Min,
      seconds: S.idle.bankSec,
    };
  }
  function claimIdle() {
    const g = idleBankGains();
    addCur('points', g.points);
    addCur('otherworld', g.otherworld);
    addCur('story', g.story);
    addPlayerExp(g.exp);
    S.idle.bankSec = 0;
    task('idle1', 1);
    save();
    return g;
  }
  function addPlayerExp(n) {
    if (!n) return;
    S.player.exp += n;
    while (S.player.level < 100 && S.player.exp >= D.EXP_TABLE[S.player.level]) {
      S.player.exp -= D.EXP_TABLE[S.player.level];
      S.player.level++;
    }
  }

  /* ================= 建筑 ================= */
  function upgradeBuilding(id) {
    const lv = S.buildings[id];
    if (lv >= 50) return { ok: false, msg: '已满级' };
    const cost = { points: D.buildingCost(id, lv) };
    if (!spend(cost)) return { ok: false, msg: '点数不足' };
    S.buildings[id]++;
    save();
    return { ok: true, msg: `升到 Lv.${S.buildings[id]}` };
  }

  /* ================= 世界进度 ================= */
  function unlockWorld(id) {
    if (!S.worlds[id]) {
      S.worlds[id] = { unlocked: true, stages: { normal: Array(12).fill(0), hard: Array(12).fill(0), hell: Array(12).fill(0) } };
    }
  }
  function worldCleared(id, diff) {
    const w = S.worlds[id];
    return w && w.stages[diff].every(s => s > 0);
  }
  function stageComplete(worldId, diff, stageIdx, stars) {
    unlockWorld(worldId);
    const w = S.worlds[worldId];
    const first = w.stages[diff][stageIdx] === 0;
    w.stages[diff][stageIdx] = Math.max(w.stages[diff][stageIdx], stars);
    let firstClearReward = null;
    if (stageIdx === 11 && w.stages[diff].every(s => s > 0)) {
      // 全难度通关 → 解锁下一世界 / 下一难度提示
      const wi = D.WORLDS.findIndex(x => x.id === worldId);
      if (diff === 'normal' && wi < D.WORLDS.length - 1) unlockWorld(D.WORLDS[wi + 1].id);
      firstClearReward = D.FIRST_CLEAR[diff];
      Object.entries(firstClearReward).forEach(([k, v]) => addCur(k, v));
    }
    S.stats.runs++;
    task('dungeon1', 1);
    const newUnlocks = refreshUnlocks();
    save();
    return { first, firstClearReward, newUnlocks };
  }
  // 根据当前进度刷新功能解锁，返回本次新解锁的功能名列表
  function refreshUnlocks() {
    const newly = [];
    D.UNLOCKS.forEach(u => {
      if (S.unlocks[u.id]) return;
      const w = S.worlds[u.world];
      if (w && w.stages.normal[u.stage - 1] > 0) {
        S.unlocks[u.id] = true;
        newly.push(u.name);
      }
    });
    return newly;
  }
  function isUnlocked(id) {
    if (S.unlocks[id]) return true;
    return false;
  }
  function unlockTip(id) {
    const u = D.UNLOCKS.find(x => x.id === id);
    return u ? u.tip : '';
  }
  /* ================= 主线任务 ================= */
  function mainQuestState() {
    return D.MAIN_QUESTS.map(q => ({
      q,
      done: q.check(S),
      claimed: S.quests.claimed.includes(q.id),
    }));
  }
  function currentQuest() {
    const list = mainQuestState();
    return list.find(x => !x.claimed) || null;
  }
  function claimQuest(id) {
    const q = D.MAIN_QUESTS.find(x => x.id === id);
    if (!q || S.quests.claimed.includes(id)) return { ok: false };
    if (!q.check(S)) return { ok: false, msg: '尚未完成' };
    S.quests.claimed.push(id);
    Object.entries(q.reward).forEach(([k, v]) => addCur(k, v));
    save();
    return { ok: true };
  }
  function stageUnlocked(worldId, diff, stageIdx) {
    const w = S.worlds[worldId];
    if (!w || !w.unlocked) return false;
    if (diff === 'hard' && !worldCleared(worldId, 'normal')) return false;
    if (diff === 'hell' && !worldCleared(worldId, 'hard')) return false;
    if (stageIdx === 0) return true;
    return w.stages[diff][stageIdx - 1] > 0;
  }

  /* ================= 商店 ================= */
  function buyShopItem(shopId, idx) {
    const shop = D.SHOPS[shopId];
    const it = shop.items[idx];
    if (!it) return { ok: false, msg: '商品不存在' };
    const key = shopId + '_' + idx + '_' + dailyDate();
    if (it.stock > 0 && (S.shop.bought[key] || 0) >= it.stock) return { ok: false, msg: '今日已售罄' };
    if (!spend({ [shop.currency]: it.price })) return { ok: false, msg: '货币不足' };
    S.shop.bought[key] = (S.shop.bought[key] || 0) + 1;
    if (it.item) addItem(it.item, it.count || 1);
    if (it.currencyGain) Object.entries(it.currencyGain).forEach(([k, v]) => addCur(k, v));
    if (it.shardRandom) {
      const c = pickCharOfRarity(it.shardRandom, 'normal');
      addShards(c.id, it.shardCount);
      it._lastShard = c.name;
    }
    save();
    return { ok: true, msg: '购买成功' + (it._lastShard ? `（${it._lastShard}碎片）` : '') };
  }
  function openBox(itemId) {
    const item = D.ITEMS[itemId];
    if (!item || item.type !== 'box') return { ok: false, msg: '不是宝箱' };
    if (!removeItem(itemId)) return { ok: false, msg: '没有该宝箱' };
    const world = D.WORLDS[Math.floor(Math.random() * Math.min(3, D.WORLDS.length))];
    const res = grantEquip(world.id, item.rarity);
    save();
    return { ok: true, equip: res.equip, sold: res.sold };
  }
  function dailyDate() { return new Date().toISOString().slice(0, 10); }

  /* ================= 任务 / 登录 ================= */
  function ensureDaily() {
    const today = dailyDate();
    if (S.tasks.date !== today) {
      S.tasks = { date: today, daily: {}, claimed: {}, allClaimed: false };
    }
  }
  function task(id, n = 1) {
    ensureDaily();
    S.tasks.daily[id] = (S.tasks.daily[id] || 0) + n;
  }
  function claimTask(id) {
    ensureDaily();
    const t = D.DAILY_TASKS.find(x => x.id === id);
    if (!t || S.tasks.claimed[id]) return { ok: false };
    if ((S.tasks.daily[id] || 0) < t.target) return { ok: false, msg: '未完成' };
    S.tasks.claimed[id] = true;
    Object.entries(t.reward).forEach(([k, v]) => addCur(k, v));
    save();
    return { ok: true };
  }
  function claimAllTasks() {
    ensureDaily();
    if (S.tasks.allClaimed) return { ok: false, msg: '已领取' };
    const allDone = D.DAILY_TASKS.every(t => (S.tasks.daily[t.id] || 0) >= t.target);
    if (!allDone) return { ok: false, msg: '尚未完成全部任务' };
    S.tasks.allClaimed = true;
    Object.entries(D.DAILY_ALL_REWARD).forEach(([k, v]) => addCur(k, v));
    save();
    return { ok: true };
  }
  function loginReward() {
    const today = dailyDate();
    if (S.login.lastClaim === today) return null;
    S.login.lastClaim = today;
    S.login.day = Math.min(7, S.login.day + 1);
    const r = D.LOGIN_REWARDS[S.login.day - 1];
    if (r.ssrTicket) S.ssrTicket++;
    else {
      Object.entries(r).forEach(([k, v]) => {
        if (k === 'item') addItem(v);
        else addCur(k, v);
      });
    }
    save();
    return { day: S.login.day, reward: r };
  }

  /* ================= 转生 ================= */
  function canReincarnate() {
    return S.player.level >= 100 && S.player.geneLock >= 5 && S.buildings.core >= 30;
  }
  function reincarnate() {
    if (!canReincarnate()) return { ok: false, msg: '条件未满足（玩家Lv100 + 基因锁5阶 + 主神核心Lv30）' };
    const n = S.player.reincarnations + 1;
    const rp = Math.floor(100 * Math.pow(n, 1.15));
    S.player.reincarnations = n;
    addCur('rp', rp);
    // 重置：玩家等级、世界进度、部分建筑
    S.player.level = 1; S.player.exp = 0;
    S.worlds = {};
    unlockWorld('W01');
    S.corridor.floor = 1;
    save();
    return { ok: true, rp, count: n };
  }
  function buyTalent(branch) {
    const lv = S.player.talents[branch];
    if (lv >= 10) return { ok: false, msg: '已满级' };
    const cost = D.TALENT_COSTS[lv];
    if (S.cur.rp < cost) return { ok: false, msg: `转生点不足（${S.cur.rp}/${cost}）` };
    S.cur.rp -= cost;
    S.player.talents[branch]++;
    save();
    return { ok: true };
  }

  /* ================= 战斗结算钩子 ================= */
  function battleSettle(rewards, won, isBoss) {
    if (won) {
      S.stats.wins++;
      Object.entries(rewards).forEach(([k, v]) => {
        if (k === 'exp') { /* 角色经验在战斗内结算 */ }
        else addCur(k, v);
      });
    }
    S.stats.battles++;
    if (isBoss && won) S.stats.bosses++;
    task('battle5', 1);
    save();
  }
  function addCharExp(charIds, exp) {
    charIds.forEach(id => {
      const c = S.chars[id];
      if (c) c.exp += Math.round(exp);
    });
  }

  return {
    get S() { return S; },
    save, load, newGame, exportSave, importSave, saveSlot, loadSlot, slotInfo,
    addCur, canAfford, spend, addItem, removeItem,
    addChar, addShards, levelCost, levelUp, useExpItem, starUp, skillUp, SKILL_CHIP_COST,
    bloodlineUpgrade, geneLockInfo, geneLockUnlock,
    equipStats, effectiveStats, power, teamPower, factionBuffs,
    grantEquip, equipItem, unequipItem, enhanceCost, enhance, decompose, inventoryEquips,
    recruitOnce, recruitTen, freeRecruit, freeRecruitAvailable, ssrTicketUse,
    idleRates, settleOffline, onlineTick, idleBankGains, claimIdle, addPlayerExp, offlineCapHours, offlineEfficiency,
    upgradeBuilding,
    unlockWorld, worldCleared, stageComplete, stageUnlocked,
    refreshUnlocks, isUnlocked, unlockTip,
    mainQuestState, currentQuest, claimQuest,
    setPlayerName, charName,
    buyShopItem, openBox, dailyDate,
    ensureDaily, task, claimTask, claimAllTasks, loginReward,
    canReincarnate, reincarnate, buyTalent,
    battleSettle, addCharExp,
  };
})();
