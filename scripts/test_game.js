/* 逻辑冒烟测试：node scripts/test_game.js */
const fs = require('fs');
// 浏览器环境 shim
const store = {};
global.window = global;
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
for (const f of ['js/data.js', 'js/core.js', 'js/battle.js', 'js/dungeon.js']) {
  eval(fs.readFileSync(f, 'utf8'));
}
const D = window.DATA, Core = window.Core, Battle = window.Battle, Dungeon = window.Dungeon;
let pass = 0, fail = 0;
function t(name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL:', name); } }

// 1. 新游戏
Core.newGame();
t('初始点数 50000', Core.S.cur.points === 50000);
t('初始无招募角色', Object.keys(Core.S.chars).length === 0);
t('招募位全空（主角必上阵不占位）', Core.S.party.filter(Boolean).length === 0);
t('主角未命名', Core.S.player.name === '');
t('命名主角', Core.setPlayerName('测试者') && Core.charName('@player') === '测试者');
t('主角独立属性', (() => { const st = Core.effectivePlayerStats(); return st.atk > 0 && st.hp > 0; })());
t('主角与招募角色都是6装备槽', D.PLAYER_SLOTS.length === 6 && D.RECRUIT_SLOTS.length === 6);
t('W01解锁', Core.S.worlds.W01 && Core.S.worlds.W01.unlocked);
t('招募初始锁定', !Core.isUnlocked('recruit'));

// 2. 角色养成
Core.addChar('C021');
Core.S.party[1] = 'C021';
const c = Core.S.chars['C021'];
Core.addCharExp(['C021'], 100000);
Core.addCur('points', 1000000);
const lvBefore = c.lv;
const up = Core.levelUp('C021', 10);
t('升级生效', up.ok && Core.S.chars['C021'].lv > lvBefore);
Core.S.chars['C021'].shards = 200;
t('升星', Core.starUp('C021').ok && Core.S.chars['C021'].star === 2);
Core.addCur('skillChip', 500);
t('技能升级', Core.skillUp('C021', 0).ok);
Core.addCur('bloodCrystal', 10000);
t('血统升级', Core.bloodlineUpgrade('C021').ok);

// 3. 属性计算
const st = Core.effectiveStats('C021');
t('属性完整', st && st.atk > 0 && st.hp > 0 && st.spd > 0);
t('战力>0', Core.power('C021') > 0);

// 4. 装备
const eq = Core.grantEquip('W01', 'SR', 'weapon');
t('装备生成', !!eq.equip);
eq.equip.set = null; eq.equip.classSet = null; // 固定为普通装备，排除套装随机性
Core.equipItem('C021', eq.equip.uid);
const st2 = Core.effectiveStats('C021');
t('装备提升攻击', st2.atk > st.atk);
Core.addCur('otherworld', 500);
const enh = Core.enhance(eq.equip.uid);
t('强化返回', typeof enh.ok === 'boolean');
const dec = Core.decompose(eq.equip.uid);
t('分解返还', dec.ok && dec.gain >= 50);

// 5. 招募（含保底）
Core.addCur('holy', 20000);
let urCount = 0, results = 0;
for (let i = 0; i < 120; i++) {
  const r = Core.recruitOnce('advanced');
  if (r.error) break;
  results++;
  if (r.rarity === 'UR') urCount++;
}
t('100抽必有UR(保底)', urCount >= 1);
t('招募计数', results >= 100);

// 6. 战斗：强队打 W01 第一关必胜（含主角）
Object.keys(Core.S.chars).forEach(id => { Core.S.chars[id].lv = 30; });
const pst = Core.effectivePlayerStats();
const allies = [Object.assign({ name: '主角', kind: 'warrior', faction: null, position: 'front', skills: D.PROTAGONIST.skills, skillLv: [1, 1, 1], maxHp: pst.hp, charId: '@player' }, pst)]
  .concat(Core.S.party.filter(Boolean).map((id, i) => {
  const base = D.charById[id];
  const eff = Core.effectiveStats(id);
  return Object.assign({ name: base.name, kind: base.kind, faction: base.faction, position: i < 2 ? 'front' : 'back', skills: base.skills, skillLv: Core.S.chars[id].skillLv, maxHp: eff.hp }, eff);
}));
const enemies = Dungeon.makeEnemies('W01', 'normal', 1, 'combat');
const res = Battle.run({ allies, enemies, worldId: 'W01', maxRounds: 30 });
t('Lv30打W01-1胜利', res.win);
t('战斗帧非空', res.frames.length > 3);

// 7. Boss战可打
const bossEnemies = Dungeon.makeEnemies('W01', 'normal', 12, 'boss');
const bossRes = Battle.run({ allies, enemies: bossEnemies, worldId: 'W01', maxRounds: 50 });
t('Boss战正常结束', typeof bossRes.win === 'boolean' && bossRes.frames.some(f => f.type === 'end'));

// 8. 路线生成
const route = Dungeon.genRoute('W01', 5);
t('路线3步', route.steps.length === 3 && route.steps.every(s => s.length === 2));

// 9. 关卡通关结算
const sc = Core.stageComplete('W01', 'normal', 0, 3);
t('首关记录', Core.S.worlds.W01.stages.normal[0] === 3);
t('第二关解锁', Core.stageUnlocked('W01', 'normal', 1));
t('第三关未解锁', !Core.stageUnlocked('W01', 'normal', 2));
t('通关1关后解锁招募', sc.newUnlocks.includes('轮回者招募') && Core.isUnlocked('recruit'));

// 9b. 主线任务
Core.S.stats.profileViews = 1;
Core.S.stats.battles = 1;
const qs = Core.mainQuestState();
t('主线q01可完成', qs.find(x => x.q.id === 'q01').done);
t('主线q01b可完成', qs.find(x => x.q.id === 'q01b').done);
t('主线q02可完成', qs.find(x => x.q.id === 'q02').done);
t('领取主线', Core.claimQuest('q01').ok);

// 9c. 新手掉落保护
{
  let high = 0;
  for (let i = 0; i < 200; i++) {
    const r = D.rollRarity('normal');
    const capped = D.capRarity(r, D.stageDropCap(1));
    if (D.RARITIES.indexOf(capped) > 1) high++;
  }
  t('1-3关不掉SR以上', high === 0);
}

// 10. 挂机
Core.S.idle.bankSec = 3600;
const gains = Core.claimIdle();
t('挂机1小时收益', gains.points > 0 && gains.exp > 0);

// 11. 存档往返
const json = Core.exportSave();
t('导入', Core.importSave(json).ok);
t('导入后数据一致', Core.S.chars['C021'].star === 2);

// 12. 每日任务
Core.ensureDaily();
for (let i = 0; i < 5; i++) Core.task('battle5', 1);
t('任务领取', Core.claimTask('battle5').ok);

// 13. 登录奖励
const lr = Core.loginReward();
t('登录奖励', lr && lr.day >= 1);

// 14. 商店
Core.addCur('points', 100000);
t('主神商店购买', Core.buyShopItem('god', 0).ok);

// 15. 回廊敌人曲线
const e50 = D.corridorEnemy(50);
t('回廊Boss', e50.isBoss && e50.hp > 10000);

// 16. 转生条件
t('默认不可转生', !Core.canReincarnate());

// 17. 全员满级队打 W03 Boss（中期校验）
Object.keys(Core.S.chars).forEach(id => { Core.S.chars[id].lv = 60; Core.S.chars[id].star = 3; });
Core.S.party = Object.keys(Core.S.chars).slice(0, 4); // 组满 4 名招募角色，模拟正常中期队伍
Core.S.player.level = 60;
const pst2 = Core.effectivePlayerStats();
const allies2 = [Object.assign({ name: '主角', kind: 'warrior', faction: null, position: 'front', skills: D.PROTAGONIST.skills, skillLv: [3, 3, 3] }, pst2)]
  .concat(Core.S.party.filter(Boolean).map((id, i) => {
  const base = D.charById[id];
  const eff = Core.effectiveStats(id);
  return Object.assign({ name: base.name, kind: base.kind, faction: base.faction, position: i < 2 ? 'front' : 'back', skills: base.skills, skillLv: [5, 5, 5] }, eff);
}));
const w3boss = Dungeon.makeEnemies('W03', 'normal', 12, 'boss');
const w3res = Battle.run({ allies: allies2, enemies: w3boss, worldId: 'W03', maxRounds: 50 });
t('Lv60★3 五人队能打过 W03 Boss', w3res.win);
Core.S.player.level = 1;
Core.S.party = [null, null, null, null];
Core.S.party[1] = 'C021';

// 10b. 主角成长体系
{
  const before = Core.effectivePlayerStats();
  Core.S.player.level = 20;
  const after = Core.effectivePlayerStats();
  t('主角随玩家等级成长', after.atk > before.atk && after.hp > before.hp);
  t('主角血统选择', Core.choosePlayerBloodline('狼人').ok);
  Core.addCur('bloodCrystal', 10000); Core.addCur('points', 1000000);
  t('主角血统升级', Core.upgradePlayerBloodline().ok && Core.S.player.bloodlineLv === 1);
  t('血统不可更改', !Core.choosePlayerBloodline('魔法').ok);
  const eq6 = Core.grantEquip('W01', 'SR', 'head');
  eq6.equip.set = null; eq6.equip.classSet = null; // 固定为普通装备，排除套装随机性
  t('头部装备主角可穿', Core.equipItem('@player', eq6.equip.uid));
  Core.unequipItem('@player', 'head');
  t('头部装备招募角色也可穿（6 槽修正）', Core.equipItem('C021', eq6.equip.uid));
  Core.unequipItem('C021', 'head');
  Core.S.player.level = 1;
}

// 18. 六维属性点
{
  Core.S.player.attrPoints = 0;
  Core.addPlayerExp(0);
  const lv0 = Core.S.player.level;
  Core.S.player.exp = 0;
  Core.addPlayerExp(D.EXP_TABLE[lv0] + 1);
  t('升级获得属性点', Core.S.player.attrPoints === D.ATTR_POINTS_PER_LV);
  const atk0 = Core.effectivePlayerStats().atk;
  const r = Core.allocateAttr('muscle', 3);
  t('分配属性点', r.ok && Core.S.player.attrPoints === 0);
  t('肌肉加点提升攻击', Core.effectivePlayerStats().atk > atk0);
  t('点数不足不能分配', !Core.allocateAttr('nerve', 1).ok);
}

// 19. 血统等级门槛
{
  Core.S.player.level = 1; Core.S.player.bloodline = null; Core.S.player.bloodlineLv = 0;
  t('Lv.1 不能觉醒血统', !Core.choosePlayerBloodline('狼人').ok);
  Core.S.player.level = D.BLOODLINE_UNLOCK_LV;
  t('Lv.20 可觉醒血统', Core.choosePlayerBloodline('狼人').ok);
}

// 20. 新建角色（多主角）
{
  const oldName = Core.S.player.name;
  const r = Core.createProtagonist('第二世');
  t('新建角色', r.ok && Core.S.player.name === '第二世' && Core.S.player.level === 1 && !Core.S.player.bloodline);
  t('旧角色保留', Core.protagonistList().length === 2 && Core.protagonistList()[1].name === oldName);
  Core.S.player.level = 5;
  t('切换角色', Core.switchProtagonist(0).ok && Core.S.player.name === oldName);
  t('切回后等级还原', Core.switchProtagonist(0).ok && Core.S.player.name === '第二世' && Core.S.player.level === 5);
  Core.switchProtagonist(0); // 切回原主角
}

// 21. 背包容量
{
  const u0 = Core.bagUsage();
  t('背包容量初始100', u0.cap === 100);
  Core.S.bag.cap = u0.used; // 强制塞满
  Core.S.settings.autoSellN = false; Core.S.settings.autoSellR = false;
  t('背包满时新道具失败', Core.addItem('heal_l') === false);
  t('已满的堆叠仍可叠加', Core.addItem('heal_s') === true);
  const eqFull = Core.grantEquip('W01', 'N');
  t('背包满时装备自动分解', eqFull.sold === true && eqFull.bagFull === true);
  Core.S.bag.cap = 100;
  Core.addCur('points', 100000);
  const cap0 = Core.bagUsage().cap;
  t('购买扩容', Core.buyBagCap().ok && Core.bagUsage().cap === cap0 + D.BAG_EXPAND_SIZE);
}

// 22. 删除进度不再被 beforeunload 回写
{
  Core.wipeSave();
  t('wipeSave 后 save 被抑制', (Core.save(), !store['wxlh_save_v5']));
}

// 23. 主角技能加点
{
  Core.S.player.bloodline = null; Core.S.player.bloodlineLv = 0;
  Core.S.player.skillPoints = 3; Core.S.player.skillLv = [1, 1, 1];
  t('技能加点', Core.allocateSkill(0).ok && Core.S.player.skillLv[0] === 2 && Core.S.player.skillPoints === 2);
  const r = Core.resetSkills();
  t('洗点返还', r.ok && Core.S.player.skillLv.join() === '1,1,1' && Core.S.player.skillPoints === 3);
  t('未觉醒用通用技能', Core.protagonistSkills().s1.name === '求生突刺');
  Core.S.player.bloodline = '血族';
  t('觉醒后切换血统技能', Core.protagonistSkills().s1.name === '猩红汲取');
  Core.S.player.bloodline = null;
}

// 24. 装备四类
{
  Core.S.bag.cap = 99999; // 避免背包满干扰判定
  let plain = 0, world = 0, cls = 0;
  for (let i = 0; i < 300; i++) {
    const e = Core.grantEquip('W01', 'SR');
    if (e.equip) {
      if (e.equip.charId) continue;
      if (e.equip.classSet) cls++;
      else if (e.equip.set) world++;
      else plain++;
    }
  }
  t('SR装备含世界套装与职业套装', world > 100 && cls > 30);
  for (let i = 0; i < 100; i++) {
    const e = Core.grantEquip('W01', 'N');
    if (e.equip && (e.equip.set || e.equip.classSet)) plain = -999;
  }
  t('N装备全为普通装', plain !== -999);
  const sig = Core.grantSignatureEquip(0);
  t('专属装备生成', !!sig.equip && sig.equip.charId === 'C039' && sig.equip.rarity === 'UR');
  t('专属装备他人不可装备', !Core.equipItem('@player', sig.equip.uid));
  Core.addChar('C039');
  t('专属装备本人可装备', Core.equipItem('C039', sig.equip.uid));
}

// 25. 职业套装需定位匹配
{
  // 找一名战士与一名非战士
  const all = D.characters.map(c => c.id);
  const war = all.find(id => D.charById[id].kind === 'warrior');
  const nonWar = all.find(id => D.charById[id].kind === 'mage');
  Core.addChar(war); Core.addChar(nonWar);
  const mk = uid => { Core.S.equips[uid] = { uid, name: '狂战·测试', slot: 'weapon', rarity: 'SR', enhance: 0, base: { atk: 100 }, affixes: [], set: null, classSet: 'warrior' }; };
  mk('eqc1'); mk('eqc2'); mk('eqc3'); mk('eqc4');
  // 战士穿 2 件（武器+饰品槽不足，改为同位两件不可，故用 weapon+accessory）
  Core.S.equips['eqc2'].slot = 'accessory';
  Core.S.equipped[war] = { weapon: 'eqc1', armor: null, accessory: 'eqc2' };
  const warWith = Core.effectiveStats(war).atk;
  Core.S.equips['eqc1'].classSet = null; Core.S.equips['eqc2'].classSet = null;
  const warWithout = Core.effectiveStats(war).atk;
  Core.S.equips['eqc1'].classSet = 'warrior'; Core.S.equips['eqc2'].classSet = 'warrior';
  // 非战士穿同样 2 件
  Core.S.equipped[nonWar] = { weapon: 'eqc3', armor: null, accessory: 'eqc4' };
  const mageWith = Core.effectiveStats(nonWar).atk;
  Core.S.equips['eqc3'].classSet = null; Core.S.equips['eqc4'].classSet = null;
  const mageWithout = Core.effectiveStats(nonWar).atk;
  t('职业套装按定位激活', warWith > warWithout && mageWith === mageWithout);
  delete Core.S.equips['eqc1']; delete Core.S.equips['eqc2']; delete Core.S.equips['eqc3']; delete Core.S.equips['eqc4'];
  Core.S.equipped[war] = { weapon: null, armor: null, accessory: null };
  Core.S.equipped[nonWar] = { weapon: null, armor: null, accessory: null };
}

// 26. 穿戴规则（canEquip）：职业套装限定位、专属限本人、槽位限角色类型
{
  const war = D.characters.find(c => c.kind === 'warrior').id;
  const mage = D.characters.find(c => c.kind === 'mage').id;
  if (!Core.S.chars[war]) Core.addChar(war);
  if (!Core.S.chars[mage]) Core.addChar(mage);
  const classEq = { uid: 'x1', slot: 'weapon', classSet: 'mage' };
  t('法师套装法师可穿', Core.canEquip(mage, classEq) === true);
  t('法师套装战士不可穿', Core.canEquip(war, classEq) === false);
  t('法师套装主角(战士)不可穿', Core.canEquip('@player', classEq) === false);
  t('战士套装主角可穿', Core.canEquip('@player', { uid: 'x2', slot: 'weapon', classSet: 'warrior' }) === true);
  t('专属装备限本人', Core.canEquip(war, { uid: 'x3', slot: 'weapon', charId: mage }) === false && Core.canEquip(mage, { uid: 'x3', slot: 'weapon', charId: mage }) === true);
  t('招募角色也有头部槽（世界套装4/6件可达）', Core.canEquip(war, { uid: 'x4', slot: 'head' }) === true);
  t('主角六槽全开', Core.canEquip('@player', { uid: 'x5', slot: 'head' }) === true);
  t('equipItem 拒绝非本职业套装', Core.equipItem(war, (Core.S.equips['x1'] = Object.assign({ name: 't', rarity: 'SR', enhance: 0, base: {}, affixes: [], set: null }, classEq), 'x1')) === false);
  delete Core.S.equips['x1'];
}

// 27. 扫荡每日上限
{
  Core.S.worlds.W01.stages.normal[0] = 3; // 确保已通关第1关
  Core.S.sweep = { date: Core.dailyDate(), count: 0 };
  t('初始剩余60次', Core.sweepLeft() === 60);
  const r1 = Dungeon.sweep('W01', 'normal', 1, 10);
  t('扫荡10次成功', r1.ok && r1.count === 10 && Core.sweepLeft() === 50);
  Core.S.sweep.count = 58;
  const r2 = Dungeon.sweep('W01', 'normal', 1, 10);
  t('超出上限只扫剩余2次', r2.ok && r2.count === 2 && r2.capped === true);
  const r3 = Dungeon.sweep('W01', 'normal', 1, 10);
  t('用完拒绝扫荡', !r3.ok);
  Core.S.sweep.date = '2000-01-01'; // 模拟跨天
  t('跨天自动重置', Core.sweepLeft() === 60);
  Core.S.sweep = { date: Core.dailyDate(), count: 0 };
}

// 28. 批量分解
{
  const before = Core.S.cur.otherworld;
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const uid = 'bd' + i;
    Core.S.equips[uid] = { uid, name: '批量' + i, slot: 'weapon', rarity: 'N', enhance: i, base: {}, affixes: [], set: null };
    ids.push(uid);
  }
  const r = Core.decomposeMany(ids.concat(['不存在']));
  const expect = ids.reduce((s, u, i) => s + D.DECOMPOSE_GAIN.N + i * 3, 0);
  t('批量分解数量与收益', r.ok && r.count === 3 && r.gain === expect);
  t('批量分解入账', Core.S.cur.otherworld === before + expect);
  t('批量分解后装备移除', ids.every(u => !Core.S.equips[u]));
}

