/* UI 冒烟测试：用 DOM 桩执行全部界面渲染，捕捉模板/空引用错误 */
const fs = require('fs');
const store = {};
global.window = global;
global.addEventListener = () => {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
function El(tag) {
  const el = {
    tag, children: [], style: {}, dataset: {}, classList: {
      add() {}, remove() {}, toggle() {},
    },
    set innerHTML(v) { this._html = v; this.children = []; },
    get innerHTML() { return this._html || ''; },
    textContent: '',
    value: '',
    disabled: false,
    scrollTop: 0,
    scrollHeight: 0,
    offsetWidth: 0,
    appendChild(c) { this.children.push(c); return c; },
    remove() {},
    querySelector() { return El('stub'); },
    querySelectorAll() { return []; },
    addEventListener() {},
    focus() {},
    click() {},
    get firstChild() { return this.children[0] || null; },
  };
  return el;
}
const byId = {};
global.document = {
  readyState: 'complete',
  getElementById(id) { return byId[id] || (byId[id] = El('div#' + id)); },
  createElement(t) { return El(t); },
  addEventListener() {},
  hidden: false,
};
global.setTimeout = (fn) => 0;   // 不执行延时回调
global.setInterval = () => 0;
global.Blob = function () {};
global.URL = { createObjectURL: () => '' };
global.FileReader = function () {};

for (const f of ['js/data.js', 'js/core.js', 'js/battle.js', 'js/dungeon.js', 'js/ui.js', 'js/main.js']) {
  eval(fs.readFileSync(f, 'utf8'));
}
const UI = window.UI, Core = window.Core, D = window.DATA;
let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; console.log('FAIL:', name, '→', e.message); }
}

t('boot 完成（newGame + init）', () => { if (!Core.S) throw new Error('no state'); });
t('首页渲染含主线任务', () => {
  const html = byId['view'].innerHTML;
  if (!html.includes('主线')) throw new Error('无主线卡');
});
for (const tab of ['dungeon', 'party', 'chars', 'equip', 'home']) {
  t('切换到 ' + tab, () => { UI._setTab(tab); });
}
t('世界详情渲染', () => {
  UI._setTab('dungeon');
  // 模拟点击进入世界详情
  Core.stageComplete('W01', 'normal', 0, 3);
  UI.render();
});
t('主线任务卡在首页出现领取', () => {
  Core.addChar('C021');
  Core.S.chars['C021'].lv = 6;
  UI._setTab('home');
  const html = byId['view'].innerHTML;
  if (!html.includes('领取奖励') && !html.includes('去完成')) throw new Error('主线卡异常');
});
t('招募流程', () => {
  Core.S.unlocks.recruit = true;
  const r = Core.recruitOnce('normal');
  if (r.error) throw new Error(r.error);
});
t('队伍页含主角', () => {
  UI._setTab('party');
  const html = byId['view'].innerHTML;
  if (!html.includes('主角')) throw new Error('缺少主角位');
});
t('锁定功能按钮显示', () => {
  UI._setTab('home');
  const html = byId['view'].innerHTML;
  if (!html.includes('🔒')) throw new Error('应有锁定按钮');
});
t('GM 面板函数存在', () => {
  Core.addCur('holy', 100);
  Core.S.unlocks.corridor = true;
  UI._setTab('dungeon');
});
t('战斗播放可启动', () => {
  const eff = Core.effectivePlayerStats();
  const ally = Object.assign({ name: '测试', kind: 'warrior', faction: null, position: 'front', skills: D.PROTAGONIST.skills, skillLv: [1, 1, 1] }, eff, { maxHp: eff.hp });
  const enemy = window.Dungeon.makeEnemies('W01', 'normal', 1, 'combat');
  const res = window.Battle.run({ allies: [ally], enemies: enemy, worldId: 'W01' });
  if (!res.frames.length) throw new Error('无战斗帧');
});

// ---- 面板冒烟：全部新面板都要能渲染出来，且模板里不许出现 undefined ----
function panel(name, fn) {
  t('面板渲染：' + name, () => {
    const w = fn();
    if (w === null || w === undefined) return;   // 允许"没有可扫荡关卡"这类提前返回
    const html = w.innerHTML || '';
    if (html.includes('undefined')) throw new Error('模板出现 undefined');
  });
}
Core.addItem('exp_s', 3);
Core.addItem('box_sr', 2);
Core.addItem('heal_m', 2);
Core.addItem('buff_nerve', 1);
Core.addItem('mat_t2', 5);
Core.stageComplete('W01', 'normal', 0, 3);
panel('背包', () => UI._panels.bagModal());
panel('道具详情-宝箱', () => UI._panels.itemDetail('box_sr'));
panel('道具详情-经验模块', () => UI._panels.itemDetail('exp_s'));
panel('道具详情-强化剂', () => UI._panels.itemDetail('buff_nerve'));
panel('道具详情-材料', () => UI._panels.itemDetail('mat_t2'));
panel('货币图鉴', () => UI._panels.currencyModal('holy'));
panel('玩法指南', () => UI._panels.guideModal());
panel('设置', () => UI._panels.settingsModal());
panel('商店-主神', () => UI._panels.shopModal('god'));
panel('商店-回廊', () => UI._panels.shopModal('corridor'));
panel('任务-主线', () => UI._panels.tasksModal('main'));
panel('任务-日常', () => UI._panels.tasksModal('daily'));
panel('任务-周常', () => UI._panels.tasksModal('weekly'));
panel('任务-成就', () => UI._panels.tasksModal('ach'));
panel('角色图鉴', () => UI._panels.codexModal());
panel('招募', () => UI._panels.recruitModal());
panel('扫荡', () => UI._panels.sweepModal('W01', 'normal'));
panel('转生与天赋', () => UI._panels.reincarnModal());
panel('基因锁', () => UI._panels.geneLockModal());
panel('角色详情（6 装备槽）', () => UI._panels.charDetail('C021'));
const anyEquipUid = Object.keys(Core.S.equips)[0];
if (anyEquipUid) panel('装备详情', () => UI._panels.equipDetail(anyEquipUid));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
