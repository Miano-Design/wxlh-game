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
t('主角6装备槽', D.PLAYER_SLOTS.length === 6 && D.RECRUIT_SLOTS.length === 3);
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
Core.S.stats.battles = 1;
const qs = Core.mainQuestState();
t('主线q01可完成', qs.find(x => x.q.id === 'q01').done);
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
const allies2 = Core.S.party.filter(Boolean).map((id, i) => {
  const base = D.charById[id];
  const eff = Core.effectiveStats(id);
  return Object.assign({ name: base.name, kind: base.kind, faction: base.faction, position: i < 2 ? 'front' : 'back', skills: base.skills, skillLv: [5, 5, 5] }, eff);
});
const w3boss = Dungeon.makeEnemies('W03', 'normal', 12, 'boss');
const w3res = Battle.run({ allies: allies2, enemies: w3boss, worldId: 'W03', maxRounds: 50 });
console.log(`\nW03 Boss战(Lv60★3队): win=${w3res.win} rounds=${w3res.rounds}`);

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
  t('头部装备仅主角可用', Core.equipItem('@player', eq6.equip.uid) && !Core.equipItem('C021', eq6.equip.uid));
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
