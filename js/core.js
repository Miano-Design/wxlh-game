/* 《无限轮回》核心逻辑：状态 / 存档 / 挂机 / 养成 / 经济 */
window.Core = (function () {
  const D = window.DATA;
  const SAVE_KEY = 'wxlh_save_v5';
  const SLOT_COUNT = 3;
  const slotKey = n => `${SAVE_KEY}_slot${n}`;
  let S = null;
  let uidCounter = 1;
  // 核心层自己也要给文案用（挂机产线、渡劫消耗），格式与界面保持一致
  function fmtNum(n) {
    n = Math.floor(n || 0);
    if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿';
    if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
    return String(n);
  }

  /* ================= 存档 ================= */
  const ATTR_ZERO = () => ({ muscle: 0, immune: 0, cell: 0, nerve: 0, intelligence: 0, spirit: 0 });
  function freshProtagonist(name) {
    return { name: name || '', level: 1, exp: 0, bloodline: null, bloodlineLv: 0, attrPoints: 0, attrs: ATTR_ZERO(), skillPoints: 0, skillLv: [1, 1, 1] };
  }
  function defaultState() {
    return {
      v: 5,
      createdAt: Date.now(),
      player: Object.assign(freshProtagonist('轮回者'), { geneLock: 0, reincarnations: 0, talents: { body: 0, energy: 0, nerve: 0, grace: 0 } }),
      altPlayers: [],         // 新建的主角（体验不同血统），与当前主角可切换
      bag: { cap: 100, expands: 0 },
      cur: { points: 0, story: 0, otherworld: 0, holy: 0, skillChip: 0, bloodCrystal: 0, corridor: 0, rp: 0 },
      chars: {},            // id → {lv, exp, star, shards, skillLv:[1,1,1], bloodlineLv}
      party: [null, null, null, null],   // 4 个招募位：0,1 前排；2,3 后排（主角必上阵，不占位）
      equips: {},           // uid → 装备实例
      equipped: { '@player': { weapon: null, head: null, armor: null, hands: null, legs: null, accessory: null } },
      items: {},            // itemId → count
      serums: {},           // charId（或 '@player'）→ { serumId: 已服支数 }
      buildings: { core: 1, training: 1, medical: 1, workshop: 1, geneLab: 1 },
      worlds: {},           // worldId → {unlocked, stages: {normal:[stars×12], hard, hell}}
      corridor: { floor: 1, best: 0 },
      // 保底按池分开记账：高级 / 限定 各自算 SSR / UR / 当期 UP 的累计数
      recruit: { pity: { advanced: { ssr: 0, ur: 0, up: 0 }, limited: { ssr: 0, ur: 0, up: 0 } }, lastFree: '' },
      shop: { dailyDate: '', dailyItems: [], bought: {} },
      sweep: { date: '', count: 0 },
      tasks: { date: '', daily: {}, claimed: {}, allClaimed: false, weekKey: '', weekly: {}, weeklyClaimed: {}, weeklyAllClaimed: false },
      login: { day: 0, round: 1, lastClaim: '' },
      idle: { bankSec: 0, lastTs: Date.now(), lines: { cultivate: null, gather: null, explore: null, guard: null } },
      bounty: { start: Date.now(), claimed: {} },   // 限时悬赏：start 是本期起点，每条按自己的 hours 截止
      stats: { battles: 0, wins: 0, bosses: 0, runs: 0, recruits: 0, enhances: 0, bestFloor: 0, profileViews: 0 },
      settings: { speed: 1, autoSellN: false, autoSellR: false, sfx: true, autoBattle: false },
      codex: { chars: [], equipsSeen: 0, claimed: [] },
      achievements: {},       // achId → true（已领取）
      presets: [null, null, null],   // 3 组编队预设（保存队伍成员）
      pendingRun: null,       // 未打完的副本进度：刷新 / 切后台回来可以继续
      unlocks: {},
      quests: { claimed: [] },
      ssrTicket: 0,
      tutorial: false,
    };
  }

  let suppressSave = false;
  function save() {
    if (suppressSave) return;
    S.idle.lastTs = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  }
  // 彻底删除进度（阻止 beforeunload 等钩子重新写入）
  function wipeSave() {
    suppressSave = true;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || data.v !== 5) return false;
      S = Object.assign(defaultState(), data);
      migrate();
      return true;
    } catch (e) { return false; }
  }
  // 旧档迁移：C001 林默不再是主角占位，主角为独立实体
  function migrate() {
    const def = defaultState();
    S.stats = Object.assign(def.stats, S.stats || {});
    S.recruit = Object.assign(def.recruit, S.recruit || {});
    // 招募保底从"两个散字段"改成"按池记账"；老档把旧计数搬过来，进度不丢
    S.recruit.pity = S.recruit.pity || {};
    [['advanced', 'pityAdvS', 'pityAdv'], ['limited', 'pityLimS', 'pityLim']].forEach(([k, ssrKey, urKey]) => {
      const cur = S.recruit.pity[k] || {};
      S.recruit.pity[k] = {
        ssr: cur.ssr || S.recruit[ssrKey] || 0,
        ur: cur.ur || S.recruit[urKey] || 0,
        up: cur.up || 0,
      };
      delete S.recruit[ssrKey];
      delete S.recruit[urKey];
    });
    S.idle.lines = Object.assign({ cultivate: null, gather: null, explore: null, guard: null }, S.idle.lines || {});
    S.bounty = Object.assign({ start: Date.now(), claimed: {} }, S.bounty || {});
    S.bounty.claimed = S.bounty.claimed || {};
    S.player.realm = S.player.realm || 0;   // 已突破的境界数
    S.sweep = Object.assign(def.sweep, S.sweep || {});
    // 老存档补新字段：设置项 / 图鉴领取记录 / 登录轮次
    S.settings = Object.assign(def.settings, S.settings || {});
    S.tasks = Object.assign(def.tasks, S.tasks || {});
    S.tasks.weekly = S.tasks.weekly || {};
    S.tasks.weeklyClaimed = S.tasks.weeklyClaimed || {};
    S.achievements = S.achievements || {};
    S.presets = Array.isArray(S.presets) ? S.presets.slice(0, 3) : [null, null, null];
    while (S.presets.length < 3) S.presets.push(null);
    S.pendingRun = S.pendingRun || null;
    S.serums = S.serums || {};   // 老档补齐：血清服用记录
    // 老档补齐：招募角色的装备槽从 3 个扩到 6 个（世界套装 4/6 件效果才可能触发）
    Object.keys(S.chars || {}).forEach(id => {
      S.equipped[id] = Object.assign({ weapon: null, head: null, armor: null, hands: null, legs: null, accessory: null }, S.equipped[id] || {});
    });
    Object.values(S.equips || {}).forEach(e => { if (e.lock === undefined) e.lock = false; });
    S.codex = Object.assign({ chars: [], equipsSeen: 0 }, S.codex || {});
    S.codex.claimed = Array.isArray(S.codex.claimed) ? S.codex.claimed : [];
    S.login = Object.assign(def.login, S.login || {});
    S.cur = Object.assign(def.cur, S.cur || {});
    if (S.chars && S.chars['C001']) {
      // 转移 C001 装备到主角
      const old = (S.equipped && S.equipped['C001']) || {};
      const slots = S.equipped['@player'];
      ['weapon', 'armor', 'accessory'].forEach(k => { if (old[k] && !slots[k]) slots[k] = old[k]; });
      delete S.equipped['C001'];
      delete S.chars['C001'];
      if (S.codex && S.codex.chars) S.codex.chars = S.codex.chars.filter(x => x !== 'C001');
    }
    if (S.party) S.party = S.party.map(id => (id === 'C001' ? null : id));
    if (!S.equipped['@player']) S.equipped['@player'] = { weapon: null, head: null, armor: null, hands: null, legs: null, accessory: null };
    S.player.bloodline = S.player.bloodline || null;
    S.player.bloodlineLv = S.player.bloodlineLv || 0;
    S.player.attrs = Object.assign(ATTR_ZERO(), S.player.attrs || {});
    S.player.attrPoints = S.player.attrPoints || 0;
    S.player.skillLv = (S.player.skillLv || [1, 1, 1]).slice(0, 3);
    if (S.player.skillPoints === undefined) {
      const spent = S.player.skillLv.reduce((s, x) => s + (x - 1), 0);
      S.player.skillPoints = Math.max(0, (S.player.level - 1) - spent);
    }
    S.altPlayers = Array.isArray(S.altPlayers) ? S.altPlayers : [];
    S.altPlayers.forEach(p => {
      p.attrs = Object.assign(ATTR_ZERO(), p.attrs || {});
      p.attrPoints = p.attrPoints || 0;
      p.skillLv = (p.skillLv || [1, 1, 1]).slice(0, 3);
      if (p.skillPoints === undefined) {
        const spent = p.skillLv.reduce((s, x) => s + (x - 1), 0);
        p.skillPoints = Math.max(0, (p.level - 1) - spent);
      }
    });
    if (!S.bag || !S.bag.cap) S.bag = { cap: D.BAG_BASE_CAP, expands: 0 };
  }
  function newGame() {
    S = defaultState();
    S.player.name = '';   // 创建角色时填写
    // 新手资源（V5.0 §113）
    addCur('points', D.STARTER.points);
    addCur('holy', D.STARTER.holy);
    Object.entries(D.STARTER.items).forEach(([k, v]) => addItem(k, v));
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
  // 主角显示名（@player 即玩家本人）
  function charName(id) {
    if (id === '@player') return S.player.name || '主角';
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
  // 货币变化广播：UI 订阅它做"±数值跳动"（放置游戏唯一的手感来源）。
  // 放在 addCur / spend 里，任何来源的收支都会自动有反馈，不需要在每个按钮上重复写。
  let curListener = null;
  function setCurListener(fn) { curListener = fn; }
  function emitCur(id, delta) {
    if (!curListener || !delta) return;
    try { curListener(id, delta); } catch (e) { /* UI 出错不影响存档 */ }
  }
  function addCur(id, n) {
    if (!n) return;
    const d = Math.floor(n);
    S.cur[id] = Math.max(0, (S.cur[id] || 0) + d);
    emitCur(id, d);
  }
  function canAfford(cost) {
    return Object.entries(cost).every(([k, v]) => (S.cur[k] || 0) >= v);
  }
  function spend(cost) {
    if (!canAfford(cost)) return false;
    Object.entries(cost).forEach(([k, v]) => { S.cur[k] -= v; emitCur(k, -v); });
    return true;
  }

  /* ================= 道具 ================= */
  // 套装加成：世界套装 2/4/6 件；职业套装 2/3 件（已按定位匹配计入 sets）
  function applySetBonuses(pct, sets) {
    Object.entries(sets).forEach(([setId, n]) => {
      if (setId.startsWith('class:')) {
        const cs = D.CLASS_SETS[setId.slice(6)];
        if (!cs) return;
        if (n >= 2 && cs.b2) Object.entries(cs.b2).forEach(([k, v]) => { pct[k] = (pct[k] || 0) + v; });
        if (n >= 3 && cs.b3) Object.entries(cs.b3).forEach(([k, v]) => { pct[k] = (pct[k] || 0) + v; });
        return;
      }
      const set = D.SETS[setId];
      if (!set) return;
      if (n >= 2 && set.b2) Object.entries(set.b2).forEach(([k, v]) => { pct[k] = (pct[k] || 0) + v; });
      if (n >= 4 && set.b4) Object.entries(set.b4).forEach(([k, v]) => { pct[k] = (pct[k] || 0) + v; });
      if (n >= 6 && set.b6) Object.entries(set.b6).forEach(([k, v]) => { pct[k] = (pct[k] || 0) + v; });
    });
  }
  /* --- 转生天赋：一支入口，文案与效果同源（D.TALENTS 的节点自带 e 效果表） --- */
  const TALENT_PCT_KEYS = ['atkPct', 'hpPct', 'defPct', 'spdPct', 'critPct', 'critDmg', 'skillPct', 'evaPct', 'spiritPct'];
  function talentAll() {
    const t = S.player.talents;
    const out = {};
    ['body', 'energy', 'nerve', 'grace'].forEach(b => {
      Object.entries(D.talentEffect(b, t[b] || 0)).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; });
    });
    return out;
  }
  function talentPct() {
    const all = talentAll(), out = {};
    TALENT_PCT_KEYS.forEach(k => { out[k] = all[k] || 0; });
    return out;
  }
  // 战斗引擎专用的天赋字段（减伤/受治疗/开场能量/CD/先制/必杀）
  function talentCombatExtra() {
    const all = talentAll();
    return {
      dmgReduce: Math.min(0.6, all.dmgReduce || 0),
      healUp: all.healUp || 0,
      initEnergy: all.initEnergy || 0,
      cdRed: all.cdRed || 0,
      firstStrike: all.firstStrike || 0,
      ultPct: all.ultPct || 0,
    };
  }
  const graceIdleMult = () => 1 + (talentAll().idlePct || 0);
  const graceExpMult = () => 1 + (talentAll().expPct || 0);
  const graceDropMult = () => 1 + (talentAll().dropPct || 0);
  // 背包占用 = 道具种类数 + 未装备装备件数
  function bagUsage() {
    const equippedUids = new Set();
    Object.values(S.equipped || {}).forEach(slots => Object.values(slots || {}).forEach(uid => { if (uid) equippedUids.add(uid); }));
    const eqCount = Object.keys(S.equips).filter(uid => !equippedUids.has(uid)).length;
    const itemStacks = Object.values(S.items).filter(n => n > 0).length;
    return { used: eqCount + itemStacks, eqCount, itemStacks, cap: S.bag.cap };
  }
  function addItem(id, n = 1) {
    if (!(S.items[id] > 0) && bagUsage().used >= S.bag.cap) return false; // 新堆叠需占格
    S.items[id] = (S.items[id] || 0) + n;
    return true;
  }
  // 能否再放进这个道具（已有堆叠不占新格）
  function canAddItem(id) {
    return (S.items[id] > 0) || bagUsage().used < S.bag.cap;
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
    S.equipped[id] = { weapon: null, head: null, armor: null, hands: null, legs: null, accessory: null };
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
  function useExpItem(charId, itemId, n = 1) {
    const item = D.ITEMS[itemId];
    if (!item || item.type !== 'exp') return { ok: false, msg: '不是经验道具' };
    const c = S.chars[charId];
    if (!c) return { ok: false, msg: '未拥有该角色' };
    const have = S.items[itemId] || 0;
    if (have < 1) return { ok: false, msg: '道具不足' };
    const use = Math.max(1, Math.min(n, have));
    S.items[itemId] -= use;
    if (S.items[itemId] <= 0) delete S.items[itemId];
    c.exp += item.exp * use;
    task('item1', use);
    save();
    return { ok: true, msg: `+${(item.exp * use).toLocaleString()} EXP（×${use}）`, count: use };
  }
  /* ================= 血清（永久强化剂） =================
     对标同类放置游戏的"丹药矩阵"：成长被拆成很多次小成长，喂一支就有一次可见的跳动。
     规则：每人每种有次数上限；血统血清只有对应血统能用；效果真的进属性计算（不是文案）。 */
  function serumTaken(charId, serumId) {
    const m = S.serums[charId];
    return (m && m[serumId]) || 0;
  }
  function serumApplied(charId) {
    const m = S.serums[charId] || {};
    return Object.keys(m).reduce((n, k) => n + m[k], 0);
  }
  // 把血清加成并进百分比区（与血统 / 天赋同区，加算）
  function applySerums(charId, pct) {
    const m = S.serums[charId];
    if (!m) return;
    Object.keys(m).forEach(sid => {
      const sd = D.serumById[sid];
      if (!sd) return;
      pct[sd.key] = (pct[sd.key] || 0) + sd.per * m[sid];
    });
  }
  // 炼化：材料 + 点数 → 血清道具
  function craftSerum(serumId, n = 1) {
    const sd = D.serumById[serumId];
    if (!sd) return { ok: false, msg: '没有这个配方' };
    const want = Math.max(1, Math.floor(n));
    const haveMat = S.items[sd.mat] || 0;
    const can = Math.min(want, Math.floor(haveMat / sd.matN), Math.floor(S.cur.points / sd.points));
    if (can < 1) {
      if (haveMat < sd.matN) return { ok: false, msg: `${D.ITEMS[sd.mat].name}不足（${haveMat}/${sd.matN}）` };
      return { ok: false, msg: `点数不足（${S.cur.points.toLocaleString()}/${sd.points.toLocaleString()}）` };
    }
    S.items[sd.mat] -= sd.matN * can;
    if (S.items[sd.mat] <= 0) delete S.items[sd.mat];
    S.cur.points -= sd.points * can;
    addItem(D.SERUM_ITEM(serumId), can);
    task('item1', can);
    save();
    return { ok: true, count: can, msg: `炼化「${sd.name}」×${can}` };
  }
  // 使用：喂给某名角色（或主角 '@player'）
  function useSerum(charId, serumId, n = 1) {
    const sd = D.serumById[serumId];
    if (!sd) return { ok: false, msg: '没有这支血清' };
    const itemId = D.SERUM_ITEM(serumId);
    const have = S.items[itemId] || 0;
    if (have < 1) return { ok: false, msg: '道具不足' };
    const isPlayer = charId === '@player';
    const base = isPlayer ? null : D.charById[charId];
    if (!isPlayer && !S.chars[charId]) return { ok: false, msg: '未拥有该角色' };
    if (sd.bloodline) {
      const bl = isPlayer ? S.player.bloodline : (base && base.bloodline);
      if (!bl) return { ok: false, msg: `该角色还没觉醒血统，先觉醒「${sd.bloodline}」再用` };
      if (bl !== sd.bloodline) return { ok: false, msg: `只有「${sd.bloodline}」血统能用这支血清` };
    }
    S.serums[charId] = S.serums[charId] || {};
    const taken = S.serums[charId][serumId] || 0;
    const room = sd.max - taken;
    if (room <= 0) return { ok: false, msg: `已达上限（${sd.max} 支）` };
    const use = Math.max(1, Math.min(n, have, room));
    S.items[itemId] -= use;
    if (S.items[itemId] <= 0) delete S.items[itemId];
    S.serums[charId][serumId] = taken + use;
    task('item1', use);
    save();
    const kn = D.SERUM_KEYS[sd.key] || sd.key;
    return { ok: true, count: use, msg: `${sd.name} ×${use}：${kn} 永久 +${(sd.per * use * 100).toFixed(1)}%` };
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
    // 转生天赋：效果全部由 D.talentEffect 派生，文案与数值同源
    // （旧版是两套硬编码数组，说明改了、效果没改，导致 15 个节点写了没实装）
    const tt = talentPct();
    ['atkPct', 'hpPct', 'defPct', 'spdPct', 'critPct', 'critDmg', 'skillPct', 'evaPct', 'spiritPct'].forEach(k => { pct[k] += tt[k] || 0; });
    applySerums(charId, pct);                      // 血清（永久强化剂）
    // 装备
    const eq = S.equipped[charId] || {};
    const flat = { atk: 0, def: 0, hp: 0, spd: 0 };
    const sets = {};
    Object.values(eq).forEach(uid => {
      if (!uid || !S.equips[uid]) return;
      const e = S.equips[uid];
      const st = equipStats(e);
      Object.keys(flat).forEach(k => { flat[k] += st.flat[k] || 0; });
      flat.spd += st.flat.spd || 0;
      pct.critPct += st.flat.critPct || 0;
      Object.entries(st.affix).forEach(([k, v]) => { pct[k] = (pct[k] || 0) + v; });
      if (e.set) sets[e.set] = (sets[e.set] || 0) + 1;
      if (e.classSet && e.classSet === base.kind) sets['class:' + e.classSet] = (sets['class:' + e.classSet] || 0) + 1;
    });
    applySetBonuses(pct, sets);
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
      ...talentCombatExtra(),
    };
  }
  function power(charId) {
    const st = effectiveStats(charId);
    if (!st) return 0;
    return Math.round(st.atk * 2 + st.def + st.hp * 0.2 + st.spd * 3);
  }
  /* ================= 主角（玩家）独立属性 ================= */
  function effectivePlayerStats() {
    const P = D.PROTAGONIST;
    const lvMult = 1 + (S.player.level - 1) * 0.035;
    const a = {};
    Object.keys(P.baseAttrs).forEach(k => { a[k] = P.baseAttrs[k] * lvMult; });
    // 六维属性点加成（每点 +ATTR_POINT_VALUE）
    const pa = S.player.attrs || {};
    Object.keys(a).forEach(k => { a[k] += (pa[k] || 0) * D.ATTR_POINT_VALUE; });
    const pct = { atkPct: 0, hpPct: 0, defPct: 0, spdPct: 0, critPct: 0, critDmg: 0, skillPct: 0, evaPct: 0.05, resPct: 0, lifesteal: 0, spiritPct: 0 };
    // 基因锁（全队加成 + 主角每阶额外3%）
    if (S.player.geneLock >= 1) { pct.atkPct += 0.05; pct.hpPct += 0.05; pct.defPct += 0.05; pct.spdPct += 0.05; }
    if (S.player.geneLock >= 2) pct.skillPct += 0.15;
    if (S.player.geneLock >= 5) { pct.atkPct += 0.15; pct.hpPct += 0.15; pct.defPct += 0.15; pct.spdPct += 0.15; }
    const glExtra = S.player.geneLock * 0.03;
    pct.atkPct += glExtra; pct.hpPct += glExtra; pct.defPct += glExtra; pct.spdPct += glExtra;
    // 主角血统
    if (S.player.bloodline) {
      const bl = D.BLOODLINES[S.player.bloodline];
      const blm = S.player.bloodlineLv * (S.player.geneLock >= 4 ? 1.5 : 1);
      if (bl) {
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
    }
    // 转生天赋（主角同样吃满四支天赋）
    const tt = talentPct();
    ['atkPct', 'hpPct', 'defPct', 'spdPct', 'critPct', 'critDmg', 'skillPct', 'evaPct', 'spiritPct'].forEach(k => { pct[k] += tt[k] || 0; });
    applySerums('@player', pct);                   // 血清（主角同样是永久加成）
    // 境界（渡劫）：每突破一境全属性 +5%，与基因锁/血统/血清并列，属于永久成长
    const rp = realmBonusPct();
    if (rp) { pct.atkPct += rp; pct.hpPct += rp; pct.defPct += rp; pct.spdPct += rp; }
    // 装备（6 槽）
    const eq = S.equipped['@player'] || {};
    const flat = { atk: 0, def: 0, hp: 0, spd: 0 };
    const psets = {};
    Object.values(eq).forEach(uid => {
      if (!uid || !S.equips[uid]) return;
      const st = equipStats(S.equips[uid]);
      const e = S.equips[uid];
      flat.atk += st.flat.atk || 0;
      flat.def += st.flat.def || 0;
      flat.hp += st.flat.hp || 0;
      flat.spd += st.flat.spd || 0;
      pct.critPct += st.flat.critPct || 0;
      Object.entries(st.affix).forEach(([k, v]) => { pct[k] = (pct[k] || 0) + v; });
      if (e.set) psets[e.set] = (psets[e.set] || 0) + 1;
      if (e.classSet && e.classSet === 'warrior') psets['class:warrior'] = (psets['class:warrior'] || 0) + 1;
    });
    applySetBonuses(pct, psets);
    if (pct.spiritPct) a.spirit *= (1 + pct.spiritPct);
    const atk = (a.muscle * 1.8 + flat.atk) * (1 + pct.atkPct);
    const def = (a.immune * 1.6 + flat.def) * (1 + pct.defPct);
    const hp = (a.cell * 25 + flat.hp) * (1 + pct.hpPct);
    const spd = (a.nerve * 1.2 + flat.spd) * (1 + pct.spdPct);
    const crit = Math.min(0.6, 0.05 + a.intelligence * 0.0008 + pct.critPct);
    const eva = Math.min(0.6, a.nerve * 0.0012 + pct.evaPct);
    const skillMult = 1 + a.spirit * 0.006 + pct.skillPct;
    return {
      atk: Math.round(atk), def: Math.round(def), hp: Math.round(hp), spd: Math.round(spd),
      crit, critDmg: 2.0 + pct.critDmg, eva, skillMult,
      lifesteal: pct.lifesteal, resPct: pct.resPct || 0, attrs: a,
      ...talentCombatExtra(),
    };
  }
  function playerPower() {
    const st = effectivePlayerStats();
    return Math.round(st.atk * 2 + st.def + st.hp * 0.2 + st.spd * 3);
  }
  function choosePlayerBloodline(id) {
    if (!D.BLOODLINES[id]) return { ok: false, msg: '血统不存在' };
    if (S.player.bloodline) return { ok: false, msg: '血统一旦选择不可更改' };
    if (S.player.level < D.BLOODLINE_UNLOCK_LV) return { ok: false, msg: `主角 Lv.${D.BLOODLINE_UNLOCK_LV} 才能觉醒血统（当前 Lv.${S.player.level}）` };
    S.player.bloodline = id;
    save();
    return { ok: true, msg: `已觉醒${id}血统` };
  }
  function upgradePlayerBloodline() {
    if (!S.player.bloodline) return { ok: false, msg: '尚未选择血统' };
    if (S.player.bloodlineLv >= D.BLOODLINE_MAX) return { ok: false, msg: '血统已满级' };
    let cost = D.bloodlineCost(S.player.bloodlineLv);
    const discount = Math.min(0.4, S.buildings.geneLab * 0.01);
    cost = { bloodCrystal: Math.ceil(cost.bloodCrystal * (1 - discount)), points: Math.ceil(cost.points * (1 - discount)) };
    if (!spend(cost)) return { ok: false, msg: '血统结晶或点数不足' };
    S.player.bloodlineLv++;
    save();
    return { ok: true, msg: `血统 Lv.${S.player.bloodlineLv}` };
  }
  function teamPower() {
    return playerPower() + S.party.filter(Boolean).reduce((sum, id) => sum + power(id), 0);
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
    const slots = slot ? [slot] : D.DROP_SLOTS;
    const s = slots[Math.floor(Math.random() * slots.length)];
    // 装备类别：普通 / 世界套装 / 职业套装
    let opts = { setType: 'plain' };
    const roll = Math.random();
    if (rarity === 'R') opts = roll < 0.5 ? { setType: 'plain' } : { setType: 'world' };
    else if (rarity === 'SR') opts = roll < 0.7 ? { setType: 'world' } : { setType: 'class', classKind: randomKind() };
    else if (rarity === 'SSR' || rarity === 'UR') opts = roll < 0.6 ? { setType: 'world' } : { setType: 'class', classKind: randomKind() };
    const eq = D.makeEquip(worldId, s, rarity, uid, opts);
    S.equips[uid] = eq;
    S.codex.equipsSeen++;
    // 自动分解（设置页开关）：白装 / 绿装不进背包，直接换成异界结晶
    if ((rarity === 'N' && S.settings.autoSellN) || (rarity === 'R' && S.settings.autoSellR)) {
      delete S.equips[uid];
      const gain = D.DECOMPOSE_GAIN[rarity];
      addCur('otherworld', gain);
      return { sold: true, gain, auto: true };
    }
    // 背包已满 → 自动分解为异界结晶
    if (bagUsage().used > S.bag.cap) {
      const gain = D.DECOMPOSE_GAIN[rarity];
      delete S.equips[uid];
      addCur('otherworld', gain);
      return { sold: true, gain, bagFull: true };
    }
    return { equip: eq };
  }
  function randomKind() {
    const kinds = Object.keys(D.CLASS_SETS);
    return kinds[Math.floor(Math.random() * kinds.length)];
  }
  // SSR 专属装备（UR，绑定角色）
  function grantSignatureEquip(sigId) {
    const uid = 'eq' + Date.now().toString(36) + '_' + (uidCounter++);
    const eq = D.makeSignatureEquip(sigId, uid);
    if (!eq) return { sold: false };
    S.equips[uid] = eq;
    S.codex.equipsSeen++;
    if (bagUsage().used > S.bag.cap) {
      delete S.equips[uid];
      addCur('otherworld', D.DECOMPOSE_GAIN.UR);
      return { sold: true, gain: D.DECOMPOSE_GAIN.UR, bagFull: true };
    }
    return { equip: eq, signature: true };
  }

  function buyBagCap() {
    const cost = D.bagExpandCost(S.bag.expands);
    if (!spend({ points: cost })) return { ok: false, msg: `点数不足（需 ◈${cost}）` };
    S.bag.expands++;
    S.bag.cap += D.BAG_EXPAND_SIZE;
    save();
    return { ok: true, msg: `背包扩容至 ${S.bag.cap} 格` };
  }
  function equipItem(charId, uid) {
    const eq = S.equips[uid];
    if (!eq) return false;
    if (!canEquip(charId, eq)) return false;
    if (!S.equipped[charId]) S.equipped[charId] = { weapon: null, head: null, armor: null, hands: null, legs: null, accessory: null };
    S.equipped[charId][eq.slot] = uid;
    save();
    return true;
  }
  // 装备锁定：锁上的装备不会被分解（含批量分解），避免手滑拆掉主力装备
  function toggleEquipLock(uid) {
    const eq = S.equips[uid];
    if (!eq) return { ok: false };
    eq.lock = !eq.lock;
    save();
    return { ok: true, lock: eq.lock };
  }
  // 一键最优装备：按"能不能穿 + 词条价值"给主角与全队自动选装，已锁定的装备照常可以给人穿
  function equipScore(eq) {
    const st = equipStats(eq);
    let s = st.flat.atk * 2 + st.flat.def * 1.2 + st.flat.hp * 0.2 + st.flat.spd * 3 + (st.flat.critPct || 0) * 2000;
    Object.entries(st.affix).forEach(([k, v]) => {
      const w = { atkPct: 1200, hpPct: 500, defPct: 900, skillPct: 1000, critPct: 1500, critDmg: 600, spdPct: 900, evaPct: 700, resPct: 300, lifesteal: 800 }[k] || 200;
      s += v * w;
    });
    return s;
  }
  function autoEquipBest() {
    const members = ['@player', ...S.party.filter(Boolean)];
    // 候选池：所有没被锁定的装备（含别人身上的，稍后统一重新分配；同一件只会分给一个人）
    const pool = Object.values(S.equips).filter(e => !e.lock);
    const used = new Set();
    let changed = 0;
    members.forEach(cid => {
      const cur = S.equipped[cid] || (S.equipped[cid] = { weapon: null, head: null, armor: null, hands: null, legs: null, accessory: null });
      const slots = cid === '@player' ? D.PLAYER_SLOTS : D.RECRUIT_SLOTS;
      slots.forEach(slot => {
        // 锁定的装备不动：如果它正穿在身上，就当作已占用直接跳过
        if (cur[slot] && S.equips[cur[slot]] && S.equips[cur[slot]].lock) { used.add(cur[slot]); return; }
        let best = null, bestScore = -1;
        pool.forEach(e => {
          if (used.has(e.uid)) return;
          if (e.slot !== slot) return;
          if (!canEquip(cid, e)) return;
          const s = equipScore(e);
          if (s > bestScore) { bestScore = s; best = e; }
        });
        if (best) {
          used.add(best.uid);
          if (cur[slot] !== best.uid) { cur[slot] = best.uid; changed++; }
        }
      });
    });
    save();
    return { ok: true, changed, members: members.length };
  }
  // 穿戴规则：专属限本人；职业套装限对应定位（主角=战士）；槽位受角色类型限制（头/手/腿仅主角）
  function canEquip(charId, eq) {
    if (!eq) return false;
    if (eq.charId && eq.charId !== charId) return false;
    if (charId !== '@player' && !S.chars[charId]) return false;
    const kind = charId === '@player' ? D.PROTAGONIST.kind : (D.charById[charId] || {}).kind;
    if (eq.classSet && eq.classSet !== kind) return false;
    return (charId === '@player' ? D.PLAYER_SLOTS : D.RECRUIT_SLOTS).includes(eq.slot);
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
  // 强化所需材料：无材料时按 tier 折算点数代用
  function enhanceMat(eq) {
    const tier = D.enhanceMatTier(eq.enhance);
    const itemId = 'mat_t' + tier;
    const has = (S.items[itemId] || 0) > 0;
    return { itemId, tier, has, subPoints: has ? 0 : D.MAT_SUBSTITUTE_POINTS[tier] };
  }
  function enhance(uid) {
    const eq = S.equips[uid];
    if (!eq) return { ok: false, msg: '装备不存在' };
    if (eq.enhance >= 20) return { ok: false, msg: '已满强化' };
    const cost = enhanceCost(eq);
    const mat = enhanceMat(eq);
    // 先判够不够，再扣材料——顺序反了会白吞材料（档案里的同类问题）
    if (!mat.has) cost.points += mat.subPoints;
    if (!canAfford(cost)) {
      return { ok: false, msg: mat.has ? '点数或异界结晶不足' : `点数不足（无${D.ITEMS[mat.itemId].name}，需代用 ◈${mat.subPoints}）` };
    }
    if (mat.has) {
      S.items[mat.itemId]--;
      if (S.items[mat.itemId] <= 0) delete S.items[mat.itemId];
    }
    spend(cost);
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
    if (eq.lock) return { ok: false, msg: '这件装备已锁定，先解锁再分解' };
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
  // 批量分解：一次结算、一次存档
  function decomposeMany(uids) {
    let gain = 0, count = 0;
    uids.forEach(uid => {
      const eq = S.equips[uid];
      if (!eq) return;
      if (eq.lock) return;   // 锁定的装备不参与批量分解
      gain += D.DECOMPOSE_GAIN[eq.rarity] + Math.floor(eq.enhance * 3);
      Object.values(S.equipped).forEach(slots => {
        Object.keys(slots).forEach(k => { if (slots[k] === uid) slots[k] = null; });
      });
      delete S.equips[uid];
      count++;
    });
    if (count) { addCur('otherworld', gain); save(); }
    return { ok: count > 0, gain, count };
  }
  /* --- 编队预设：3 组槽位，一键保存 / 一键套用 --- */
  function savePreset(idx) {
    if (idx < 0 || idx > 2) return { ok: false, msg: '预设不存在' };
    S.presets[idx] = S.party.slice();
    save();
    return { ok: true, msg: `已保存到预设 ${idx + 1}` };
  }
  function applyPreset(idx) {
    const p = S.presets[idx];
    if (!p) return { ok: false, msg: '该预设还是空的' };
    const owned = p.map(id => (id && S.chars[id] ? id : null));
    S.party = owned.slice(0, 4);
    while (S.party.length < 4) S.party.push(null);
    save();
    return { ok: true, msg: `已套用预设 ${idx + 1}` };
  }
  function inventoryEquips() {
    const equippedUids = new Set();
    Object.values(S.equipped).forEach(slots => Object.values(slots).forEach(u => u && equippedUids.add(u)));
    return Object.values(S.equips).sort((a, b) => D.RARITIES.indexOf(b.rarity) - D.RARITIES.indexOf(a.rarity) || b.enhance - a.enhance);
  }

  /* ================= 招募 ================= */
  // 三个池子的差异全部由 RECRUIT_POOLS 的数据决定，这里只按结构执行：
  // 普通池只出 N/R/SR；高级池 SR 起抽 + 优先未拥有；限定池锁当期阵营 + 当期 UP
  function poolUpChar(pool) {
    return pool === 'limited' ? D.recruitUpChar() : null;
  }
  function rollRarityInPool(pool) {
    let r = Math.random(), acc = 0;
    for (const [rar, p] of Object.entries(D.RECRUIT_POOLS[pool].rates)) {
      acc += p;
      if (r <= acc) return rar;
    }
    const keys = Object.keys(D.RECRUIT_POOLS[pool].rates);
    return keys[keys.length - 1] || 'R';
  }
  // 该池该稀有度能出哪些人（限定池锁阵营；该档位在本阵营里没人就退回全量，避免抽空）
  function charsOfRarity(rar, pool) {
    let list = D.characters.filter(c => c.rarity === rar && !c.hidden);
    if (pool === 'limited') {
      const up = poolUpChar('limited');
      if (up) {
        const f = list.filter(c => c.faction === up.faction);
        if (f.length) list = f;
      }
    }
    return list;
  }
  function pickCharOfRarity(rar, pool, opts) {
    opts = opts || {};
    let list = charsOfRarity(rar, pool);
    if (!list.length) list = D.characters.filter(c => c.rarity === rar && !c.hidden);
    if (!list.length) list = D.characters;
    // 限定池的 SSR：一半概率直接给当期 UP；保底触发时 100% 给当期 UP
    if (pool === 'limited' && rar === 'SSR') {
      const up = poolUpChar('limited');
      if (up && (opts.forceUp || Math.random() < D.RECRUIT_POOLS.limited.upRatio)) list = [up];
    }
    // 高级池的 SSR/UR 优先给没拥有过的角色（"补图鉴"就是这个池子的定位）
    if (opts.prioritizeNew) {
      const fresh = list.filter(c => !S.chars[c.id]);
      if (fresh.length) list = fresh;
    }
    return list[Math.floor(Math.random() * list.length)];
  }
  function pityOf(pool) {
    S.recruit.pity = S.recruit.pity || {};
    const p = S.recruit.pity[pool] || (S.recruit.pity[pool] = { ssr: 0, ur: 0, up: 0 });
    p.ssr = p.ssr || 0; p.ur = p.ur || 0; p.up = p.up || 0;
    return p;
  }
  // 给界面看的保底进度（普通池没有保底）
  function pityView(pool) {
    if (pool === 'normal' || !D.RECRUIT_POOLS[pool]) return null;
    const p = pityOf(pool);
    return {
      ssr: { n: p.ssr, cap: D.PITY.SSR },
      ur: { n: p.ur, cap: D.PITY.UR },
      up: pool === 'limited' ? { n: p.up, cap: D.PITY_UP } : null,
    };
  }
  // opts.noCost：十连已整笔扣费，单抽不再重复扣（见 recruitTen）
  function recruitOnce(pool, opts) {
    opts = opts || {};
    const p = D.RECRUIT_POOLS[pool];
    if (!p) return { error: '卡池不存在' };
    if (!opts.noCost && !spend(p.cost)) return { error: '货币不足' };
    S.stats.recruits++;
    task('recruit1', 1);
    let rar = rollRarityInPool(pool);
    let forceUp = false;
    if (pool !== 'normal') {
      const pit = pityOf(pool);
      pit.ssr++; pit.ur++;
      if (pool === 'limited') pit.up++;
      // 三档保底各自独立：UR 保底不被 SSR 打断，当期 UP 保底只被"抽到当期 UP"重置
      if (pit.ur >= D.PITY.UR) rar = 'UR';
      else if (pit.ssr >= D.PITY.SSR && D.RARITIES.indexOf(rar) < 3) rar = 'SSR';
      if (pool === 'limited' && pit.up >= D.PITY_UP) { rar = 'SSR'; forceUp = true; }
    }
    const base = pickCharOfRarity(rar, pool, {
      forceUp,
      prioritizeNew: !!p.prioritizeNew && D.RARITIES.indexOf(rar) >= 3,
    });
    if (pool !== 'normal') {
      const pit = pityOf(pool);
      const up = poolUpChar(pool);
      if (D.RARITIES.indexOf(base.rarity) >= 3) pit.ssr = 0;
      if (D.RARITIES.indexOf(base.rarity) >= 4) pit.ur = 0;
      if (up && base.id === up.id) pit.up = 0;
    }
    const res = addChar(base.id);
    save();
    const upChar = poolUpChar(pool);
    return {
      id: base.id, name: base.name, rarity: base.rarity, isNew: res.isNew, shards: res.shards || 0,
      isUp: !!(upChar && base.id === upChar.id),
    };
  }
  function recruitTen(pool) {
    const p = D.RECRUIT_POOLS[pool];
    if (!p) return { error: '卡池不存在' };
    const cost = p.ten || p.cost;
    // 十连是一次交易：先按折扣价整笔扣费，再抽 10 次；任一步失败都不会出现"扣了钱看不到结果"
    if (!canAfford(cost)) return { error: '货币不足' };
    spend(cost);
    const results = [];
    let hasSR = false;
    for (let i = 0; i < 10; i++) {
      const r = recruitOnce(pool, { noCost: true });
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
    S.stats.recruits++;
    task('recruit1', 1);
    save();
    return { id: base.id, name: base.name, rarity: base.rarity, isNew: res.isNew, shards: res.shards || 0 };
  }
  function ssrTicketUse(charId) {
    const base = D.charById[charId];
    if (!base || base.rarity !== 'SSR' || S.ssrTicket <= 0) return { ok: false, msg: '无法选择' };
    S.ssrTicket--;
    addChar(charId);
    S.stats.recruits++;
    save();
    return { ok: true, msg: `获得 ${base.name}` };
  }

  /* ================= 挂机 ================= */
  // 2026-09-12 调整产出：点数 (10+0.3Lv) / 分、经验 (8+0.5Lv) / 分，
  // 与新的等级曲线（Lv1→100 累计 EXP 148.8 万 / 点数 21.3 万）配套；天赋「主神恩赐」的挂机/经验节点在此生效。
  function idleBaseRates() {
    const lv = S.player.level;
    const coreBonus = (1 + S.buildings.core * 0.02 + (S.player.geneLock >= 1 ? 0.10 : 0)) * graceIdleMult();
    return {
      pointsPerMin: (10 + lv * 0.3) * coreBonus,
      expPerMin: (8 + lv * 0.5) * (1 + S.buildings.training * 0.03) * graceExpMult(),
      otherworldPer10Min: 1 + Math.floor(lv / 50),
      storyPer30Min: 1,
    };
  }
  /* ================= 挂机分工 ================= */
  // 4 条产线各派一名领队（不能用已上阵的主力，给板凳角色一个去处）。
  // 领队战力越高，这条线产出越高；没派领队 = 这条线不产出。
  function idleLineLeader(lineId) {
    const cid = S.idle.lines[lineId];
    return cid && S.chars[cid] ? cid : null;
  }
  function idleLineBonus(lineId) {
    const cid = idleLineLeader(lineId);
    if (!cid) return 0;
    const line = D.IDLE_LINES.find(l => l.id === lineId);
    return Math.min((line && line.maxBonus) || 1.5, power(cid) / D.IDLE_LINE_POWER_DIV);
  }
  // 各产线"自己那一份"的产出（在基础挂机之外额外加，所以要先算基础值，避免自我引用）
  function idleLineContrib() {
    const bonuses = {};
    D.IDLE_LINES.forEach(l => { bonuses[l.id] = idleLineBonus(l.id); });
    const base = idleBaseRates();
    return {
      bonuses,
      points: base.pointsPerMin * bonuses.explore,
      exp: base.expPerMin * bonuses.cultivate,
      otherworld: base.otherworldPer10Min * bonuses.guard,
      matPerMin: bonuses.gather > 0 ? D.IDLE_MAT_PER_MIN * (1 + bonuses.gather) : 0,
    };
  }
  function idleRates() {
    const base = idleBaseRates();
    const c = idleLineContrib();
    return {
      pointsPerMin: base.pointsPerMin + c.points,
      expPerMin: base.expPerMin + c.exp,
      otherworldPer10Min: base.otherworldPer10Min + c.otherworld,
      storyPer30Min: base.storyPer30Min,
      matPerMin: c.matPerMin,
      lineBonuses: c.bonuses,
    };
  }
  // 界面用：每条线现在派了谁、加成多少、产出多少
  function idleLines() {
    const c = idleLineContrib();
    return D.IDLE_LINES.map(l => {
      const leaderId = idleLineLeader(l.id);
      const bonus = c.bonuses[l.id] || 0;
      let per = '未派领队，不产出';
      if (l.out === 'exp') per = `+${fmtNum(c.exp)} EXP / 分`;
      else if (l.out === 'points') per = `+${fmtNum(c.points)} 点 / 分`;
      else if (l.out === 'otherworld') per = `+${c.otherworld.toFixed(2)} 结晶 / 10 分`;
      else per = `+${c.matPerMin.toFixed(2)} 材料 / 分`;
      return { line: l, leaderId, bonus, per: leaderId ? per : '未派领队，不产出' };
    });
  }
  // 派遣 / 撤下领队：上阵主力不能派（他们要出战），同一个人不能同时管两条线
  function setIdleLeader(lineId, charId) {
    if (!D.IDLE_LINES.some(l => l.id === lineId)) return { ok: false, msg: '没有这条产线' };
    if (!charId) { S.idle.lines[lineId] = null; save(); return { ok: true, msg: '已撤下领队' }; }
    if (!S.chars[charId]) return { ok: false, msg: '没有这名轮回者' };
    if (S.party.includes(charId)) return { ok: false, msg: '上阵主力不能派去挂机，先把他换下来' };
    const other = D.IDLE_LINES.find(l => l.id !== lineId && S.idle.lines[l.id] === charId);
    if (other) return { ok: false, msg: `他已经在「${other.name}」了` };
    S.idle.lines[lineId] = charId;
    save();
    return { ok: true, msg: `${charName(charId)} 已派往「${D.IDLE_LINES.find(l => l.id === lineId).name}」` };
  }
  function offlineCapHours() {
    let cap = 12 + (S.player.geneLock >= 5 ? 12 : 0);
    cap += S.buildings.medical * 0.2;
    return cap;
  }
  function offlineEfficiency() {
    return Math.min(1.5, 0.85 + S.buildings.medical * 0.01 + (talentAll().offlinePct || 0));
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
      mat: Math.floor((r.matPerMin || 0) * mins),
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
      otherworld: Math.floor(Math.floor(S.idle.bankSec / 600) * r.otherworldPer10Min),
      story: Math.floor(S.idle.bankSec / 1800) * r.storyPer30Min,
      mat: Math.floor((r.matPerMin || 0) * mins),
      seconds: S.idle.bankSec,
    };
  }
  // 采集产线产出的材料按玩家等级换成对应档位（越往后材料越高级，但数量按 2 的幂递减）
  function idleMatItem() {
    const tier = Math.min(5, 1 + Math.floor((S.player.level - 1) / 20));
    return { item: 'mat_t' + tier, tier };
  }
  // 折算并入库；背包满就整批跳过（宁可少收，也不吞玩家的东西）
  function grantIdleMat(units) {
    if (!(units > 0)) return null;
    const mi = idleMatItem();
    const count = Math.floor(units / Math.pow(2, mi.tier - 1));
    if (count <= 0) return null;
    if (!addItem(mi.item, count)) return { item: mi.item, count: 0, full: true };
    return { item: mi.item, count, tier: mi.tier };
  }
  function claimIdle() {
    const g = idleBankGains();
    addCur('points', g.points);
    addCur('otherworld', g.otherworld);
    addCur('story', g.story);
    addPlayerExp(g.exp);
    // 采集产线的材料：按档位折算，背包满就跳过（不吞玩家的东西，只是这一轮收不进来）
    if (g.mat > 0) {
      const m = grantIdleMat(g.mat);
      if (m && m.count > 0) { g.matItem = m.item; g.matCount = m.count; g.mat = m.count; }
      else { g.matFull = !!(m && m.full); g.mat = 0; }
    }
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
      S.player.attrPoints = (S.player.attrPoints || 0) + D.ATTR_POINTS_PER_LV;
      S.player.skillPoints = (S.player.skillPoints || 0) + 1;
    }
  }

  /* ================= 主角技能加点 ================= */
  // 技能组：觉醒血统后替换为血统技能
  function protagonistSkills() {
    return (S.player.bloodline && D.BLOODLINE_SKILLS[S.player.bloodline]) || D.PROTAGONIST.skills;
  }
  function allocateSkill(idx) {
    const lv = S.player.skillLv || (S.player.skillLv = [1, 1, 1]);
    if (idx < 0 || idx > 2) return { ok: false, msg: '技能不存在' };
    if (lv[idx] >= 10) return { ok: false, msg: '已满级' };
    if ((S.player.skillPoints || 0) < 1) return { ok: false, msg: '没有可用技能点' };
    S.player.skillPoints--;
    lv[idx]++;
    save();
    return { ok: true, msg: `技能升到 Lv.${lv[idx]}` };
  }
  function resetSkills() {
    const lv = S.player.skillLv || [1, 1, 1];
    const refund = lv.reduce((s, x) => s + x - 1, 0);
    if (refund <= 0) return { ok: false, msg: '尚未加点' };
    S.player.skillLv = [1, 1, 1];
    S.player.skillPoints = (S.player.skillPoints || 0) + refund;
    save();
    return { ok: true, msg: `已重置，返还 ${refund} 点技能点` };
  }

  // 六维属性点分配（每点 +ATTR_POINT_VALUE 维值）
  function allocateAttr(attrId, n = 1) {
    if (!D.ATTR_META.some(a => a.id === attrId)) return { ok: false, msg: '属性不存在' };
    n = Math.min(n, S.player.attrPoints || 0);
    if (n <= 0) return { ok: false, msg: '没有可用属性点' };
    S.player.attrPoints -= n;
    S.player.attrs[attrId] = (S.player.attrs[attrId] || 0) + n;
    save();
    return { ok: true, msg: `${D.ATTR_META.find(a => a.id === attrId).name} +${n * D.ATTR_POINT_VALUE}` };
  }

  /* ================= 多主角（新建角色体验不同血统） ================= */
  const PROTAGONIST_KEYS = ['name', 'level', 'exp', 'bloodline', 'bloodlineLv', 'attrPoints', 'attrs', 'skillPoints', 'skillLv'];
  function snapshotProtagonist() {
    const p = {};
    PROTAGONIST_KEYS.forEach(k => { p[k] = S.player[k]; });
    p.attrs = Object.assign(ATTR_ZERO(), p.attrs);
    p.skillLv = (p.skillLv || [1, 1, 1]).slice();
    return p;
  }
  function restoreProtagonist(p) {
    PROTAGONIST_KEYS.forEach(k => { S.player[k] = p[k]; });
    S.player.attrs = Object.assign(ATTR_ZERO(), p.attrs);
    S.player.skillLv = (p.skillLv || [1, 1, 1]).slice();
  }
  function protagonistList() {
    return [
      Object.assign(snapshotProtagonist(), { current: true }),
      ...S.altPlayers.map((p, i) => Object.assign({}, p, { altIndex: i })),
    ];
  }
  function createProtagonist(name) {
    name = (name || '').trim();
    if (!name) return { ok: false, msg: '名字不能为空' };
    if (S.altPlayers.length >= 6) return { ok: false, msg: '最多创建 6 个额外角色' };
    S.altPlayers.push(snapshotProtagonist());
    restoreProtagonist(freshProtagonist(name));
    save();
    return { ok: true, msg: `新角色「${name}」已创建，从 Lv.1 开始轮回` };
  }
  function switchProtagonist(altIndex) {
    const alt = S.altPlayers[altIndex];
    if (!alt) return { ok: false, msg: '角色不存在' };
    const cur = snapshotProtagonist();
    S.altPlayers[altIndex] = cur;
    restoreProtagonist(alt);
    save();
    return { ok: true, msg: `已切换为「${S.player.name}」` };
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
  // 商品解锁条件：req.world 需要先通关该世界（普通难度）——高阶材料/经验模块按进度上架
  function shopReq(it) {
    if (!it || !it.req || !it.req.world) return { ok: true };
    const w = it.req.world;
    if (worldCleared(w, 'normal')) return { ok: true };
    const wd = D.WORLDS.find(x => x.id === w);
    return { ok: false, req: `通关 ${wd ? wd.name : w}·普通` };
  }
  function buyShopItem(shopId, idx) {
    const shop = D.SHOPS[shopId];
    const it = shop.items[idx];
    if (!it) return { ok: false, msg: '商品不存在' };
    const avail = shopReq(it);
    if (!avail.ok) return { ok: false, msg: `🔒 ${avail.req} 后解锁` };
    const key = shopId + '_' + idx + '_' + dailyDate();
    if (it.stock > 0 && (S.shop.bought[key] || 0) >= it.stock) return { ok: false, msg: '今日已售罄' };
    // 背包满时先拦下来，避免"钱扣了、道具没进包"
    if (it.item && !canAddItem(it.item)) return { ok: false, msg: '背包已满，先扩容或分解装备' };
    if (!spend({ [shop.currency]: it.price })) return { ok: false, msg: '货币不足' };
    S.shop.bought[key] = (S.shop.bought[key] || 0) + 1;
    if (it.item && !addItem(it.item, it.count || 1)) {
      addCur(shop.currency, it.price);            // 兜底退款，双保险
      return { ok: false, msg: '背包已满，已退还货币' };
    }
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
    // UR 箱：10% 开出 SSR 伙伴专属装备
    if (item.rarity === 'UR' && Math.random() < 0.10) {
      const sigId = Math.floor(Math.random() * D.SIGNATURE_EQUIPS.length);
      const sigRes = grantSignatureEquip(sigId);
      save();
      if (sigRes.equip) return { ok: true, equip: sigRes.equip, signature: true };
      if (sigRes.sold) return { ok: true, sold: true, gain: sigRes.gain || 0 };
    }
    const world = D.WORLDS[Math.floor(Math.random() * Math.min(3, D.WORLDS.length))];
    const res = grantEquip(world.id, item.rarity);
    save();
    return { ok: true, equip: res.equip, sold: res.sold, gain: res.gain || 0 };
  }
  // 批量开箱：逐个结算并汇总
  function openBoxes(itemId, n = 1) {
    const have = S.items[itemId] || 0;
    if (have < 1) return { ok: false, msg: '没有该宝箱' };
    const use = Math.max(1, Math.min(n, have));
    const equips = [];
    let sold = 0, soldGain = 0;
    for (let i = 0; i < use; i++) {
      const r = openBox(itemId);
      if (!r.ok) break;
      if (r.equip) equips.push(r.equip);
      if (r.sold) { sold++; soldGain += r.gain || 0; }
    }
    return { ok: equips.length + sold > 0, equips, sold, soldGain, count: equips.length + sold };
  }
  function dailyDate() { return new Date().toISOString().slice(0, 10); }
  // 今日剩余扫荡次数（跨天自动重置）
  function sweepLeft() {
    if (S.sweep.date !== dailyDate()) return D.SWEEP_DAILY_CAP;
    return Math.max(0, D.SWEEP_DAILY_CAP - (S.sweep.count || 0));
  }

  /* ================= 任务 / 登录 ================= */
  function ensureDaily() {
    const today = dailyDate();
    if (S.tasks.date !== today) {
      S.tasks.date = today; S.tasks.daily = {}; S.tasks.claimed = {}; S.tasks.allClaimed = false;
    }
    ensureWeekly();
  }
  // 周一为一周起点；跨周自动清空周常进度
  function weekKey() {
    const d = new Date();
    const day = (d.getDay() + 6) % 7;
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    const p = n => String(n).padStart(2, '0');
    return `${monday.getFullYear()}-${p(monday.getMonth() + 1)}-${p(monday.getDate())}`;
  }
  function ensureWeekly() {
    const k = weekKey();
    if (S.tasks.weekKey !== k) {
      S.tasks.weekKey = k; S.tasks.weekly = {}; S.tasks.weeklyClaimed = {}; S.tasks.weeklyAllClaimed = false;
    }
  }
  // 每日任务的进度同时喂给对应周常（同一套动作，不额外要求玩家改变玩法）
  const TASK_SRC = { battle5: 'battle', idle1: 'idle', enhance1: 'enhance', recruit1: 'recruit', dungeon1: 'dungeon', item1: 'item' };
  function weeklyTick(src, n) {
    if (!src) return;
    ensureWeekly();
    D.WEEKLY_TASKS.forEach(t => { if (t.src === src) S.tasks.weekly[t.id] = (S.tasks.weekly[t.id] || 0) + n; });
  }
  function task(id, n = 1) {
    ensureDaily();
    S.tasks.daily[id] = (S.tasks.daily[id] || 0) + n;
    weeklyTick(TASK_SRC[id], n);
  }
  function weeklyState() {
    ensureWeekly();
    return D.WEEKLY_TASKS.map(t => ({
      t, prog: S.tasks.weekly[t.id] || 0, done: (S.tasks.weekly[t.id] || 0) >= t.target, claimed: !!S.tasks.weeklyClaimed[t.id],
    }));
  }
  function claimWeekly(id) {
    ensureWeekly();
    const t = D.WEEKLY_TASKS.find(x => x.id === id);
    if (!t || S.tasks.weeklyClaimed[id]) return { ok: false, msg: '已领取' };
    if ((S.tasks.weekly[id] || 0) < t.target) return { ok: false, msg: '本周还没完成' };
    S.tasks.weeklyClaimed[id] = true;
    Object.entries(t.reward).forEach(([k, v]) => addCur(k, v));
    save();
    return { ok: true, msg: '周常奖励已领取' };
  }
  function claimAllWeekly() {
    ensureWeekly();
    if (S.tasks.weeklyAllClaimed) return { ok: false, msg: '已领取' };
    if (!D.WEEKLY_TASKS.every(t => (S.tasks.weekly[t.id] || 0) >= t.target)) return { ok: false, msg: '本周任务尚未全部完成' };
    S.tasks.weeklyAllClaimed = true;
    Object.entries(D.WEEKLY_ALL_REWARD).forEach(([k, v]) => { if (k === 'item') addItem(v); else addCur(k, v); });
    save();
    return { ok: true, msg: '周常全清奖励已领取' };
  }
  /* ================= 成就 ================= */
  function achievementState() {
    return D.ACHIEVEMENTS.map(a => ({ a, done: !!a.check(S), claimed: !!S.achievements[a.id] }));
  }
  function achievementSummary() {
    const st = achievementState();
    return { total: st.length, claimed: st.filter(x => x.claimed).length, done: st.filter(x => x.done).length, list: st };
  }
  function claimAchievement(id) {
    const a = D.ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return { ok: false, msg: '成就不存在' };
    if (S.achievements[a.id]) return { ok: false, msg: '已领取' };
    if (!a.check(S)) return { ok: false, msg: '尚未达成' };
    S.achievements[a.id] = true;
    Object.entries(a.reward).forEach(([k, v]) => addCur(k, v));
    save();
    return { ok: true, msg: `🏅 成就达成：${a.name}`, name: a.name };
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
    // 七天一循环：第 7 天领完后回到第 1 天，而不是永远停在第 7 天重复发 SSR 自选券
    if (S.login.day >= D.LOGIN_REWARDS.length) { S.login.day = 0; S.login.round = (S.login.round || 1) + 1; }
    S.login.day += 1;
    const r = D.LOGIN_REWARDS[S.login.day - 1];
    if (r.ssrTicket) S.ssrTicket++;
    else {
      Object.entries(r).forEach(([k, v]) => {
        if (k === 'item') addItem(v);
        else addCur(k, v);
      });
    }
    save();
    return { day: S.login.day, reward: r, round: S.login.round || 1, cycleDays: D.LOGIN_REWARDS.length };
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

  /* ================= 图鉴收集 ================= */
  function codexState() {
    const owned = S.codex.chars.filter(id => D.charById[id]).length;
    return {
      owned, total: D.characters.length,
      rewards: D.CODEX_REWARDS.map(r => ({
        n: r.n, reward: r.reward,
        reached: owned >= r.n,
        claimed: S.codex.claimed.includes(r.n),
      })),
    };
  }
  function claimCodexReward(n) {
    const r = D.CODEX_REWARDS.find(x => x.n === n);
    if (!r) return { ok: false, msg: '奖励不存在' };
    if (S.codex.claimed.includes(n)) return { ok: false, msg: '已领取' };
    if (S.codex.chars.filter(id => D.charById[id]).length < n) return { ok: false, msg: `还差 ${n - codexState().owned} 名角色` };
    S.codex.claimed.push(n);
    Object.entries(r.reward).forEach(([k, v]) => addCur(k, v));
    save();
    return { ok: true, msg: `图鉴奖励已领取（${n} 名）` };
  }

  /* ================= 今日概览 / 一键收取 ================= */
  // 首页「今日」卡要的三件事：挂机待收、任务进度、免费招募。
  // 全部从存档现算，不额外存字段——这样"卡上写的"和"实际能领的"不可能对不上。
  function todayState() {
    ensureDaily();
    const bank = idleBankGains();
    const daily = D.DAILY_TASKS.map(t => ({
      t, prog: S.tasks.daily[t.id] || 0,
      done: (S.tasks.daily[t.id] || 0) >= t.target,
      claimed: !!S.tasks.claimed[t.id],
    }));
    const weekly = weeklyState();
    const dailyClaimable = daily.filter(x => x.done && !x.claimed).length;
    const weeklyClaimable = weekly.filter(x => x.done && !x.claimed).length
      + (weekly.every(x => x.done) && !S.tasks.weeklyAllClaimed ? 1 : 0);
    const achClaimable = achievementState().filter(a => a.done && !a.claimed).length;
    const codexClaimable = codexState().rewards.filter(r => r.reached && !r.claimed).length;
    const idleReady = bank.seconds >= 60;
    return {
      idle: bank, idleReady, idleSeconds: bank.seconds,
      dailyDone: daily.filter(x => x.done).length, dailyTotal: daily.length, dailyClaimable,
      weeklyClaimable, achClaimable, codexClaimable,
      freeRecruit: freeRecruitAvailable(), freeRecruitReady: freeRecruitAvailable() && isUnlocked('recruit'),
      claimable: (idleReady ? 1 : 0) + dailyClaimable + weeklyClaimable + achClaimable + codexClaimable,
    };
  }
  // 一键收取：把"已经达成、躺在那儿等点"的奖励一次全领掉。
  // 不做"帮你花"，只做"帮你收"——收取不会失败，也不会改变任何进度。
  function claimEverything() {
    ensureDaily();
    const beforeCur = Object.assign({}, S.cur);
    const beforeItems = Object.assign({}, S.items);
    const detail = { idle: null, tasks: 0, allDaily: false, weekly: 0, allWeekly: false, ach: 0, codex: 0 };
    // 先收挂机：挂机本身会推进"领挂机"这条日常，所以必须排在任务之前
    const bank = idleBankGains();
    if (bank.seconds >= 60) detail.idle = claimIdle();
    D.DAILY_TASKS.forEach(t => { if (claimTask(t.id).ok) detail.tasks++; });
    if (claimAllTasks().ok) detail.allDaily = true;
    D.WEEKLY_TASKS.forEach(t => { if (claimWeekly(t.id).ok) detail.weekly++; });
    if (claimAllWeekly().ok) detail.allWeekly = true;
    D.ACHIEVEMENTS.forEach(a => { if (claimAchievement(a.id).ok) detail.ach++; });
    D.CODEX_REWARDS.forEach(r => { if (claimCodexReward(r.n).ok) detail.codex++; });
    // 差额由"前后快照"算出来，不依赖各领取函数回报数值——永远和账户实际变化一致
    const gains = { cur: {}, items: {} };
    Object.keys(S.cur).forEach(k => { const d = (S.cur[k] || 0) - (beforeCur[k] || 0); if (d) gains.cur[k] = d; });
    Object.keys(S.items).forEach(k => { const d = (S.items[k] || 0) - (beforeItems[k] || 0); if (d) gains.items[k] = d; });
    save();
    const total = (detail.idle ? 1 : 0) + detail.tasks + (detail.allDaily ? 1 : 0)
      + detail.weekly + (detail.allWeekly ? 1 : 0) + detail.ach + detail.codex;
    return { detail, gains, seconds: detail.idle ? detail.idle.seconds : 0, total };
  }
  // 下一关：同难度往后推一格；打完第 12 关顺延到下一难度，难度打完顺延到下一世界
  function nextStage(worldId, diff, stageIdx) {
    if (!S.worlds[worldId] || !S.worlds[worldId].unlocked) return null;
    if (stageIdx + 1 < 12) {
      const r = { worldId, diff, stageIdx: stageIdx + 1 };
      return stageUnlocked(r.worldId, r.diff, r.stageIdx) ? r : null;
    }
    const order = D.DIFFICULTY.map(d => d.id);
    const di = order.indexOf(diff);
    if (di >= 0 && di < order.length - 1 && worldCleared(worldId, diff)) {
      const r = { worldId, diff: order[di + 1], stageIdx: 0 };
      if (stageUnlocked(r.worldId, r.diff, 0)) return r;
    }
    const wi = D.WORLDS.findIndex(x => x.id === worldId);
    if (wi >= 0 && wi < D.WORLDS.length - 1) {
      const nw = D.WORLDS[wi + 1];
      if (S.worlds[nw.id] && S.worlds[nw.id].unlocked && stageUnlocked(nw.id, 'normal', 0)) {
        return { worldId: nw.id, diff: 'normal', stageIdx: 0 };
      }
    }
    return null;
  }

  /* ================= 限时悬赏 ================= */
  // 每条悬赏从本期起点开始各算各的截止时间；过期作废，完成才给高价值奖励。
  // 全部领完或过期后可以开新一轮（长期留个"回来看看"的理由）。
  function bountyState() {
    const now = Date.now();
    const start = (S.bounty && S.bounty.start) || now;
    const claimed = (S.bounty && S.bounty.claimed) || {};
    const list = D.BOUNTIES.map(b => {
      const deadline = start + b.hours * 3600e3;
      const leftMs = deadline - now;
      return { b, deadline, leftMs, expired: leftMs <= 0, done: !!b.check(S), claimed: !!claimed[b.id] };
    });
    return {
      list, start,
      claimable: list.filter(x => x.done && !x.claimed && !x.expired).length,
      allOver: list.every(x => x.claimed || x.expired),
    };
  }
  function claimBounty(id) {
    const item = bountyState().list.find(x => x.b.id === id);
    if (!item) return { ok: false, msg: '悬赏不存在' };
    if (item.claimed) return { ok: false, msg: '已经领过了' };
    if (item.expired) return { ok: false, msg: '这条悬赏已经过期' };
    if (!item.done) return { ok: false, msg: '目标还没完成' };
    S.bounty.claimed[id] = true;
    Object.entries(item.b.reward).forEach(([k, v]) => addCur(k, v));
    save();
    return { ok: true, msg: `悬赏达成：${item.b.name}`, reward: item.b.reward, name: item.b.name };
  }
  function renewBounties() {
    if (!bountyState().allOver) return { ok: false, msg: '还有悬赏没结束（没领或没过期）' };
    S.bounty = { start: Date.now(), claimed: {} };
    save();
    return { ok: true, msg: '新一期悬赏已刷新' };
  }

  /* ================= 境界（渡劫） ================= */
  // 每 10 级一个境界，达标即可渡劫；成功全属性 +5%，失败只扣材料与点数、等级不掉，可以反复挑战。
  function realmState() {
    const realm = S.player.realm || 0;
    const next = D.REALMS[realm] || null;
    const tier = next ? Math.min(5, 1 + Math.floor((next.lv - 1) / 20)) : 5;
    const matItem = 'mat_t' + tier;
    return {
      realm, next,
      bonusPct: realm * D.REALM_PCT,
      levelOk: next ? S.player.level >= next.lv : false,
      matItem, matN: next ? next.cost.matN : 0,
      haveMat: next ? (S.items[matItem] || 0) : 0,
      points: next ? next.cost.points : 0,
      rate: next ? next.rate : 0,
    };
  }
  function realmBonusPct() { return (S.player.realm || 0) * D.REALM_PCT; }
  function attemptRealm() {
    const st = realmState();
    if (!st.next) return { ok: false, msg: '已经到达最终境界' };
    if (!st.levelOk) return { ok: false, msg: `先升到 Lv.${st.next.lv}（当前 Lv.${S.player.level}）` };
    if (st.haveMat < st.matN) {
      return { ok: false, msg: `渡劫材料不足：需要 ${D.ITEMS[st.matItem].name} ×${st.matN}（现有 ${st.haveMat}）` };
    }
    if (!canAfford({ points: st.points })) return { ok: false, msg: `点数不足：需要 ◈${fmtNum(st.points)}` };
    // 先扣消耗：失败也扣，这是"天道不收白食"；但等级不掉，所以永远有下一次
    S.items[st.matItem] -= st.matN;
    if (S.items[st.matItem] <= 0) delete S.items[st.matItem];
    spend({ points: st.points });
    const success = Math.random() < st.next.rate;
    if (success) S.player.realm = st.realm + 1;
    save();
    return {
      ok: true, success, name: st.next.name, rate: st.next.rate,
      realm: S.player.realm, bonusPct: realmBonusPct(),
      msg: success
        ? `渡劫成功：突破「${st.next.name}」，全队主角属性永久 +${Math.round(D.REALM_PCT * 100)}%`
        : `渡劫失败：消耗已扣除，但等级不掉，再来一次就好`,
    };
  }

  /* ================= 战斗结算钩子 ================= */
  /* --- 副本进度落盘：刷新 / 切后台被系统回收后可以接着打 ---- */
  function setPendingRun(data) {
    S.pendingRun = data ? JSON.parse(JSON.stringify(data)) : null;
    save();
  }
  function clearPendingRun() { S.pendingRun = null; save(); }
  /* --- 回廊印记（由历史最高层派生，不需要额外存档字段） --- */
  const corridorMarks = () => D.corridorMarks(S.corridor.best || 0);
  const corridorMarkBonus = () => D.corridorMarkBonus(S.corridor.best || 0);

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
    // 天赋「主神恩赐」的经验加成在这里统一生效（副本 / 回廊角色经验）
    const n = Math.round(exp * graceExpMult());
    charIds.forEach(id => { const c = S.chars[id]; if (c) c.exp += n; });
    return n;
  }
  // 战斗获得的玩家经验（同样吃经验天赋）；挂机经验已在 idleRates 里算过，不重复加成
  function addPlayerBattleExp(exp) {
    addPlayerExp(Math.round((exp || 0) * graceExpMult()));
  }

  return {
    get S() { return S; },
    save, load, newGame, wipeSave, exportSave, importSave, saveSlot, loadSlot, slotInfo,
    addCur, canAfford, spend, addItem, removeItem, canAddItem, setCurListener,
    bagUsage, buyBagCap,
    addChar, addShards, levelCost, levelUp, useExpItem, starUp, skillUp, SKILL_CHIP_COST,
    craftSerum, useSerum, serumTaken, serumApplied,
    bloodlineUpgrade, geneLockInfo, geneLockUnlock,
    equipStats, effectiveStats, power, teamPower, factionBuffs,
    effectivePlayerStats, playerPower, choosePlayerBloodline, upgradePlayerBloodline,
    allocateAttr, allocateSkill, resetSkills, protagonistSkills, protagonistList, createProtagonist, switchProtagonist,
    grantEquip, grantSignatureEquip, equipItem, canEquip, unequipItem, enhanceCost, enhance, decompose, decomposeMany, inventoryEquips,
    toggleEquipLock, autoEquipBest, equipScore, savePreset, applyPreset,
    recruitOnce, recruitTen, freeRecruit, freeRecruitAvailable, ssrTicketUse,
    idleRates, idleBaseRates, idleLines, idleLineBonus, setIdleLeader, idleMatItem, grantIdleMat,
    settleOffline, onlineTick, idleBankGains, claimIdle, addPlayerExp, offlineCapHours, offlineEfficiency,
    upgradeBuilding,
    unlockWorld, worldCleared, stageComplete, stageUnlocked,
    refreshUnlocks, isUnlocked, unlockTip,
    mainQuestState, currentQuest, claimQuest,
    setPlayerName, charName,
    buyShopItem, openBox, openBoxes, dailyDate, sweepLeft, enhanceMat,
    shopReq,
    ensureDaily, task, claimTask, claimAllTasks, loginReward,
    ensureWeekly, weeklyState, claimWeekly, claimAllWeekly, weekKey,
    achievementState, achievementSummary, claimAchievement,
    todayState, claimEverything, nextStage,
    bountyState, claimBounty, renewBounties, realmState, realmBonusPct, attemptRealm, pityView, pityOf,
    setPendingRun, clearPendingRun, corridorMarks, corridorMarkBonus,
    canReincarnate, reincarnate, buyTalent,
    codexState, claimCodexReward,
    battleSettle, addCharExp, addPlayerBattleExp, graceExpMult, graceDropMult, graceIdleMult, talentAll,
  };
})();