// 29. 回归：免费招募 / SSR 券必须计入主线与日常
{
  Core.newGame();
  Core.setPlayerName('回归');
  const q3 = () => Core.mainQuestState().find(x => x.q.id === 'q03').done;
  t('免费招募前 q03 未完成', q3() === false);
  Core.freeRecruit();
  t('免费招募后 q03 完成', q3() === true);
  t('免费招募计入统计', Core.S.stats.recruits === 1);
  t('免费招募计入日常', Core.S.tasks.daily.recruit1 === 1);
  Core.S.ssrTicket = 1;
  Core.ssrTicketUse(D.characters.find(c => c.rarity === 'SSR' && !c.hidden).id);
  t('SSR 自选券也计入统计', Core.S.stats.recruits === 2);
}

// 30. 回归：十连按折扣价整笔结算，不会扣了钱看不到结果
{
  Core.newGame();
  Core.setPlayerName('回归');
  Core.S.cur.points = 47000;                 // 够不上十连实际价 45000 的边界外
  Core.S.cur.points = 44999;
  const poor = Core.recruitTen('normal');
  t('点数不够十连直接拒绝', !!poor.error && Core.S.cur.points === 44999);
  t('被拒绝时不产生角色', Object.keys(Core.S.chars).length === 0);

  Core.newGame();
  Core.S.cur.points = 45000;
  const ok = Core.recruitTen('normal');
  t('十连成功返回10个结果', !ok.error && ok.results.length === 10);
  t('十连按折扣价扣款', Core.S.cur.points === 0);
  t('十连保底至少1个SR', ok.results.some(r => D.RARITIES.indexOf(r.rarity) >= 2));

  Core.newGame();
  Core.S.cur.holy = 900;
  const ok2 = Core.recruitTen('advanced');
  t('高级十连扣 900 晶石', !ok2.error && Core.S.cur.holy === 0);
  Core.S.cur.holy = 899;
  const poor2 = Core.recruitTen('advanced');
  t('晶石不足高级十连被拒', !!poor2.error && Core.S.cur.holy === 899);
}

