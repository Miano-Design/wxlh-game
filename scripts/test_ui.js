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
t('没解锁的入口收成一行小字（不铺灰格子）', () => {
  UI._setTab('home');
  const html = byId['view'].innerHTML;
  if (!html.includes('还没解锁')) throw new Error('缺未解锁汇总行');
  if (html.includes('data-locked')) throw new Error('首页不该再铺灰格子入口');
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

// ---- 新玩法面板（挂机分工 / 限时悬赏 / 境界渡劫） ----
panel('挂机分工', () => UI._panels.idleLinesModal());
panel('派遣领队-没有可选人', () => UI._panels.pickIdleLeader('cultivate'));
panel('限时悬赏', () => UI._panels.bountyModal());
panel('境界渡劫', () => UI._panels.realmModal());
panel('招募-三池', () => UI._panels.recruitModal());
panel('招募-概率公示', () => UI._panels.recruitRatesModal());
panel('主神权限', () => UI._panels.authorityModal());
Core.addChar('C021');
Core.S.party[1] = 'C021';
Core.addItem('exp_s', 5);
Core.addItem('box_sr', 3);
panel('派遣领队-有人可选', () => UI._panels.pickIdleLeader('gather'));
panel('伴生体兽栏-空', () => UI._panels.beastModal());
Core.addItem('beast_egg', 30);
panel('伴生体兽栏-有兽魂石', () => UI._panels.beastModal());
// V7.2 起养成线（含伴生体）整体搬到「轮回者 → 成长」子页，首页不再摊平所有系统
t('伴生体入口在「轮回者 → 成长」子页', () => {
  const html = UI._panels._screens.growScreen();
  if (html.indexOf('伴生体') < 0) throw new Error('成长页没有伴生体入口');
});
t('首页指向成长子页', () => {
  const html = UI._panels._screens.homeScreen();
  if (html.indexOf('成长') < 0) throw new Error('首页没有指向成长');
});
t('今日卡的悬赏按进度生成（不是写死的名字）', () => {
  const html = UI._panels._screens.homeScreen();
  if (html.indexOf('限时悬赏') < 0) throw new Error('缺悬赏行');
});

// ---- 一级页面全部能渲染，且模板里不许出现 undefined ----
for (const s of ['homeScreen', 'dungeonScreen', 'rosterScreen', 'bagScreen', 'partyScreen', 'charsScreen', 'equipScreen']) {
  t('页面渲染：' + s, () => {
    const html = UI._panels._screens[s]();
    if (typeof html !== 'string' || !html.length) throw new Error('空页面');
    if (html.indexOf('undefined') >= 0) throw new Error('模板出现 undefined');
  });
}
for (const tab of ['bag', 'roster', 'party', 'chars', 'equip', 'home', 'dungeon']) {
  t('一级页签：' + tab, () => {
    UI._setTab(tab);
    const html = byId['view'].innerHTML;
    if (!html || !html.length) throw new Error('空页面');
  });
}
t('旧页签名映射到「轮回者」子页', () => {
  UI._setTab('chars');
  if (UI.tab !== 'roster') throw new Error('chars 没有落到 roster，实际是 ' + UI.tab);
});
t('今日卡含一键收取 / 悬赏 / 免费招募', () => {
  const html = UI._panels._screens.homeScreen();
  ['一键收取', '限时悬赏', '免费招募', '每日任务'].forEach(k => {
    if (html.indexOf(k) < 0) throw new Error('今日卡缺少：' + k);
  });
});
// ---- V8.x：首页改「纯文字」（参考图风格）＋ 新增评级 / 秘术 / 游历 / 血统面板 ----
t('首页不再用大图标卡片（纯文字）', () => {
  const html = UI._panels._screens.homeScreen();
  if (html.indexOf('class="stage"') >= 0) throw new Error('大主视觉块还在');
  if (html.indexOf('stamp-grid') >= 0 || html.indexOf('feat-grid') >= 0) throw new Error('旧宫格还在');
  if (html.indexOf('s-ico') >= 0) throw new Error('入口还在用图标');
});
t('首页入口是纯文字方块菜单', () => {
  const html = UI._panels._screens.homeScreen();
  if (html.indexOf('text-menu') < 0) throw new Error('缺文字菜单');
  if (html.indexOf('tile') < 0) throw new Error('缺文字入口块');
});
t('首页功能入口一屏摊开（今天/养成都能直接找到）', () => {
  const html = UI._panels._screens.homeScreen();
  ['主神评级', '秘术阁', '血统', '境界渡劫', '基地建设', '伴生体', '转生天赋', '游历奇遇'].forEach(k => {
    if (html.indexOf(k) < 0) throw new Error('首页缺入口：' + k);
  });
});
t('首页两枚匾额：主线 + 今日', () => {
  const html = UI._panels._screens.homeScreen();
  if (html.indexOf('plaque-row') < 0) throw new Error('缺匾额排');
  if (html.indexOf('主线') < 0) throw new Error('缺主线');
});
t('首页有游历奇遇条', () => {
  const html = UI._panels._screens.homeScreen();
  if (html.indexOf('游历奇遇') < 0) throw new Error('缺游历条');
});
panel('主神评级', () => UI._panels.sectModal());
panel('秘术阁', () => UI._panels.kejiModal());
panel('游历奇遇', () => UI._panels.travelModal());
panel('血统（未选）', () => UI._panels.bloodlineModal());
panel('血统（已选）', () => {
  Core.S.player.bloodline = null;
  Core.choosePlayerBloodline('血族');
  return UI._panels.bloodlineModal();
});

t('背包卡片带快捷批量按钮', () => {
  const html = UI._panels._screens.bagScreen();
  if (html.indexOf('data-quick') < 0) throw new Error('背包卡没有快捷按钮');
});
t('角色页带排序与搜索', () => {
  const html = UI._panels._screens.charsScreen();
  if (html.indexOf('data-charsort') < 0 || html.indexOf('char-search') < 0) throw new Error('缺排序或搜索');
});
t('悬赏面板写明"过期作废"', () => {
  const html = UI._panels.bountyModal().innerHTML;
  if (html.indexOf('作废') < 0) throw new Error('没写清过期规则');
});


// ---- V7.0 世界观移植：券 / 概率公示 / 主神权限 / 阵型 / 顶部状态区 ----
t('首页顶部是【标签】值 文字行（境界/等级/轮回）', () => {
  const html = UI._panels._screens.homeScreen();
  if (!/境界/.test(html) || !/等级/.test(html) || !/轮回/.test(html)) throw new Error('缺状态行');
  if (!html.includes('text-rows')) throw new Error('缺文字行容器');
});
t('主神权限入口在「轮回者 → 成长」子页', () => {
  const html = UI._panels._screens.growScreen();
  if (!html.includes('主神权限')) throw new Error('缺入口');
});
t('招募页显示券数量与"有券先用券"', () => {
  Core.addItem('ticket_normal', 3);
  const html = UI._panels.recruitModal().innerHTML;
  if (!html.includes('轮回招募券')) throw new Error('没显示券名');
  if (!html.includes('有券先用券')) throw new Error('没说明扣券规则');
});
t('招募页有概率公示入口', () => {
  const html = UI._panels.recruitModal().innerHTML;
  if (!html.includes('概率公示')) throw new Error('缺公示入口');
});
t('概率公示列出每一档出率', () => {
  const html = UI._panels.recruitRatesModal().innerHTML;
  ['普通招募', '高级招募', '限定招募'].forEach(n => { if (!html.includes(n)) throw new Error('缺 ' + n); });
  if (!html.includes('还差')) throw new Error('缺"还差几抽"');
});
t('主神权限面板列出 10 级与当前加成', () => {
  const html = UI._panels.authorityModal().innerHTML;
  if (!/Lv\.[0-9]+ \/ 10/.test(html)) throw new Error('缺等级');
  if (!html.includes('挂机产出')) throw new Error('缺效果说明');
  if (!html.includes('每日扫荡次数')) throw new Error('缺扫荡说明');
});
t('队伍页显示阵型与具名阵列表', () => {
  const html = UI._panels._screens.partyScreen();
  if (!html.includes('阵型')) throw new Error('缺阵型区');
  if (!html.includes('五行归元阵')) throw new Error('缺具名阵');
  if (!html.includes('万能补位')) throw new Error('缺主角补位说明');
});
t('境界面板显示大境 × 小阶（跟着当前血统）', () => {
  const html = UI._panels.realmModal().innerHTML;
  const major = D.BLOODLINES[Core.S.player.bloodline].realms[0];
  if (!html.includes(major)) throw new Error('缺当前血统的大境名：' + major);
  if (!html.includes('大圆满')) throw new Error('缺小阶名');
  if (!html.includes('36')) throw new Error('缺总阶数');
});
t('背包里的招募券有"去招募"快捷键', () => {
  Core.addItem('ticket_adv', 2);
  const html = UI._panels.bagModal().innerHTML;
  if (!html.includes('圣契招募令')) throw new Error('券不在背包里');
  if (!html.includes('去招募')) throw new Error('缺快捷键');
});
t('道具详情-招募券', () => UI._panels.itemDetail('ticket_lim'));

// ---- V8.2：胜利结算自动进下一关（5 秒倒计时） ----
t('倒计时 5 秒', () => { if (UI.AUTO_NEXT_SEC !== 5) throw new Error('不是 5 秒：' + UI.AUTO_NEXT_SEC); });
t('胜利时自动目标＝主按钮（下一关）', () => {
  const acts = [{ label: '↻ 再来一次' }, { label: '› 下一关', primary: true }];
  if (UI._panels.autoNextIndex(true, acts) !== 1) throw new Error('没选中下一关');
});
t('失败时不动（不自动跳）', () => {
  const acts = [{ label: '› 下一关', primary: true }];
  if (UI._panels.autoNextIndex(false, acts) !== -1) throw new Error('失败页不该自动跳');
});
t('没有下一关时不动', () => {
  if (UI._panels.autoNextIndex(true, [{ label: '↻ 再来一次' }]) !== -1) throw new Error('无主按钮时不该自动跳');
});
t('倒计时按钮文案带秒数', () => {
  const html = UI._panels.autoNextBtnHtml('› 下一关（生化蜂巢 5/12）', 5);
  if (!html.includes('下一关')) throw new Error('缺按钮文字');
  if (!html.includes('5s')) throw new Error('缺秒数');
  if (!html.includes('auto-cd')) throw new Error('缺倒计时样式钩子');
});
t('设置里能关掉自动进下一关', () => {
  const html = UI._panels.settingsModal().innerHTML;
  if (!html.includes('通关结算自动进下一关')) throw new Error('缺设置项');
  if (!html.includes('data-toggle="autoNext"')) throw new Error('缺开关');
});
t('新档默认开启自动进下一关', () => { if (Core.S.settings.autoNext !== true) throw new Error('默认没开'); });

// ---- V8.2：药园 / 斗法台 / 法宝三个面板能正常渲染 ----
t('药园面板能渲染', () => {
  const html = UI._panels.gardenModal().innerHTML;
  if (!html.includes('灵田')) throw new Error('缺灵田');
  if (!html.includes('收获') && !html.includes('收')) throw new Error('缺收获入口');
});
t('斗法台面板能渲染', () => {
  const html = UI._panels.arenaModal().innerHTML;
  if (!html.includes('斗法台')) throw new Error('缺标题');
  if (!html.includes('台')) throw new Error('缺台数');
});
t('法宝面板能渲染', () => {
  const html = UI._panels.fabaoModal().innerHTML;
  if (!html.includes('噬魂珠')) throw new Error('缺法宝');
  if (!html.includes('异界结晶')) throw new Error('缺价格说明');
});
t('首页能进药园/斗法台/法宝', () => {
  const html = UI._panels._screens.homeScreen();
  if (!html.includes('open-garden')) throw new Error('缺药园入口');
  if (!html.includes('open-arena')) throw new Error('缺斗法台入口');
  if (!html.includes('open-fabao')) throw new Error('缺法宝入口');
});

// ---- V8.2：坐骑 / 求签两个面板 ----
t('坐骑面板能渲染', () => {
  const html = UI._panels.mountModal().innerHTML;
  if (!html.includes('坐骑')) throw new Error('缺标题');
  if (!html.includes('铁甲蜥')) throw new Error('缺坐骑');
  if (!html.includes('全队')) throw new Error('缺"全队生效"说明');
});
t('求签面板能渲染', () => {
  const html = UI._panels.signModal().innerHTML;
  if (!html.includes('求签')) throw new Error('缺标题');
  if (!html.includes('大吉')) throw new Error('缺签档');
  if (!html.includes('摇')) throw new Error('缺摇签按钮');
});
t('首页能进坐骑/求签', () => {
  const html = UI._panels._screens.homeScreen();
  if (!html.includes('open-mount')) throw new Error('缺坐骑入口');
  if (!html.includes('open-sign')) throw new Error('缺求签入口');
});
t('成长页把新线也列出来了', () => {
  const html = UI._panels._screens.growScreen();
  if (!html.includes('坐骑')) throw new Error('成长页缺坐骑');
  if (!html.includes('求签')) throw new Error('成长页缺求签');
  if (!html.includes('药园')) throw new Error('成长页缺药园');
});
t('玩法指南收录新章节', () => {
  const html = UI._panels.guideModal().innerHTML;
  if (!html.includes('药园')) throw new Error('指南缺药园');
  if (!html.includes('斗法台')) throw new Error('指南缺斗法台');
  if (!html.includes('法宝')) throw new Error('指南缺法宝');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
