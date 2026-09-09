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
t('招募流程', () => {
  Core.S.unlocks.recruit = true;
  const r = Core.recruitOnce('normal');
  if (r.error) throw new Error(r.error);
});
t('主线任务卡在首页出现领取', () => {
  Core.S.chars['C001'].lv = 6;
  UI._setTab('home');
  const html = byId['view'].innerHTML;
  if (!html.includes('领取奖励') && !html.includes('去完成')) throw new Error('主线卡异常');
});
t('锁定功能按钮显示', () => {
  const html = byId['view'].innerHTML;
  if (!html.includes('🔒')) throw new Error('应有锁定按钮');
});
t('GM 面板函数存在', () => {
  Core.addCur('holy', 100);
  Core.S.unlocks.corridor = true;
  UI._setTab('dungeon');
});
t('战斗播放可启动', () => {
  const base = D.charById['C001'];
  const eff = Core.effectiveStats('C001');
  const ally = Object.assign({ name: '测试', kind: base.kind, faction: base.faction, position: 'front', skills: base.skills, skillLv: [1, 1, 1] }, eff, { maxHp: eff.hp });
  const enemy = window.Dungeon.makeEnemies('W01', 'normal', 1, 'combat');
  const res = window.Battle.run({ allies: [ally], enemies: enemy, worldId: 'W01' });
  if (!res.frames.length) throw new Error('无战斗帧');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