// 31. 回归：强化失败不许白吞材料
{
  Core.newGame();
  Core.setPlayerName('回归');
  Core.addItem('mat_t1', 5);
  const eq = Core.grantEquip('W01', 'SR', 'weapon').equip;
  eq.enhance = 0; eq.set = null; eq.classSet = null;
  Core.S.cur.points = 0; Core.S.cur.otherworld = 0;
  const r = Core.enhance(eq.uid);
  t('点数不足强化失败', r.ok === false && !r.fail);
  t('失败不消耗材料', Core.S.items.mat_t1 === 5);
  Core.S.cur.points = 100000; Core.S.cur.otherworld = 100;
  const r2 = Core.enhance(eq.uid);
  t('材料充足时强化会扣材料', Core.S.items.mat_t1 === 4);
  t('强化返回结果', typeof r2.ok === 'boolean');
}

// 32. 回归：七日登录七天一循环，不再无限发 SSR 券
{
  Core.newGame();
  const seq = [];
  for (let i = 0; i < 14; i++) {
    Core.S.login.lastClaim = 'day' + i;
    seq.push(Core.loginReward().day);
  }
  t('登录天数 1→7 后回到 1', seq.join(',') === '1,2,3,4,5,6,7,1,2,3,4,5,6,7');
  t('十四天只发 2 张 SSR 券', Core.S.ssrTicket === 2);
}

// 33. 回归：背包满时购买不扣钱
{
  Core.newGame();
  Core.setPlayerName('回归');
  Object.keys(Core.S.items).forEach(k => delete Core.S.items[k]);
  Core.S.bag.cap = 2;
  Core.S.items.mat_t1 = 1; Core.S.items.mat_t2 = 1;   // 占满 2 格
  Core.S.cur.points = 100000;
  const r = Core.buyShopItem('god', 0);                // 初级经验模块
  t('背包满时购买被拒', r.ok === false);
  t('背包满时不扣货币', Core.S.cur.points === 100000);
  t('背包满时不发道具', (Core.S.items.exp_s || 0) === 0);
  t('已有堆叠仍可购买', (() => {
    Core.S.items.exp_s = 1;                            // 该道具已有堆叠，不占新格
    return Core.buyShopItem('god', 0).ok === true;
  })());
}

// 34. 强化剂有来源也有用：商店能买、探索增益可叠加
{
  Core.newGame();
  Core.setPlayerName('回归');
  Core.S.cur.points = 100000;
  const godShop = D.SHOPS.god.items;
  t('主神商店上架肌肉强化剂', godShop.some(x => x.item === 'buff_muscle'));
  t('主神商店上架神经刺激剂', godShop.some(x => x.item === 'buff_nerve'));
  const idx = godShop.findIndex(x => x.item === 'buff_muscle');
  const r = Core.buyShopItem('god', idx);
  t('强化剂可购买', r.ok === true && Core.S.items.buff_muscle === 1);
  t('强化剂带明确使用场景', D.ITEMS.buff_muscle.where === 'explore' && !!D.ITEMS.buff_muscle.use);
  t('神经刺激剂效果是速度', D.ITEMS.buff_nerve.effect.spdPct === 0.2);
}

// 35. 图鉴收集奖励
{
  Core.newGame();
  Core.setPlayerName('回归');
  const ids = D.characters.slice(0, 5).map(c => c.id);
  ids.forEach(id => Core.addChar(id));
  const st = Core.codexState();
  t('图鉴达到 5 名', st.owned === 5 && st.rewards.find(r => r.n === 5).reached);
  const before = Core.S.cur.points;
  const r = Core.claimCodexReward(5);
  t('图鉴奖励可领取', r.ok === true && Core.S.cur.points > before);
  t('图鉴奖励不可重复领', Core.claimCodexReward(5).ok === false);
}

// 36. 自动分解开关
{
  Core.newGame();
  Core.setPlayerName('回归');
  Core.S.settings.autoSellN = true;
  const before = Core.S.cur.otherworld;
  const res = Core.grantEquip('W01', 'N', 'weapon');
  t('自动分解 N 不进背包', res.sold === true && res.auto === true);
  t('自动分解换成异界结晶', Core.S.cur.otherworld === before + D.DECOMPOSE_GAIN.N);
  t('自动分解不留下装备', Object.keys(Core.S.equips).length === 0);
}

/* ================= 2026-09-12 优化批次回归 ================= */

// 37. 转生天赋：文案与实装必须一致（旧版 40 个节点里 15 个是空文本）
{
  Core.newGame(); Core.setPlayerName('天赋');
  Core.S.player.level = 1;
  Core.S.equipped['@player'] = { weapon: null, head: null, armor: null, hands: null, legs: null, accessory: null };
  const probes = {
    hpPct: () => Core.effectivePlayerStats().hp,
    defPct: () => Core.effectivePlayerStats().def,
    spdPct: () => Core.effectivePlayerStats().spd,
    critPct: () => Core.effectivePlayerStats().crit,
    critDmg: () => Core.effectivePlayerStats().critDmg,
    skillPct: () => Core.effectivePlayerStats().skillMult,
    evaPct: () => Core.effectivePlayerStats().eva,
    spiritPct: () => Core.effectivePlayerStats().skillMult,
    healUp: () => Core.effectivePlayerStats().healUp,
    dmgReduce: () => Core.effectivePlayerStats().dmgReduce,
    initEnergy: () => Core.effectivePlayerStats().initEnergy,
    cdRed: () => Core.effectivePlayerStats().cdRed,
    firstStrike: () => Core.effectivePlayerStats().firstStrike,
    ultPct: () => Core.effectivePlayerStats().ultPct,
    idlePct: () => Core.idleRates().pointsPerMin,
    expPct: () => Core.idleRates().expPerMin,
    dropPct: () => Core.graceDropMult(),
    offlinePct: () => Core.offlineEfficiency(),
  };
  const bad = [];
  ['body', 'energy', 'nerve', 'grace'].forEach(b => {
    D.TALENTS[b].nodes.forEach((n, i) => {
      Object.keys(n.e).forEach(k => {
        if (!probes[k]) { bad.push(`${b}#${i + 1}:${k}(无探针)`); return; }
        Core.S.player.talents = { body: 0, energy: 0, nerve: 0, grace: 0 };
        Core.S.player.talents[b] = i;
        const a = probes[k]();
        Core.S.player.talents[b] = i + 1;
        const c = probes[k]();
        if (!(c > a)) bad.push(`${b}#${i + 1}:${k}(${a}→${c})`);
      });
    });
  });
  Core.S.player.talents = { body: 0, energy: 0, nerve: 0, grace: 0 };
  const totalNodes = Object.values(D.TALENTS).reduce((s, x) => s + x.nodes.length, 0);
  t('天赋共 40 个节点', totalNodes === 40);
  t('每个天赋节点的文案与效果都齐备', Object.values(D.TALENTS).every(x => x.nodes.every(n => n.text && n.e && Object.keys(n.e).length)));
  if (bad.length) console.log('  未生效节点：', bad.join(' | '));
  t('40 个天赋节点逐级都真的生效（无空文本）', bad.length === 0);
}

// 38. 世界套装 4/6 件对招募角色可以触发
{
  Core.newGame(); Core.setPlayerName('套装');
  Core.addChar('C021');
  const naked = Core.effectiveStats('C021');
  const slots = ['weapon', 'head', 'armor', 'hands', 'legs', 'accessory'];
  slots.slice(0, 4).forEach(s => {
    const r = Core.grantEquip('W01', 'SR', s);
    r.equip.set = 'W01'; r.equip.classSet = null; r.equip.affixes = [];
    Core.equipItem('C021', r.equip.uid);
  });
  const four = Core.effectiveStats('C021');
  t('招募角色能激活 4 件套（旧版永远不可达）', four.sets['W01'] === 4 && four.resPct > naked.resPct);
  slots.slice(4).forEach(s => {
    const r = Core.grantEquip('W01', 'SR', s);
    r.equip.set = 'W01'; r.equip.classSet = null; r.equip.affixes = [];
    Core.equipItem('C021', r.equip.uid);
  });
  const six = Core.effectiveStats('C021');
  t('招募角色能激活 6 件套', six.sets['W01'] === 6 && six.atk > four.atk && six.hp > four.hp);
  t('装备掉落池 6 个部位都能被人穿', D.DROP_SLOTS.every(s => D.RECRUIT_SLOTS.includes(s)));
}

// 39. 装备锁定保护
{
  Core.newGame(); Core.setPlayerName('锁定');
  const r = Core.grantEquip('W01', 'SR', 'weapon');
  Core.toggleEquipLock(r.equip.uid);
  t('锁定后单件分解被拒绝', !Core.decompose(r.equip.uid).ok);
  t('锁定后批量分解会跳过', Core.decomposeMany([r.equip.uid]).count === 0);
  Core.toggleEquipLock(r.equip.uid);
  t('解锁后可以分解', Core.decompose(r.equip.uid).ok);
}

// 40. 一键最优装备 + 编队预设
{
  Core.newGame(); Core.setPlayerName('配装');
  ['C021', 'C022', 'C023', 'C024'].forEach(id => Core.addChar(id));
  Core.S.party = ['C021', 'C022', 'C023', 'C024'];
  for (let i = 0; i < 16; i++) Core.grantEquip('W03', 'SSR');
  const r = Core.autoEquipBest();
  t('一键最优装备会换装', r.ok && r.changed > 0);
  const used = [];
  Object.values(Core.S.equipped).forEach(sl => Object.values(sl).forEach(u => { if (u) used.push(u); }));
  t('一键最优装备不会把同一件分给两个人', new Set(used).size === used.length);
  // 先确保 C021 有一件武器，再锁定它；然后塞一堆更好的武器，看一键最优会不会把它换走
  const w1 = Core.grantEquip('W03', 'SSR', 'weapon');
  w1.equip.set = null; w1.equip.classSet = null; w1.equip.affixes = [];
  Core.equipItem('C021', w1.equip.uid);
  Core.toggleEquipLock(w1.equip.uid);
  for (let i = 0; i < 6; i++) Core.grantEquip('W06', 'UR', 'weapon');
  Core.autoEquipBest();
  t('锁定装备不会被一键换走', Core.S.equipped['C021'].weapon === w1.equip.uid);
  t('编队预设保存', Core.savePreset(0).ok && Core.S.presets[0].filter(Boolean).length === 4);
  Core.S.party = [null, null, null, null];
  t('编队预设套用', Core.applyPreset(0).ok && Core.S.party.filter(Boolean).length === 4);
  t('空预设不可套用', !Core.applyPreset(2).ok);
}

// 41. 周常任务
{
  Core.newGame(); Core.setPlayerName('周常');
  Core.ensureDaily();
  for (let i = 0; i < 100; i++) Core.task('battle5', 1);
  const st = Core.weeklyState().find(x => x.t.src === 'battle');
  t('周常进度与每日动作同源', st.prog === 100 && st.done);
  t('周常可领取', Core.claimWeekly(st.t.id).ok);
  t('周常不可重复领取', !Core.claimWeekly(st.t.id).ok);
  Core.S.tasks.weekKey = '2000-01-03';
  t('跨周自动重置进度', Core.weeklyState().every(x => x.prog === 0));
}

// 42. 成就系统
{
  Core.newGame(); Core.setPlayerName('成就');
  t('成就未达成时不可领', !Core.claimAchievement('a_battle100').ok);
  Core.S.stats.battles = 100;
  const r = Core.claimAchievement('a_battle100');
  t('成就达成后可领取', r.ok && Core.S.achievements['a_battle100'] === true);
  t('成就不可重复领取', !Core.claimAchievement('a_battle100').ok);
  t('成就分四类且数量足够', D.ACHIEVEMENTS.length >= 18 && ['战斗', '养成', '收集', '挑战'].every(c => D.ACHIEVEMENTS.some(a => a.cat === c)));
}

// 43. 成长曲线量级（防止再次与挂机产出脱节）
{
  Core.newGame(); Core.setPlayerName('曲线');
  const expTotal = D.EXP_TABLE.slice(1, 100).reduce((a, b) => a + b, 0);
  const ptTotal = D.LEVEL_POINTS.slice(1, 100).reduce((a, b) => a + b, 0);
  t('单人满级经验总量 < 200 万', expTotal < 2000000);
  t('单人满级点数总量 < 30 万', ptTotal < 300000);
  Core.S.player.level = 100; Core.S.player.geneLock = 5;
  Core.S.player.talents = { body: 0, energy: 0, nerve: 0, grace: 10 };   // 满「主神恩赐」
  Core.S.buildings.core = 30; Core.S.buildings.medical = 50; Core.S.buildings.training = 50;
  const r = Core.idleRates();
  t('满配挂机点数 ≥ 80/分', r.pointsPerMin >= 80);
  t('满配挂机经验 ≥ 120/分', r.expPerMin >= 120);
}

// 44. 死道具修复：高阶物品必须有来源
{
  const shopItems = Object.values(D.SHOPS).flatMap(s => s.items.map(i => i.item)).filter(Boolean);
  t('高级经验模块有商店来源', shopItems.includes('exp_l'));
  t('超级经验模块有来源', shopItems.includes('exp_xl'));
  t('虚空晶体有商店来源', shopItems.includes('mat_t4'));
  t('主神残片有商店来源', shopItems.includes('mat_t5'));
  t('T5 材料不再与建筑同名', D.ITEMS.mat_t5.name !== '主神核心');
  t('每个道具都写了获取途径', Object.values(D.ITEMS).every(i => !!i.src));
}

// 45. 商店按进度上架
{
  Core.newGame(); Core.setPlayerName('解锁');
  Core.addCur('points', 2000000);
  const idx = D.SHOPS.god.items.findIndex(i => i.item === 'mat_t4');
  t('未通关 W04 时 T4 未上架', !Core.buyShopItem('god', idx).ok);
  Core.S.worlds.W04 = { unlocked: true, stages: { normal: Array(12).fill(3), hard: Array(12).fill(0), hell: Array(12).fill(0) } };
  const r = Core.buyShopItem('god', idx);
  t('通关 W04 后可购买 T4', r.ok && (Core.S.items.mat_t4 || 0) === 5);
}

// 46. 回廊曲线与回廊印记
{
  t('回廊 100 层不再是断崖', D.corridorEnemy(100).hp < 200000 && D.corridorEnemy(100).hp > 80000);
  t('回廊印记每 10 层 1 枚', D.corridorMarks(95) === 9 && D.corridorMarks(100) === 10);
  t('回廊印记有上限', D.corridorMarks(9999) === D.CORRIDOR_MARK_CAP);
  t('回廊印记加成为 1.5%/枚', Math.abs(D.corridorMarkBonus(100) - 0.15) < 1e-9);
}

// 47. 副本进度落盘
{
  Core.newGame(); Core.setPlayerName('续命');
  t('默认没有未完成副本', Core.S.pendingRun === null);
  Core.setPendingRun({ worldId: 'W01', diff: 'normal', stage: 3, step: 1, hpPct: { '@player': 0.5 }, buffs: {}, route: { steps: [[], [], []], events: [], finalKind: 'combat' } });
  const json = Core.exportSave();
  Core.importSave(json);
  t('副本进度写进存档并能读回', !!Core.S.pendingRun && Core.S.pendingRun.stage === 3 && Core.S.pendingRun.hpPct['@player'] === 0.5);
  Core.clearPendingRun();
  t('副本进度可清除', Core.S.pendingRun === null);
}

// 48. 战斗引擎真的消费天赋字段
{
  Core.newGame(); Core.setPlayerName('引擎');
  const mk = extra => [Object.assign({ name: '测试者', kind: 'warrior', position: 'front', skills: D.PROTAGONIST.skills, skillLv: [1, 1, 1], maxHp: 6000, hp: 6000, atk: 300, def: 100, spd: 90, crit: 0.2, critDmg: 2, eva: 0, skillMult: 1 }, extra || {})];
  const foe = () => [{ name: '木桩', hp: 30000, atk: 300, def: 50, spd: 60 }];
  const takenTotal = res => {
    const uid = res.frames[0].allies[0].uid;
    return res.frames.filter(f => f.type === 'damage' && f.target === uid).reduce((s, f) => s + f.dmg, 0);
  };
  const plain = Battle.run({ allies: mk(), enemies: foe(), worldId: null, maxRounds: 8 });
  const reduced = Battle.run({ allies: mk({ dmgReduce: 0.5 }), enemies: foe(), worldId: null, maxRounds: 8 });
  t('减伤字段真的减伤', takenTotal(plain) > 0 && takenTotal(reduced) < takenTotal(plain) * 0.8);
  const energy = Battle.run({ allies: mk({ initEnergy: 100 }), enemies: foe(), worldId: null, maxRounds: 4 });
  t('开场能量让第一回合就放必杀', energy.frames.slice(0, 14).some(f => f.type === 'skill' && f.ult));
  const healed = Battle.run({ allies: mk({ healUp: 1 }), enemies: foe(), worldId: null, maxRounds: 6 });
  t('受治疗字段不报错并可正常结算', typeof healed.win === 'boolean' && healed.frames.some(f => f.type === 'end'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
