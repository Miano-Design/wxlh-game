/* 《无限轮回》UI 层 */
window.UI = (function () {
  const D = window.DATA;
  const C = () => window.Core;
  const $view = () => document.getElementById('view');

  /* ================= 工具 ================= */
  function fmt(n) {
    n = Math.floor(n || 0);
    if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿';
    if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
    return String(n);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }
  function stars(n, max) { return '★'.repeat(n) + '<span style="opacity:.25">' + '★'.repeat(Math.max(0, (max || 6) - n)) + '</span>'; }
  function rarityTag(r) { return `<span class="rtext-${r}" style="font-weight:700">${r}</span>`; }
  function cname(id) { return C().charName(id); }
  function charAvatar(id, size) {
    if (id === '@player') {
      const nm = cname(id);
      return `<div class="avatar" style="border-color:var(--gold);color:var(--gold);${size ? `width:${size}px;height:${size}px;font-size:${size * 0.44}px;` : ''}">${esc(nm[0])}</div>`;
    }
    const ch = D.charById[id];
    const nm = cname(id);
    return `<div class="avatar" style="border-color:${D.RARITY_COLOR[ch.rarity]};color:${D.RARITY_COLOR[ch.rarity]};${size ? `width:${size}px;height:${size}px;font-size:${size * 0.44}px;` : ''}">${esc(nm[0])}</div>`;
  }
  function curIcon(id) { const c = D.CURRENCIES.find(x => x.id === id); return c ? `<span style="color:${c.color}">${c.icon}</span>` : ''; }
  function curName(id) { const c = D.CURRENCIES.find(x => x.id === id); return c ? c.name : id; }

  function toast(msg, ms) {
    const root = document.getElementById('toast-root');
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, ms || 1800);
  }

  /* ================= 弹窗 ================= */
  let modalStack = [];
  function modal(title, bodyHtml, opts) {
    opts = opts || {};
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-mask"></div>
      <div class="sheet ${opts.center ? 'center' : ''}">
        <div class="sheet-head"><h3>${title}</h3><button class="close-x">✕</button></div>
        <div class="sheet-body">${bodyHtml}</div>
      </div>`;
    root.appendChild(wrap);
    modalStack.push(wrap);
    wrap.querySelector('.close-x').onclick = () => closeModal(wrap);
    wrap.querySelector('.modal-mask').onclick = () => { if (!opts.sticky) closeModal(wrap); };
    return wrap;
  }
  function closeModal(wrap) {
    wrap = wrap || modalStack[modalStack.length - 1];
    if (!wrap) return;
    modalStack = modalStack.filter(w => w !== wrap);
    wrap.remove();
  }
  function closeAllModals() { modalStack.forEach(w => w.remove()); modalStack = []; }
  function confirmBox(title, text, onOk) {
    const w = modal(title, `
      <div style="color:var(--dim);font-size:13px;line-height:1.7;margin-bottom:14px">${text}</div>
      <div class="btn-row"><button class="btn ghost" data-x>取消</button><button class="btn primary" data-ok>确定</button></div>
    `, { center: true });
    w.querySelector('[data-x]').onclick = () => closeModal(w);
    w.querySelector('[data-ok]').onclick = () => { closeModal(w); onOk(); };
  }

  /* ================= 顶栏 / 导航 ================= */
  const TABS = [
    { id: 'home', name: '主神空间', ico: '⛩' },
    { id: 'dungeon', name: '轮回副本', ico: '🌀' },
    { id: 'party', name: '队伍', ico: '⚔️' },
    { id: 'chars', name: '角色', ico: '👥' },
    { id: 'equip', name: '装备', ico: '🎒' },
  ];
  let curTab = 'home';
  function renderTopbar() {
    const S = C().S;
    document.getElementById('tb-name').textContent = S.player.name;
    document.getElementById('tb-lv').textContent = 'Lv.' + S.player.level;
    document.getElementById('tb-gene').textContent = S.player.geneLock > 0 ? `基因锁·${D.GENE_LOCKS[S.player.geneLock - 1].name}` : '';
    const bar = document.getElementById('curbar');
    bar.innerHTML = D.CURRENCIES.map(c => `<div class="cur-chip"><span style="color:${c.color}">${c.icon}</span><b>${fmt(S.cur[c.id])}</b></div>`).join('');
  }
  function renderNavbar() {
    const nav = document.getElementById('navbar');
    nav.innerHTML = TABS.map(t => `<div class="nav-item ${curTab === t.id ? 'active' : ''}" data-tab="${t.id}"><span class="ico">${t.ico}</span>${t.name}${t.id === 'home' && idleClaimable() ? '<span class="dot"></span>' : ''}</div>`).join('');
    nav.querySelectorAll('.nav-item').forEach(el => { el.onclick = () => setTab(el.dataset.tab); });
  }
  function idleClaimable() {
    const g = C().idleBankGains();
    return g.seconds >= 300;
  }
  function refresh() { renderTopbar(); renderNavbar(); }
  function setTab(id) {
    curTab = id;
    dungeonView = { page: 'worlds' };
    refresh();
    render();
  }
  function render() {
    const fn = { home: homeScreen, dungeon: dungeonScreen, party: partyScreen, chars: charsScreen, equip: equipScreen }[curTab];
    $view().innerHTML = `<div class="screen">${fn()}</div>`;
    bindScreen();
    refresh();
  }

  /* ================= 主神空间 ================= */
  function homeScreen() {
    const S = C().S;
    const r = C().idleRates();
    const bank = C().idleBankGains();
    const expNeed = D.EXP_TABLE[S.player.level] || 1;
    const gl = D.GENE_LOCKS[S.player.geneLock - 1];
    return `
    <div class="card" data-protag="1" style="cursor:pointer">
      <h3>⛩ 个人房间 <span class="sub">${cname('@player')} · 主角战力 ${fmt(C().playerPower())} · 队伍 ${fmt(C().teamPower())} ›</span></h3>
      <div class="kv"><span class="k">玩家经验</span><span>${fmt(S.player.exp)} / ${fmt(expNeed)}</span></div>
      <div class="bar exp" style="margin:6px 0 10px"><i style="width:${Math.min(100, S.player.exp / expNeed * 100)}%"></i></div>
      <div class="kv"><span class="k">基因锁</span><span>${gl ? `${S.player.geneLock}阶·${gl.name}` : '未解锁'}</span></div>
      <div class="kv"><span class="k">转生次数</span><span>${S.player.reincarnations}</span></div>
    </div>
    <div class="card">
      <h3>⏳ 轮回挂机 <span class="sub">${r.pointsPerMin.toFixed(1)} 点/分 · ${r.expPerMin.toFixed(1)} EXP/分</span></h3>
      <div class="kv"><span class="k">已累积</span><span id="idle-time">${formatDuration(bank.seconds)}</span></div>
      <div class="kv"><span class="k">待领取</span><span id="idle-gains">◈${fmt(bank.points)} · EXP ${fmt(bank.exp)}${bank.otherworld ? ` · ◆${bank.otherworld}` : ''}${bank.story ? ` · ❖${bank.story}` : ''}</span></div>
      <div class="kv"><span class="k">离线规则</span><span>效率 ${Math.round(C().offlineEfficiency() * 100)}% · 上限 ${C().offlineCapHours().toFixed(1)}小时</span></div>
      <button class="btn primary block" style="margin-top:10px" id="idle-claim-btn" data-act="claim-idle" ${bank.seconds < 60 ? 'disabled' : ''}>一键领取挂机收益</button>
    </div>
    ${questCard()}
    <div class="grid2">
      ${featureBtn('open-recruit', '✦ 轮回者招募', 'recruit')}
      ${featureBtn('open-shop', '🏪 兑换大厅', 'shop')}
      ${featureBtn('open-buildings', '🏗 基地建设', 'buildings')}
      ${featureBtn('open-tasks', '📋 任务', 'tasks')}
      ${featureBtn('open-genelock', '🧬 基因锁', 'geneLock')}
      ${featureBtn('open-reincarn', '♾ 转生', 'reincarn')}
      <button class="btn" data-act="open-bag">🧰 道具背包</button>
      <button class="btn" data-act="open-settings">⚙️ 设置存档</button>
    </div>`;
  }
  function featureBtn(act, label, unlockId) {
    if (C().isUnlocked(unlockId)) return `<button class="btn" data-act="${act}">${label}</button>`;
    return `<button class="btn" data-locked="${unlockId}" style="opacity:.5">🔒 ${label.replace(/^[^ ]+ /, '')}</button>`;
  }
  function questCard() {
    const cur = C().currentQuest();
    if (!cur) {
      return `<div class="card"><h3>📜 主线任务 <span class="sub">全部完成</span></h3>
        <div style="font-size:12px;color:var(--dim)">你已走完当前全部主线。继续挑战更高难度的世界与无限回廊吧。</div></div>`;
    }
    const q = cur.q;
    const rewardText = Object.entries(q.reward).filter(([, v]) => v > 0).map(([k, v]) => `${curIcon(k)}${v}`).join(' ');
    return `<div class="card" style="border-color:#ffd76a55">
      <h3>📜 主线 · ${q.name} <span class="sub">${rewardText}</span></h3>
      <div style="font-size:13px;color:var(--dim);margin-bottom:8px">${q.desc}</div>
      <div class="btn-row">
        ${cur.done ? '<button class="btn primary" data-act="claim-quest">领取奖励</button>' : '<button class="btn ghost" data-act="goto-quest">去完成 ›</button>'}
      </div>
    </div>`;
  }
  function formatDuration(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    if (h) return `${h}小时${m}分`;
    if (m) return `${m}分${s}秒`;
    return `${s}秒`;
  }

  /* ================= 轮回副本 ================= */
  const WORLD_ICONS = { bio: '🧟', ghost: '👻', mystic: '🏺', tech: '🛰', god: '👁' };
  let dungeonView = { page: 'worlds' };
  let run = null;   // 进行中的关卡

  function dungeonScreen() {
    if (dungeonView.page === 'world') return worldDetail();
    if (dungeonView.page === 'run') return runScreen();
    if (dungeonView.page === 'corridor') return corridorScreen();
    return worldsList();
  }
  function worldsList() {
    const S = C().S;
    const corridorLocked = !C().isUnlocked('corridor');
    const corridor = `
      <div class="card world-card ${corridorLocked ? 'locked' : ''}" data-act="open-corridor" style="cursor:pointer;border-color:#8be9e955;${corridorLocked ? 'opacity:.55' : ''}">
        <div class="world-ico">♾</div>
        <div class="grow">
          <div class="t1">无限回廊 <span class="tag">终局挑战</span></div>
          <div class="t2">${corridorLocked ? '🔒 ' + C().unlockTip('corridor') : `当前第 ${S.corridor.floor} 层 · 历史最高 ${S.corridor.best} 层`}</div>
        </div>
        <span style="color:var(--dim)">›</span>
      </div>`;
    const worlds = D.WORLDS.map((w, i) => {
      const st = S.worlds[w.id];
      const unlocked = st && st.unlocked;
      const cleared = unlocked && st.stages.normal.every(s => s > 0);
      const prog = unlocked ? st.stages.normal.filter(s => s > 0).length : 0;
      return `
      <div class="card world-card" data-world="${w.id}" style="cursor:pointer;${unlocked ? '' : 'opacity:.45'}">
        <div class="world-ico">${WORLD_ICONS[w.theme]}</div>
        <div class="grow">
          <div class="t1">${w.name} ${cleared ? '<span class="tag" style="color:var(--green);border-color:#2f5b41">已通关</span>' : ''}</div>
          <div class="t2">${unlocked ? `进度 ${prog}/12 · ${w.mechanic.split('：')[0]}` : '🔒 通关上一世界解锁'}</div>
        </div>
        <span style="color:var(--dim)">›</span>
      </div>`;
    }).join('');
    return `<div class="section-title">无限挑战</div>${corridor}<div class="section-title">恐怖世界（14）</div>${worlds}`;
  }
  function worldDetail() {
    const S = C().S;
    const w = D.WORLDS.find(x => x.id === dungeonView.worldId);
    const diff = dungeonView.diff || 'normal';
    const st = S.worlds[w.id];
    const diffName = { normal: '普通', hard: '困难', hell: '地狱' };
    const cells = Array.from({ length: 12 }, (_, i) => {
      const unlocked = C().stageUnlocked(w.id, diff, i);
      const starsGot = st ? st.stages[diff][i] : 0;
      const isBoss = i === 11;
      return `<div class="stage-cell ${unlocked ? '' : 'locked'} ${starsGot ? 'done' : ''} ${isBoss ? 'boss' : ''}" data-stage="${i}">
        ${isBoss ? '👹' : i + 1}<span class="st">${starsGot ? '★'.repeat(starsGot) : ''}</span>
      </div>`;
    }).join('');
    const canSweep = st && st.stages[diff].some(s => s > 0);
    return `
      <button class="btn ghost small" data-act="back-worlds" style="margin-bottom:10px">‹ 返回世界列表</button>
      <div class="card">
        <h3>${WORLD_ICONS[w.theme]} ${w.name}</h3>
        <div style="font-size:12px;color:var(--dim);line-height:1.6">${w.desc}</div>
        <div class="kv" style="margin-top:8px"><span class="k">世界机制</span><span style="color:var(--accent)">${w.mechanic}</span></div>
        <div class="kv"><span class="k">守关Boss</span><span>${w.boss}</span></div>
      </div>
      <div class="diff-tabs">
        ${D.DIFFICULTY.map(d => `<button class="btn small ${diff === d.id ? 'active' : ''}" data-diff="${d.id}" ${d.id !== 'normal' && !C().worldCleared(w.id, d.id === 'hard' ? 'normal' : 'hard') ? 'disabled' : ''}>${d.name}${d.id !== 'normal' ? ` ×${d.mult}` : ''}</button>`).join('')}
      </div>
      <div class="stage-grid">${cells}</div>
      ${canSweep ? `<button class="btn block" style="margin-top:12px" data-act="sweep">⏩ 扫荡最新关 ×10</button>` : ''}
    `;
  }

  /* ---------- 关卡探索 ---------- */
  function startRun(worldId, diff, stageIdx) {
    const S = C().S;
    // 主角必上阵，无需检查
    const stage = stageIdx + 1;
    const route = window.Dungeon.genRoute(worldId, stage);
    run = {
      worldId, diff, stage, stageIdx, route,
      step: 0,
      hpPct: {},        // charId → 0~1
      buffs: {},
      kills: 0,
    };
    run.hpPct['@player'] = 1;
    S.party.filter(Boolean).forEach(id => { run.hpPct[id] = 1; });
    dungeonView = { page: 'run' };
    render();
  }
  const NODE_META = {
    combat: { ico: '⚔️', name: '遭遇战' },
    elite: { ico: '💀', name: '精英伏击' },
    event: { ico: '❓', name: '随机事件' },
    chest: { ico: '🎁', name: '补给宝箱' },
    heal: { ico: '⛺', name: '安全屋' },
  };
  function runScreen() {
    if (!run) return worldsList();
    const w = D.WORLDS.find(x => x.id === run.worldId);
    const totalSteps = run.route.steps.length + 1;
    const prog = Array.from({ length: totalSteps }, (_, i) => `<i class="${i < run.step ? 'done' : ''}"></i>`).join('');
    const partyHp = ['@player', ...C().S.party.filter(Boolean)].map(id => {
      const pct = run.hpPct[id] !== undefined ? run.hpPct[id] : 1;
      return `<div style="flex:1"><div style="font-size:10px;color:var(--dim);text-align:center">${cname(id)}</div><div class="bar hp ${pct < 0.35 ? 'low' : ''}"><i style="width:${pct * 100}%"></i></div></div>`;
    }).join('');
    const potions = ['heal_s', 'heal_m', 'heal_l'].filter(id => (C().S.items[id] || 0) > 0);
    const potionBar = potions.length ? `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
      ${potions.map(id => `<button class="btn small" data-potion="${id}">🧪 ${D.ITEMS[id].name} ×${C().S.items[id]}</button>`).join('')}
    </div>` : '';
    // 路线图全览
    const mapHtml = `<div class="card" style="padding:10px 14px"><div style="display:flex;align-items:center;gap:4px;overflow-x:auto">
      ${run.route.steps.map((opts, i) => `
        <div style="display:flex;flex-direction:column;gap:3px;flex:0 0 auto">
          ${opts.map(t => `<span style="font-size:${i === run.step ? '17px' : '13px'};opacity:${i < run.step ? '.3' : i === run.step ? '1' : '.55'};filter:${i === run.step ? 'drop-shadow(0 0 4px #d43a4f)' : 'none'}" title="${NODE_META[t].name}">${NODE_META[t].ico}</span>`).join('')}
        </div>
        <span style="color:var(--line);flex:0 0 auto">›</span>`).join('')}
      <span style="font-size:17px;flex:0 0 auto;${run.step >= run.route.steps.length ? 'filter:drop-shadow(0 0 6px #d43a4f)' : 'opacity:.55'}">${run.route.finalKind === 'boss' ? '👹' : '⚔️'}</span>
    </div></div>`;
    let body = '';
    if (run.step < run.route.steps.length) {
      const opts = run.route.steps[run.step];
      body = `
        <div class="section-title">选择前进路线（第 ${run.step + 1}/${totalSteps} 段）</div>
        <div class="route-step">
          ${opts.map(t => `<div class="route-node ${t}" data-node="${t}"><div class="nico">${NODE_META[t].ico}</div><div class="nname">${NODE_META[t].name}</div></div>`).join('')}
        </div>`;
    } else {
      const isBoss = run.route.finalKind === 'boss';
      body = `
        <div class="section-title">最终区域</div>
        <div class="route-step"><div class="route-node elite" data-final="1" style="border-color:var(--accent)">
          <div class="nico">${isBoss ? '👹' : '⚔️'}</div><div class="nname">${isBoss ? w.boss : '区域决战'}</div>
        </div></div>`;
    }
    return `
      <button class="btn ghost small" data-act="abandon-run" style="margin-bottom:8px">‹ 放弃本次探索</button>
      <div class="card">
        <h3>${WORLD_ICONS[w.theme]} ${w.name} · ${{ normal: '普通', hard: '困难', hell: '地狱' }[run.diff]} ${run.stage}/12</h3>
        <div class="route-progress">${prog}</div>
        <div style="display:flex;gap:6px">${partyHp}</div>
        ${potionBar}
        ${Object.keys(run.buffs).length ? `<div style="margin-top:8px;font-size:11px;color:var(--green)">探索增益：${Object.entries(run.buffs).map(([k, v]) => `攻击+${Math.round(v * 100)}%`).join(' ')}</div>` : ''}
      </div>
      ${mapHtml}
      ${body}`;
  }

  /* ---------- 战前侦查 ---------- */
  function enemyPower(e) { return Math.round(e.atk * 2 + e.def + e.hp * 0.2 + (e.spd || 60) * 3); }
  function battlePreview(enemies, title, onConfirm) {
    const allies = buildAllies(run ? run.hpPct : null, run ? run.buffs : null);
    const myPower = allies.reduce((s, a) => s + Math.round(a.atk * 2 + a.def + a.maxHp * 0.2 + a.spd * 3), 0);
    const foePower = enemies.reduce((s, e) => s + enemyPower(e), 0);
    const ratio = myPower / Math.max(1, foePower);
    const verdict = ratio >= 1.4 ? ['十拿九稳', 'var(--green)'] : ratio >= 0.9 ? ['势均力敌', 'var(--gold)'] : ['凶多吉少', 'var(--accent)'];
    const w = modal(title, `
      <div class="kv"><span class="k">我方战力</span><span>${fmt(myPower)}</span></div>
      <div class="kv"><span class="k">敌方战力</span><span>${fmt(foePower)}</span></div>
      <div class="kv"><span class="k">胜率预估</span><span style="color:${verdict[1]};font-weight:700">${verdict[0]}</span></div>
      <div class="section-title">敌方情报</div>
      ${enemies.map(e => `<div class="list-row">
        <div class="grow"><div class="t1">${e.isBoss ? '👹 ' : ''}${esc(e.name)}</div>
        <div class="t2">HP ${fmt(e.hp)} · 攻 ${fmt(e.atk)} · 防 ${fmt(e.def)}${e.faction ? ` · ${e.faction}` : ''}</div></div>
      </div>`).join('')}
      <div class="btn-row" style="margin-top:12px">
        <button class="btn ghost" data-cancel>再想想</button>
        <button class="btn primary" data-fight>⚔️ 出战</button>
      </div>
    `, { center: true });
    w.querySelector('[data-cancel]').onclick = () => closeModal(w);
    w.querySelector('[data-fight]').onclick = () => { closeModal(w); onConfirm(); };
  }

  /* ---------- 无限回廊 ---------- */
  function corridorScreen() {
    const S = C().S;
    const e = D.corridorEnemy(S.corridor.floor);
    const rw = D.corridorReward(S.corridor.floor);
    return `
      <button class="btn ghost small" data-act="back-worlds" style="margin-bottom:8px">‹ 返回</button>
      <div class="corridor-hero">
        <div style="font-size:12px;color:var(--dim)">无限回廊</div>
        <div class="floor-num">${S.corridor.floor}</div>
        <div style="font-size:12px;color:var(--dim)">历史最高 ${S.corridor.best} 层</div>
      </div>
      <div class="card">
        <h3>本层守卫</h3>
        <div class="kv"><span class="k">${e.name}</span><span>${e.isBoss ? '👹 Boss' : e.isElite ? '精英' : '普通'}</span></div>
        <div class="kv"><span class="k">HP</span><span>${fmt(e.hp)}</span></div>
        <div class="kv"><span class="k">通关奖励</span><span>◈${rw.points} · ❖${rw.story} · ♜${rw.corridor}${rw.bloodCrystal ? ` · ❥${rw.bloodCrystal}` : ''}</span></div>
      </div>
      <button class="btn primary block" data-act="fight-corridor">⚔️ 挑战本层</button>
      <button class="btn block" style="margin-top:8px" data-act="open-corridor-shop">🏪 回廊商店（♜${fmt(S.cur.corridor)}）</button>
    `;
  }

  /* ================= 队伍 ================= */
  function partyScreen() {
    const S = C().S;
    const fb = C().factionBuffs(S.party);
    const pst = C().effectivePlayerStats();
    const protag = `
      <div class="pslot filled" data-protag="1" style="border-color:var(--gold);cursor:pointer">
        <span class="pos-tag">主角 · 前排</span>
        ${charAvatar('@player', 40)}
        <div class="pname">${cname('@player')}</div>
        <div class="pmeta">Lv.${S.player.level} · 战力${fmt(C().playerPower())}</div>
      </div>`;
    const slots = S.party.map((id, i) => {
      const pos = i < 2 ? '前排' : '后排';
      if (!id) return `<div class="pslot" data-slot="${i}"><span class="pos-tag">${pos}</span><div style="text-align:center;color:var(--dim);padding-top:34px;font-size:12px">＋ 上阵</div></div>`;
      const ch = D.charById[id];
      const c = S.chars[id];
      return `<div class="pslot filled rarity-${ch.rarity}" data-slot="${i}">
        <span class="pos-tag">${pos}</span>
        ${charAvatar(id, 40)}
        <div class="pname">${cname(id)}</div>
        <div class="pmeta">Lv.${c.lv} · ${ch.role} · ${ch.faction}</div>
      </div>`;
    }).join('');
    const fbText = [];
    if (fb.atkPct) fbText.push(`攻击+${Math.round(fb.atkPct * 100)}%`);
    if (fb.hpPct) fbText.push(`生命+${Math.round(fb.hpPct * 100)}%`);
    if (fb.skillPct) fbText.push(`技能+${Math.round(fb.skillPct * 100)}%`);
    const fbCount = Object.entries(fb.count).map(([f, n]) => `${f}×${n}`).join(' ');
    return `
      <div class="card">
        <h3>⚔️ 轮回小队 <span class="sub">总战力 ${fmt(C().teamPower())}（主角必上阵）</span></h3>
        <div style="margin-bottom:10px">${protag}</div>
        <div class="party-slots">${slots}</div>
        <div style="margin-top:10px;font-size:11px;color:var(--dim)">主角（你）永远参战 · 前排受击概率更高 · 后排相对安全</div>
      </div>
      <div class="card">
        <h3>🔗 阵营羁绊</h3>
        <div class="kv"><span class="k">当前构成</span><span>${fbCount || '—'}</span></div>
        <div class="kv"><span class="k">已激活</span><span style="color:var(--green)">${fbText.join(' · ') || '无'}</span></div>
        <div style="margin-top:8px;font-size:11px;color:var(--dim)">同阵营 2人:攻击+3% · 3人:攻击/生命+6% · 4人:攻击/生命+10%、技能+5%</div>
        <div style="font-size:11px;color:var(--dim);margin-top:4px">克制环：先锋→策略→科技→异能→先锋（克制伤害+15%）</div>
      </div>
      <div class="card">
        <h3>成员一览</h3>
        ${S.party.filter(Boolean).map(id => {
          const ch = D.charById[id];
          const c = S.chars[id];
          const st = C().effectiveStats(id);
          return `<div class="list-row" data-char="${id}" style="cursor:pointer">
            ${charAvatar(id, 40)}
            <div class="grow"><div class="t1">${cname(id)} <span class="stars">${stars(c.star, D.RARITY_MAXSTAR[ch.rarity])}</span></div>
            <div class="t2">攻${fmt(st.atk)} · 防${fmt(st.def)} · 血${fmt(st.hp)} · 速${fmt(st.spd)}</div></div>
            <button class="btn small ghost" data-remove="${id}">下阵</button>
          </div>`;
        }).join('') || '<div class="empty">尚未上阵任何角色</div>'}
      </div>`;
  }
  /* ================= 主角详情 ================= */
  function protagonistDetail() {
    const S = C().S;
    const P = D.PROTAGONIST;
    const st = C().effectivePlayerStats();
    const eq = S.equipped['@player'] || {};
    const gl = S.player.geneLock;
    const blCost = S.player.bloodline && S.player.bloodlineLv < D.BLOODLINE_MAX ? D.bloodlineCost(S.player.bloodlineLv) : null;
    const w = modal(`${cname('@player')}（主角）`, `
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">
        ${charAvatar('@player', 56)}
        <div>
          <div><b style="font-size:16px">${cname('@player')}</b> <span class="tag" style="color:var(--gold);border-color:var(--gold)">轮回者本人</span></div>
          <div style="font-size:11px;color:var(--dim);margin-top:3px">Lv.${S.player.level}（玩家等级）· 战力 ${fmt(C().playerPower())}</div>
          <div style="font-size:11px;color:var(--dim)">基因锁 ${gl > 0 ? D.GENE_LOCKS[gl - 1].name : '未解锁'} · ${S.player.bloodline ? S.player.bloodline + '血统 Lv.' + S.player.bloodlineLv : '未选择血统'}</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--dim);margin-bottom:10px">主角与招募角色成长体系独立：随玩家等级成长、无星级碎片、6 装备槽、血统自选、基因锁每阶全属性额外+3%</div>
      <div class="stat-6">
        <div class="cell"><div class="v">${fmt(st.atk)}</div><div class="k">攻击</div></div>
        <div class="cell"><div class="v">${fmt(st.def)}</div><div class="k">防御</div></div>
        <div class="cell"><div class="v">${fmt(st.hp)}</div><div class="k">生命</div></div>
        <div class="cell"><div class="v">${fmt(st.spd)}</div><div class="k">速度</div></div>
        <div class="cell"><div class="v">${Math.round(st.crit * 100)}%</div><div class="k">暴击</div></div>
        <div class="cell"><div class="v">${Math.round(st.eva * 100)}%</div><div class="k">闪避</div></div>
      </div>
      <div class="section-title">技能（基因锁强化）</div>
      ${[P.skills.s1, P.skills.s2, P.skills.ult].map((sk, i) => `
        <div class="skill-row"><div class="sname">${['技能', '技能', '必杀'][i]}·${sk.name} <span class="tag">Lv.${Math.min(10, 1 + gl * 2)}</span></div>
        <div class="sdesc">${sk.desc}（基因锁每阶 +2 级效果）</div></div>`).join('')}
      <div class="skill-row"><div class="sname">被动·${P.skills.passive.name}</div><div class="sdesc">${P.skills.passive.desc}</div></div>
      <div class="section-title">血统</div>
      ${S.player.bloodline ? `
        <div style="font-size:12px;margin-bottom:6px">${S.player.bloodline} Lv.${S.player.bloodlineLv}/${D.BLOODLINE_MAX} <span style="color:var(--dim);font-size:11px">${D.BLOODLINES[S.player.bloodline].desc}</span></div>
        ${blCost ? `<button class="btn small" data-pblup="1">血统升级（❥${blCost.bloodCrystal} + ◈${fmt(blCost.points)}）</button>` : '<div style="color:var(--gold);font-size:12px">已满级</div>'}
      ` : `
        <div style="font-size:11px;color:var(--dim);margin-bottom:8px">选择一种血统觉醒（不可更改）</div>
        <div class="grid2">${Object.entries(D.BLOODLINES).map(([id, bl]) => `<button class="btn small" data-pbl="${id}">${id}<br><span style="font-size:10px;font-weight:400;color:var(--dim)">${bl.desc.split('。')[0]}</span></button>`).join('')}</div>
      `}
      <div class="section-title">装备（主角专属 6 槽）</div>
      ${D.PLAYER_SLOTS.map(slot => {
        const uid = eq[slot];
        const e = uid && S.equips[uid];
        return `<div class="list-row" data-peqslot="${slot}" style="cursor:pointer">
          <span class="tag">${D.EQUIP_SLOTS[slot]}</span>
          <div class="grow">${e ? `<div class="t1 rtext-${e.rarity}">${e.name} +${e.enhance}</div><div class="t2">${equipBrief(e)}</div>` : '<div class="t2">未装备</div>'}</div>
          ${e ? `<button class="btn small ghost" data-punequip="${slot}">卸下</button>` : ''}
        </div>`;
      }).join('')}
      <div class="btn-row" style="margin-top:12px"><button class="btn small ghost" data-rename="1">✏️ 修改名字</button></div>
    `);
    const blBtn = w.querySelector('[data-pblup]');
    if (blBtn) blBtn.onclick = () => {
      if (!C().isUnlocked('bloodline')) { toast('🔒 ' + C().unlockTip('bloodline')); return; }
      const r = C().upgradePlayerBloodline();
      toast(r.msg);
      closeModal(w); if (r.ok) protagonistDetail();
      renderTopbar();
    };
    w.querySelectorAll('[data-pbl]').forEach(b => b.onclick = () => {
      if (!C().isUnlocked('bloodline')) { toast('🔒 ' + C().unlockTip('bloodline')); return; }
      const r = C().choosePlayerBloodline(b.dataset.pbl);
      toast(r.msg, 2200);
      closeModal(w); if (r.ok) protagonistDetail();
    });
    w.querySelectorAll('[data-peqslot]').forEach(el => el.onclick = () => { closeModal(w); pickEquipFor('@player', el.dataset.peqslot, () => protagonistDetail()); });
    w.querySelectorAll('[data-punequip]').forEach(b => b.onclick = ev => {
      ev.stopPropagation();
      C().unequipItem('@player', b.dataset.punequip);
      closeModal(w); protagonistDetail();
    });
    w.querySelector('[data-rename]').onclick = () => {
      closeModal(w);
      const rw = modal('修改名字', `
        <input id="rn-input" maxlength="12" value="${esc(S.player.name)}" style="width:100%;background:var(--panel);border:1px solid var(--line);border-radius:10px;color:var(--text);padding:12px;font-size:15px;outline:none;margin-bottom:12px" />
        <button class="btn primary block" data-ok>确认修改</button>`, { center: true });
      rw.querySelector('[data-ok]').onclick = () => {
        if (C().setPlayerName(rw.querySelector('#rn-input').value)) {
          toast('名字已修改');
          closeModal(rw);
          protagonistDetail(); refresh();
        } else toast('名字不能为空');
      };
    };
  }
  function pickPartyChar(slotIdx) {
    const S = C().S;
    const owned = Object.keys(S.chars);
    const w = modal('选择上阵角色', owned.map(id => {
      const ch = D.charById[id];
      const c = S.chars[id];
      const inParty = S.party.includes(id);
      return `<div class="list-row" data-pick="${id}" style="cursor:pointer;${inParty ? 'opacity:.4' : ''}">
        ${charAvatar(id, 40)}
        <div class="grow"><div class="t1">${rarityTag(ch.rarity)} ${cname(id)}</div><div class="t2">Lv.${c.lv} · ${ch.role} · ${ch.faction} · 战力${fmt(C().power(id))}</div></div>
        ${inParty ? '<span class="tag">已上阵</span>' : ''}
      </div>`;
    }).join('') || '<div class="empty">还没有角色，去招募吧</div>');
    w.querySelectorAll('[data-pick]').forEach(el => {
      el.onclick = () => {
        const id = el.dataset.pick;
        if (S.party.includes(id)) return;
        const old = S.party[slotIdx];
        S.party[slotIdx] = id;
        C().save();
        closeModal(w);
        render();
        toast(`${D.charById[id].name} 已上阵`);
      };
    });
  }

  /* ================= 角色 ================= */
  let charFilter = 'all';
  function charsScreen() {
    const S = C().S;
    const owned = Object.keys(S.chars);
    const filters = [['all', '全部'], ['party', '已上阵'], ['SSR', 'SSR+'], ['N', 'N'], ['R', 'R'], ['SR', 'SR']];
    let list = owned.slice().sort((a, b) => D.RARITIES.indexOf(D.charById[b].rarity) - D.RARITIES.indexOf(D.charById[a].rarity) || C().power(b) - C().power(a));
    if (charFilter === 'party') list = list.filter(id => S.party.includes(id));
    else if (charFilter === 'SSR') list = list.filter(id => ['SSR', 'UR'].includes(D.charById[id].rarity));
    else if (charFilter !== 'all') list = list.filter(id => D.charById[id].rarity === charFilter);
    const cards = list.map(id => {
      const ch = D.charById[id];
      const c = S.chars[id];
      return `<div class="char-card rarity-${ch.rarity}" data-char="${id}">
        ${S.party.includes(id) ? '<span class="inparty">上阵</span>' : ''}
        ${charAvatar(id)}
        <div class="cname">${cname(id)}</div>
        <div class="stars">${stars(c.star, D.RARITY_MAXSTAR[ch.rarity])}</div>
        <div class="cmeta">Lv.${c.lv} · ${ch.role}</div>
      </div>`;
    }).join('');
    return `
      <div class="pill-tabs">${filters.map(([k, n]) => `<div class="pill ${charFilter === k ? 'active' : ''}" data-filter="${k}">${n}</div>`).join('')}</div>
      <div style="font-size:11px;color:var(--dim);margin:2px 2px 8px">已收集 ${S.codex.chars.length}/${D.characters.length} · 拥有 ${owned.length}</div>
      <div class="char-grid">${cards || '<div class="empty" style="grid-column:1/-1">该分类下暂无角色</div>'}</div>`;
  }
  function charDetail(id) {
    const S = C().S;
    const ch = D.charById[id];
    const c = S.chars[id];
    const st = C().effectiveStats(id);
    const cost = C().levelCost(id);
    const starCost = D.STAR_COST[c.star];
    const maxStar = D.RARITY_MAXSTAR[ch.rarity];
    const bl = D.BLOODLINES[ch.bloodline];
    const blCost = c.bloodlineLv < D.BLOODLINE_MAX ? D.bloodlineCost(c.bloodlineLv) : null;
    const skills = [ch.skills.s1, ch.skills.s2, ch.skills.ult];
    const skillNames = ['技能1', '技能2', '必杀技'];
    const expItems = Object.entries(S.items).filter(([k]) => D.ITEMS[k] && D.ITEMS[k].type === 'exp');
    const w = modal(`${cname(id)}${id === 'C001' ? '（主角）' : ''}`, `
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">
        ${charAvatar(id, 56)}
        <div>
          <div>${rarityTag(ch.rarity)} <b>${cname(id)}</b> <span class="stars">${stars(c.star, maxStar)}</span></div>
          <div style="font-size:11px;color:var(--dim);margin-top:3px">${ch.faction} · ${ch.role} · ${ch.bloodline}血统 · 战力 ${fmt(C().power(id))}</div>
          <div style="font-size:11px;color:var(--gold);margin-top:2px">碎片 ${c.shards}</div>
        </div>
      </div>
      <div class="stat-6">
        <div class="cell"><div class="v">${fmt(st.atk)}</div><div class="k">攻击</div></div>
        <div class="cell"><div class="v">${fmt(st.def)}</div><div class="k">防御</div></div>
        <div class="cell"><div class="v">${fmt(st.hp)}</div><div class="k">生命</div></div>
        <div class="cell"><div class="v">${fmt(st.spd)}</div><div class="k">速度</div></div>
        <div class="cell"><div class="v">${Math.round(st.crit * 100)}%</div><div class="k">暴击</div></div>
        <div class="cell"><div class="v">${Math.round(st.eva * 100)}%</div><div class="k">闪避</div></div>
      </div>
      <div class="section-title">等级 Lv.${c.lv}（EXP ${fmt(c.exp)}）</div>
      <div class="btn-row">
        <button class="btn small" data-lvup="1" ${!cost ? 'disabled' : ''}>升1级<\/button>
        <button class="btn small" data-lvup="10" ${!cost ? 'disabled' : ''}>升10级</button>
        <button class="btn small" data-expitem="1" ${expItems.length ? '' : 'disabled'}>用经验道具</button>
      </div>
      ${cost ? `<div style="font-size:10px;color:var(--dim);margin-top:4px">下级需要 EXP ${fmt(cost.exp)} + ◈${fmt(cost.points)}</div>` : '<div style="font-size:10px;color:var(--gold);margin-top:4px">已满级</div>'}
      <div class="section-title">星级</div>
      <div class="btn-row">
        <button class="btn small" data-starup="1" ${c.star >= maxStar ? 'disabled' : ''}>升星（需碎片 ${starCost || '—'}）</button>
      </div>
      <div class="section-title">技能（芯片 ▣${fmt(S.cur.skillChip)}）</div>
      ${skills.map((sk, i) => `
        <div class="skill-row">
          <div class="sname">${skillNames[i]}·${sk.name} <span class="tag">Lv.${c.skillLv[i]}</span>
            <button class="btn small ghost" style="margin-left:auto;min-height:26px" data-skillup="${i}" ${c.skillLv[i] >= 10 ? 'disabled' : ''}>升级</button></div>
          <div class="sdesc">${sk.desc}（每级+7%效果 · 下级需 ▣${C().SKILL_CHIP_COST[c.skillLv[i] - 1] || '—'}）</div>
        </div>`).join('')}
      <div class="skill-row">
        <div class="sname">被动·${ch.skills.passive.name}</div>
        <div class="sdesc">${ch.skills.passive.desc}</div>
      </div>
      <div class="section-title">${ch.bloodline}血统 Lv.${c.bloodlineLv}/${D.BLOODLINE_MAX}</div>
      <div style="font-size:11px;color:var(--dim);margin-bottom:8px">${bl.desc}</div>
      <div class="btn-row">
        <button class="btn small" data-blup="1" ${!blCost ? 'disabled' : ''}>血统升级${blCost ? `（❥${blCost.bloodCrystal} + ◈${fmt(blCost.points)}）` : ''}</button>
      </div>
      <div class="section-title">装备</div>
      ${D.RECRUIT_SLOTS.map(slot => {
        const uid = S.equipped[id] && S.equipped[id][slot];
        const eq = uid && S.equips[uid];
        return `<div class="list-row" data-eqslot="${slot}" style="cursor:pointer">
          <span class="tag">${D.EQUIP_SLOTS[slot]}</span>
          <div class="grow">${eq ? `<div class="t1 rtext-${eq.rarity}">${eq.name} +${eq.enhance}</div><div class="t2">${equipBrief(eq)}</div>` : '<div class="t2">未装备</div>'}</div>
          ${eq ? `<button class="btn small ghost" data-unequip="${slot}">卸下</button>` : ''}
        </div>`;
      }).join('')}
    `);
    w.querySelectorAll('[data-lvup]').forEach(b => b.onclick = () => {
      const r = C().levelUp(id, +b.dataset.lvup);
      toast(r.msg);
      closeModal(w); charDetail(id); renderTopbar();
    });
    w.querySelector('[data-starup]').onclick = () => {
      const r = C().starUp(id);
      toast(r.msg);
      closeModal(w); if (r.ok) charDetail(id);
      renderTopbar();
    };
    w.querySelectorAll('[data-skillup]').forEach(b => b.onclick = () => {
      const r = C().skillUp(id, +b.dataset.skillup);
      toast(r.msg);
      closeModal(w); if (r.ok) charDetail(id);
      renderTopbar();
    });
    w.querySelector('[data-blup]').onclick = () => {
      const r = C().bloodlineUpgrade(id);
      toast(r.msg);
      closeModal(w); if (r.ok) charDetail(id);
      renderTopbar();
    };
    const expBtn = w.querySelector('[data-expitem]');
    if (expBtn) expBtn.onclick = () => { closeModal(w); pickExpItem(id); };
    w.querySelectorAll('[data-eqslot]').forEach(el => el.onclick = () => { closeModal(w); pickEquipFor(id, el.dataset.eqslot); });
    w.querySelectorAll('[data-unequip]').forEach(b => b.onclick = ev => {
      ev.stopPropagation();
      C().unequipItem(id, b.dataset.unequip);
      closeModal(w); charDetail(id);
    });
  }
  function equipBrief(eq) {
    const st = C().equipStats(eq);
    const parts = [];
    if (st.flat.atk) parts.push(`攻+${Math.round(st.flat.atk)}`);
    if (st.flat.def) parts.push(`防+${Math.round(st.flat.def)}`);
    if (st.flat.hp) parts.push(`血+${Math.round(st.flat.hp)}`);
    if (st.flat.spd) parts.push(`速+${Math.round(st.flat.spd)}`);
    Object.entries(st.affix).forEach(([k, v]) => parts.push(`${D.AFFIX_POOL[k].name}+${(v * 100).toFixed(1)}%`));
    return parts.join(' ');
  }
  function pickExpItem(id) {
    const S = C().S;
    const items = Object.entries(S.items).filter(([k]) => D.ITEMS[k] && D.ITEMS[k].type === 'exp');
    const w = modal('使用经验道具', items.map(([k, n]) => `
      <div class="list-row">
        <div class="grow"><div class="t1">${D.ITEMS[k].name}</div><div class="t2">+${fmt(D.ITEMS[k].exp)} EXP · 拥有 ${n}</div></div>
        <button class="btn small" data-use="${k}">使用</button>
      </div>`).join('') || '<div class="empty">没有经验道具</div>');
    w.querySelectorAll('[data-use]').forEach(b => b.onclick = () => {
      const r = C().useExpItem(id, b.dataset.use);
      toast(r.msg);
      closeModal(w); charDetail(id);
    });
  }
  function pickEquipFor(charId, slot, reopen) {
    const S = C().S;
    const allowed = charId === '@player' ? D.PLAYER_SLOTS : D.RECRUIT_SLOTS;
    const list = C().inventoryEquips().filter(e => e.slot === slot && allowed.includes(e.slot));
    const back = reopen || (() => charDetail(charId));
    const w = modal(`选择${D.EQUIP_SLOTS[slot]}（${charId === '@player' ? cname('@player') : cname(charId)}）`, list.map(eq => {
      const equippedBy = Object.entries(S.equipped).find(([cid, slots]) => slots[slot] === eq.uid);
      return `<div class="list-row" data-eq="${eq.uid}" style="cursor:pointer">
        <div class="grow"><div class="t1 rtext-${eq.rarity}">${eq.name} +${eq.enhance}</div>
        <div class="t2">${equipBrief(eq)}${equippedBy ? ` · ${cname(equippedBy[0])}装备中` : ''}</div></div>
      </div>`;
    }).join('') || '<div class="empty">背包中没有该部位装备</div>');
    w.querySelectorAll('[data-eq]').forEach(el => el.onclick = () => {
      if (C().equipItem(charId, el.dataset.eq)) toast('已装备');
      else toast('该装备部位不适用');
      closeModal(w); back();
    });
  }

  /* ================= 装备页 ================= */
  let equipFilter = 'all';
  function equipScreen() {
    const S = C().S;
    const list = C().inventoryEquips();
    const filters = [['all', '全部'], ['weapon', '武器'], ['armor', '胸甲'], ['head', '头部'], ['hands', '手部'], ['legs', '腿部'], ['accessory', '饰品'], ['SSR', 'SSR+']];
    let shown = list;
    if (equipFilter === 'SSR') shown = list.filter(e => ['SSR', 'UR'].includes(e.rarity));
    else if (equipFilter !== 'all') shown = list.filter(e => e.slot === equipFilter);
    const rows = shown.slice(0, 80).map(eq => {
      const equippedBy = Object.entries(S.equipped).find(([cid, slots]) => Object.values(slots).includes(eq.uid));
      return `<div class="list-row" data-eqd="${eq.uid}" style="cursor:pointer">
        <span class="tag">${D.EQUIP_SLOTS[eq.slot]}</span>
        <div class="grow"><div class="t1 rtext-${eq.rarity}">${eq.name} +${eq.enhance}</div>
        <div class="t2">${equipBrief(eq)}${equippedBy ? ` · <span style="color:var(--green)">${cname(equippedBy[0])}</span>` : ''}</div></div>
      </div>`;
    }).join('');
    return `
      <div class="pill-tabs">${filters.map(([k, n]) => `<div class="pill ${equipFilter === k ? 'active' : ''}" data-efilter="${k}">${n}</div>`).join('')}</div>
      <div style="display:flex;align-items:center;font-size:11px;color:var(--dim);margin:2px 2px 8px">
        <span>背包 ${list.length} 件</span>
        <span style="margin-left:auto"></span>
        <label style="margin-right:10px"><input type="checkbox" data-autosell="N" ${S.settings.autoSellN ? 'checked' : ''}/> 自动分解N</label>
        <label><input type="checkbox" data-autosell="R" ${S.settings.autoSellR ? 'checked' : ''}/> 自动分解R</label>
      </div>
      ${rows || '<div class="empty">背包空空如也，去副本打装备吧</div>'}
      ${shown.length > 80 ? '<div class="empty">仅显示前 80 件</div>' : ''}`;
  }
  function equipDetail(uid) {
    const S = C().S;
    const eq = S.equips[uid];
    if (!eq) return;
    const cost = C().enhanceCost(eq);
    const rate = eq.enhance < 20 ? Math.round(D.ENHANCE_RATE[eq.enhance] * 100) : 0;
    const set = D.SETS[eq.set];
    const equippedBy = Object.entries(S.equipped).find(([cid, slots]) => Object.values(slots).includes(uid));
    const w = modal(`${eq.name}`, `
      <div style="margin-bottom:10px">
        <span class="rtext-${eq.rarity}" style="font-size:17px;font-weight:800">${eq.rarity}</span>
        <b style="font-size:17px"> ${eq.name} <span style="color:var(--gold)">+${eq.enhance}</span></b>
        <div style="font-size:11px;color:var(--dim);margin-top:4px">${D.EQUIP_SLOTS[eq.slot]} · ${set.name}（2件/3件套装效果）${equippedBy ? ` · ${cname(equippedBy[0])}装备中` : ''}</div>
      </div>
      <div class="skill-row"><div class="sdesc" style="font-size:12px;color:var(--text)">${equipBrief(eq)}</div></div>
      <div class="section-title">强化（+${eq.enhance}/20）</div>
      <div class="btn-row">
        <button class="btn small" data-enh="1" ${eq.enhance >= 20 ? 'disabled' : ''}>强化（◈${fmt(cost.points)} + ◆${cost.otherworld} · ${rate}%）</button>
      </div>
      <div class="section-title">操作</div>
      <div class="btn-row">
        <button class="btn small" data-equipto="1">装备给角色</button>
        <button class="btn small ghost" data-decomp="1">分解（◆${D.DECOMPOSE_GAIN[eq.rarity] + eq.enhance * 3}）</button>
      </div>
    `);
    w.querySelector('[data-enh]').onclick = () => {
      const r = C().enhance(uid);
      toast(r.msg);
      closeModal(w); equipDetail(uid); renderTopbar();
    };
    w.querySelector('[data-decomp]').onclick = () => {
      closeModal(w);
      confirmBox('分解装备', `确定分解 <b class="rtext-${eq.rarity}">${eq.name} +${eq.enhance}</b>？将获得 ◆${D.DECOMPOSE_GAIN[eq.rarity] + eq.enhance * 3}`, () => {
        const r = C().decompose(uid);
        if (r.ok) toast(`分解成功，获得 ◆${r.gain}`);
        render(); renderTopbar();
      });
    };
    w.querySelector('[data-equipto]').onclick = () => {
      closeModal(w);
      const canPlayer = D.PLAYER_SLOTS.includes(eq.slot);
      const candidates = (canPlayer ? ['@player'] : []).concat(Object.keys(S.chars));
      const w2 = modal('装备给…', candidates.map(id => {
        if (id === '@player') {
          return `<div class="list-row" data-to="@player" style="cursor:pointer">
            ${charAvatar('@player', 36)}
            <div class="grow"><div class="t1">${cname('@player')}（主角）</div><div class="t2">Lv.${S.player.level} · 战力${fmt(C().playerPower())}</div></div>
          </div>`;
        }
        const ch = D.charById[id];
        return `<div class="list-row" data-to="${id}" style="cursor:pointer">
          ${charAvatar(id, 36)}
          <div class="grow"><div class="t1">${cname(id)}</div><div class="t2">Lv.${S.chars[id].lv} · ${ch.role}</div></div>
        </div>`;
      }).join(''));
      w2.querySelectorAll('[data-to]').forEach(el => el.onclick = () => {
        if (C().equipItem(el.dataset.to, uid)) toast('已装备');
        else toast('该装备部位不适用');
        closeModal(w2);
        render();
      });
    };
  }

  /* ================= 招募 ================= */
  function recruitModal() {
    const S = C().S;
    const free = C().freeRecruitAvailable();
    const w = modal('轮回者招募', `
      <div class="card" style="margin-bottom:10px">
        <h3>每日免费 <span class="sub">${free ? '可领取' : '明日再来'}</span></h3>
        <button class="btn primary block" data-free="1" ${free ? '' : 'disabled'}>免费招募 1 次</button>
      </div>
      ${Object.entries(D.RECRUIT_POOLS).map(([pid, p]) => `
      <div class="card" style="margin-bottom:10px">
        <h3>${p.name} <span class="sub">${Object.entries(p.rates).map(([r, v]) => `${r} ${(v * 100).toFixed(1)}%`).join(' · ')}</span></h3>
        <div class="btn-row">
          <button class="btn small" data-pull1="${pid}">抽 1 次（${p.cost.holy ? '✦' + p.cost.holy : '◈' + fmt(p.cost.points)}）</button>
          <button class="btn small gold" data-pull10="${pid}">十连（${pid === 'normal' ? '◈4.5万' : '✦900'}·保SR）</button>
        </div>
        ${pid !== 'normal' ? `<div style="font-size:10px;color:var(--dim);margin-top:6px">保底计数 ${pid === 'limited' ? S.recruit.pityLim : S.recruit.pityAdv}/100（50抽内必SSR）</div>` : ''}
      </div>`).join('')}
      ${S.ssrTicket > 0 ? `<button class="btn gold block" data-ssrpick="1">🎫 使用SSR自选券（剩 ${S.ssrTicket}）</button>` : ''}
    `);
    const showResults = results => {
      closeModal(w);
      const wr = modal('招募结果', `<div class="char-grid">${results.map(r => {
        const ch = D.charById[r.id];
        return `<div class="char-card rarity-${r.rarity} ${['SSR', 'UR'].includes(r.rarity) ? 'shine' : ''}">
          ${charAvatar(r.id)}
          <div class="cname">${cname(r.id)}</div>
          <div class="cmeta">${r.isNew ? '<span style="color:var(--green)">NEW</span>' : `碎片+${r.shards}`}</div>
        </div>`;
      }).join('')}</div>`);
      refresh();
    };
    w.querySelector('[data-free]').onclick = () => {
      const r = C().freeRecruit();
      if (r.error) { toast(r.error); return; }
      showResults([r]);
    };
    w.querySelectorAll('[data-pull1]').forEach(b => b.onclick = () => {
      const r = C().recruitOnce(b.dataset.pull1);
      if (r.error) { toast(r.error); return; }
      showResults([r]);
    });
    w.querySelectorAll('[data-pull10]').forEach(b => b.onclick = () => {
      const r = C().recruitTen(b.dataset.pull10);
      if (r.error) { toast(r.error); return; }
      showResults(r.results);
    });
    const tk = w.querySelector('[data-ssrpick]');
    if (tk) tk.onclick = () => { closeModal(w); ssrPickModal(); };
  }
  function ssrPickModal() {
    const ssrs = D.characters.filter(c => c.rarity === 'SSR' && !c.hidden);
    const w = modal('SSR 自选', `<div class="char-grid">${ssrs.map(ch => `
      <div class="char-card rarity-SSR" data-pickssr="${ch.id}">${charAvatar(ch.id)}<div class="cname">${cname(ch.id)}</div><div class="cmeta">${ch.role} · ${ch.faction}</div></div>`).join('')}</div>`);
    w.querySelectorAll('[data-pickssr]').forEach(el => el.onclick = () => {
      const r = C().ssrTicketUse(el.dataset.pickssr);
      toast(r.msg);
      closeModal(w);
      refresh();
    });
  }

  /* ================= 商店 ================= */
  let shopTab = 'god';
  function shopModal(tab) {
    shopTab = tab || shopTab;
    const S = C().S;
    const shop = D.SHOPS[shopTab];
    const w = modal('兑换大厅', `
      <div class="pill-tabs">${Object.entries(D.SHOPS).map(([k, s]) => `<div class="pill ${shopTab === k ? 'active' : ''}" data-shoptab="${k}">${s.name}（${curIcon(s.currency)}${fmt(S.cur[s.currency])}）</div>`).join('')}</div>
      ${shop.items.map((it, i) => {
        const key = shopTab + '_' + i + '_' + C().dailyDate();
        const bought = S.shop.bought[key] || 0;
        const soldOut = it.stock > 0 && bought >= it.stock;
        return `<div class="list-row">
          <div class="grow"><div class="t1">${it.name}</div><div class="t2">${curIcon(shop.currency)} ${fmt(it.price)}${it.stock > 0 ? ` · 每日限${it.stock}（已购${bought}）` : ''}</div></div>
          <button class="btn small" data-buy="${i}" ${soldOut ? 'disabled' : ''}>购买</button>
        </div>`;
      }).join('')}
    `);
    w.querySelectorAll('[data-shoptab]').forEach(el => el.onclick = () => { closeModal(w); shopModal(el.dataset.shoptab); });
    w.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const r = C().buyShopItem(shopTab, +b.dataset.buy);
      toast(r.msg);
      closeModal(w); if (r.ok) shopModal(shopTab);
      renderTopbar();
    });
  }

  /* ================= 建筑 ================= */
  function buildingsModal() {
    const S = C().S;
    const w = modal('基地建设', D.BUILDINGS.map(b => {
      const lv = S.buildings[b.id];
      const cost = D.buildingCost(b.id, lv);
      return `<div class="card" style="margin-bottom:10px">
        <h3>${b.name} <span class="sub">Lv.${lv}/50</span></h3>
        <div style="font-size:11px;color:var(--dim);margin-bottom:8px">${b.desc}</div>
        <button class="btn small" data-bup="${b.id}" ${lv >= 50 ? 'disabled' : ''}>升级（◈${fmt(cost)}）</button>
      </div>`;
    }).join(''));
    w.querySelectorAll('[data-bup]').forEach(btn => btn.onclick = () => {
      const r = C().upgradeBuilding(btn.dataset.bup);
      toast(r.msg);
      closeModal(w); if (r.ok) buildingsModal();
      renderTopbar();
    });
  }

  /* ================= 任务（主线 / 日常） ================= */
  let taskTab = 'main';
  function tasksModal(tab) {
    taskTab = tab || taskTab;
    const S = C().S;
    C().ensureDaily();
    const allDone = D.DAILY_TASKS.every(t => (S.tasks.daily[t.id] || 0) >= t.target);
    const mainList = C().mainQuestState();
    const mainHtml = mainList.map(({ q, done, claimed }) => `
      <div class="list-row" style="${claimed ? 'opacity:.45' : ''}">
        <div class="grow"><div class="t1">${q.name}</div>
        <div class="t2">${q.desc} · 奖励 ${Object.entries(q.reward).filter(([, v]) => v > 0).map(([k, v]) => `${curIcon(k)}${v}`).join(' ')}</div></div>
        <button class="btn small ${done && !claimed ? 'primary' : ''}" data-mclaim="${q.id}" ${done && !claimed ? '' : 'disabled'}>${claimed ? '已完成' : done ? '领取' : '进行中'}</button>
      </div>`).join('');
    const dailyHtml = `
      ${D.DAILY_TASKS.map(t => {
        const prog = S.tasks.daily[t.id] || 0;
        const done = prog >= t.target;
        const claimed = S.tasks.claimed[t.id];
        return `<div class="list-row">
          <div class="grow"><div class="t1">${t.name}</div>
          <div class="t2">${Math.min(prog, t.target)}/${t.target} · 奖励 ${Object.entries(t.reward).map(([k, v]) => `${curIcon(k)}${v}`).join(' ')}</div></div>
          <button class="btn small ${done && !claimed ? 'primary' : ''}" data-claim="${t.id}" ${done && !claimed ? '' : 'disabled'}>${claimed ? '已领' : done ? '领取' : '未完成'}</button>
        </div>`;
      }).join('')}
      <div class="card" style="margin-top:10px">
        <h3>全部完成奖励</h3>
        <div style="font-size:12px;color:var(--dim);margin-bottom:8px">${Object.entries(D.DAILY_ALL_REWARD).map(([k, v]) => `${curIcon(k)}${v}`).join(' · ')}</div>
        <button class="btn gold block" data-claimall="1" ${allDone && !S.tasks.allClaimed ? '' : 'disabled'}>${S.tasks.allClaimed ? '已领取' : '一键领取'}</button>
      </div>`;
    const w = modal('任务', `
      <div class="pill-tabs">
        <div class="pill ${taskTab === 'main' ? 'active' : ''}" data-ttab="main">📜 主线</div>
        <div class="pill ${taskTab === 'daily' ? 'active' : ''}" data-ttab="daily">📋 日常</div>
      </div>
      ${taskTab === 'main' ? mainHtml : dailyHtml}
    `);
    w.querySelectorAll('[data-ttab]').forEach(el => el.onclick = () => { closeModal(w); tasksModal(el.dataset.ttab); });
    w.querySelectorAll('[data-mclaim]').forEach(b => b.onclick = () => {
      const r = C().claimQuest(b.dataset.mclaim);
      if (r.ok) toast('主线奖励已领取');
      closeModal(w); tasksModal(); renderTopbar();
    });
    w.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => {
      C().claimTask(b.dataset.claim);
      closeModal(w); tasksModal(); renderTopbar();
    });
    w.querySelector('[data-claimall]').onclick = () => {
      const r = C().claimAllTasks();
      toast(r.ok ? '领取成功' : r.msg);
      closeModal(w); tasksModal(); renderTopbar();
    };
  }

  /* ================= 基因锁 / 转生 ================= */
  function geneLockModal() {
    const S = C().S;
    const info = C().geneLockInfo();
    const w = modal('基因锁', `
      <div style="font-size:12px;color:var(--dim);margin-bottom:10px">在生死之间突破人类极限。当前：<b style="color:var(--accent)">${S.player.geneLock > 0 ? D.GENE_LOCKS[S.player.geneLock - 1].name : '未解锁'}</b></div>
      ${D.GENE_LOCKS.map((g, i) => {
        const unlocked = S.player.geneLock > i;
        const isNext = S.player.geneLock === i;
        return `<div class="card" style="margin-bottom:8px;${isNext ? 'border-color:var(--accent)' : ''}">
          <h3>${i + 1}阶 · ${g.name} ${unlocked ? '<span class="sub" style="color:var(--green)">已解锁</span>' : ''}</h3>
          <div style="font-size:12px;color:var(--dim)">${g.desc}</div>
          ${isNext && !info.max ? `
            <div style="font-size:11px;color:var(--gold);margin-top:6px">条件：${g.req} · ❥${g.cost.bloodCrystal}</div>
            ${info.reqs.length ? `<div style="font-size:11px;color:var(--accent);margin-top:4px">未满足：${info.reqs.join('；')}</div>` : ''}
            <button class="btn primary block" style="margin-top:8px" data-glunlock="1" ${info.can ? '' : 'disabled'}>突破基因锁</button>` : ''}
        </div>`;
      }).join('')}
    `);
    const btn = w.querySelector('[data-glunlock]');
    if (btn) btn.onclick = () => {
      const r = C().geneLockUnlock();
      toast(r.msg, 2500);
      closeModal(w); if (r.ok) geneLockModal();
      refresh();
    };
  }
  function reincarnModal() {
    const S = C().S;
    const can = C().canReincarnate();
    const n = S.player.reincarnations + 1;
    const rpGain = Math.floor(100 * Math.pow(n, 1.15));
    const w = modal('转生', `
      <div class="card">
        <h3>轮回转生 <span class="sub">已转生 ${S.player.reincarnations} 次</span></h3>
        <div style="font-size:12px;color:var(--dim);line-height:1.7">
          重置玩家等级与世界进度，保留角色/装备/血统/基因锁/天赋。<br>
          下次转生获得 <b style="color:var(--gold)">♾${rpGain}</b> 转生点。
        </div>
        <div style="font-size:11px;margin-top:8px;color:${can ? 'var(--green)' : 'var(--accent)'}">
          条件：玩家Lv.${S.player.level}/100 · 基因锁${S.player.geneLock}/5 · 主神核心Lv.${S.buildings.core}/30
        </div>
        <button class="btn primary block" style="margin-top:10px" data-reinc="1" ${can ? '' : 'disabled'}>开始转生</button>
      </div>
      <div class="section-title">永久天赋（♾${fmt(S.cur.rp)}）</div>
      ${Object.entries(D.TALENTS).map(([k, t]) => {
        const lv = S.player.talents[k];
        const cost = D.TALENT_COSTS[lv];
        return `<div class="card" style="margin-bottom:8px">
          <h3>${t.name} <span class="sub">Lv.${lv}/10 · ${t.desc}</span></h3>
          ${lv > 0 ? `<div style="font-size:11px;color:var(--green);margin-bottom:6px">已激活：${t.nodes.slice(0, lv).join('、')}</div>` : ''}
          ${lv < 10 ? `<button class="btn small" data-talent="${k}">${t.nodes[lv]}（♾${cost}）</button>` : '<div style="color:var(--gold);font-size:12px">已满级</div>'}
        </div>`;
      }).join('')}
    `);
    w.querySelector('[data-reinc]').onclick = () => {
      closeModal(w);
      confirmBox('确认转生', '转生将重置玩家等级与世界进度（角色、装备、血统、基因锁、天赋保留）。确定？', () => {
        const r = C().reincarnate();
        if (r.ok) { toast(`第 ${r.count} 次转生完成！获得 ♾${r.rp}`, 3000); }
        reincarnModal(); refresh(); render();
      });
    };
    w.querySelectorAll('[data-talent]').forEach(b => b.onclick = () => {
      const r = C().buyTalent(b.dataset.talent);
      toast(r.ok ? '天赋已激活' : r.msg);
      closeModal(w); if (r.ok) reincarnModal();
      renderTopbar();
    });
  }

  /* ================= 背包 / 设置 ================= */
  function bagModal() {
    const S = C().S;
    const entries = Object.entries(S.items).filter(([, n]) => n > 0);
    const w = modal('道具背包', entries.map(([k, n]) => {
      const it = D.ITEMS[k];
      if (!it) return '';
      const usable = it.type === 'box';
      return `<div class="list-row">
        <div class="grow"><div class="t1">${it.name}</div><div class="t2">${it.desc || (it.type === 'exp' ? `+${fmt(it.exp)} EXP（角色详情页使用）` : it.type === 'material' ? '强化材料' : '战斗道具')} · 拥有 ${n}</div></div>
        ${usable ? `<button class="btn small" data-openbox="${k}">开启</button>` : ''}
      </div>`;
    }).join('') || '<div class="empty">背包是空的</div>');
    w.querySelectorAll('[data-openbox]').forEach(b => b.onclick = () => {
      const r = C().openBox(b.dataset.openbox);
      if (r.ok && r.equip) toast(`获得 ${r.equip.rarity} ${r.equip.name}！`, 2500);
      else if (r.ok && r.sold) toast('装备已自动分解');
      closeModal(w); bagModal(); renderTopbar();
    });
  }
  function settingsModal() {
    const slots = C().slotInfo();
    const w = modal('设置与存档', `
      <div class="card">
        <h3>战斗速度</h3>
        <div class="btn-row">${[1, 2, 3].map(s => `<button class="btn small ${C().S.settings.speed === s ? 'primary' : ''}" data-speed="${s}">${s}×</button>`).join('')}</div>
      </div>
      <div class="card">
        <h3>存档槽</h3>
        ${slots.map(s => `<div class="list-row">
          <div class="grow"><div class="t1">槽 ${s.slot}</div><div class="t2">${s.exists && s.meta ? `Lv.${s.meta.level} · 回廊${s.meta.floor}层 · ${new Date(s.meta.time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '空'}</div></div>
          <button class="btn small" data-saveslot="${s.slot}">存入</button>
          <button class="btn small ghost" data-loadslot="${s.slot}" ${s.exists ? '' : 'disabled'}>读取</button>
        </div>`).join('')}
      </div>
      <div class="card">
        <h3>备份</h3>
        <div class="btn-row">
          <button class="btn small" data-export="1">导出存档</button>
          <button class="btn small" data-import="1">导入存档</button>
        </div>
        <input type="file" id="import-file" accept="application/json" style="display:none" />
      </div>
      <div class="card">
        <h3>危险区</h3>
        <button class="btn small ghost" data-reset="1" style="color:var(--accent)">删除当前进度，重新开始</button>
      </div>
      <div style="text-align:center;font-size:10px;color:var(--dim);padding:8px;opacity:.6" data-ver>无限轮回 V5.0</div>
    `);
    let verTaps = 0, verTimer = null;
    w.querySelector('[data-ver]').onclick = () => {
      verTaps++;
      clearTimeout(verTimer);
      verTimer = setTimeout(() => { verTaps = 0; }, 2000);
      if (verTaps >= 7) { closeModal(w); gmModal(); }
    };
    w.querySelectorAll('[data-speed]').forEach(b => b.onclick = () => {
      C().S.settings.speed = +b.dataset.speed; C().save();
      closeModal(w); settingsModal();
    });
    w.querySelectorAll('[data-saveslot]').forEach(b => b.onclick = () => {
      C().saveSlot(+b.dataset.saveslot);
      toast('已存入槽 ' + b.dataset.saveslot);
      closeModal(w); settingsModal();
    });
    w.querySelectorAll('[data-loadslot]').forEach(b => b.onclick = () => {
      closeModal(w);
      confirmBox('读取存档', '读取槽 ' + b.dataset.loadslot + ' 将覆盖当前进度，确定？', () => {
        if (C().loadSlot(+b.dataset.loadslot)) { toast('读取成功'); location.reload(); }
        else toast('读取失败');
      });
    });
    w.querySelector('[data-export]').onclick = () => {
      const blob = new Blob([C().exportSave()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `无限轮回_存档_${C().dailyDate()}.json`;
      a.click();
      toast('已导出存档文件');
    };
    w.querySelector('[data-import]').onclick = () => w.querySelector('#import-file').click();
    w.querySelector('#import-file').onchange = ev => {
      const f = ev.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const r = C().importSave(reader.result);
        if (r.ok) { toast('导入成功'); setTimeout(() => location.reload(), 600); }
        else toast(r.msg);
      };
      reader.readAsText(f);
    };
    w.querySelector('[data-reset]').onclick = () => {
      closeModal(w);
      confirmBox('删除进度', '将永久删除当前游戏进度（不影响手动存档槽），确定重新开始？', () => {
        localStorage.removeItem('wxlh_save_v5');
        location.reload();
      });
    };
  }

  /* ================= 战斗播放器 ================= */
  function buildAllies(hpPctMap, extraBuffs) {
    const S = C().S;
    const fb = C().factionBuffs(S.party);
    const buffAtk = (extraBuffs && extraBuffs.atkPct) || 0;
    const allies = [];
    // 主角必上阵
    if (!hpPctMap || hpPctMap['@player'] === undefined || hpPctMap['@player'] > 0.01) {
      const pst = C().effectivePlayerStats();
      const gl = S.player.geneLock;
      const pFullHp = pst.hp;
      const pHp = hpPctMap && hpPctMap['@player'] !== undefined ? Math.max(1, Math.round(pFullHp * hpPctMap['@player'])) : pFullHp;
      allies.push(Object.assign({}, pst, {
        name: cname('@player'), kind: 'warrior', faction: null,
        position: 'front',
        skills: D.PROTAGONIST.skills, skillLv: [Math.min(10, 1 + gl * 2), Math.min(10, 1 + gl * 2), Math.min(10, 1 + gl * 2)],
        atk: Math.round(pst.atk * (1 + buffAtk)),
        hp: pHp, maxHp: pFullHp,
        charId: '@player',
      }));
    }
    S.party.filter(Boolean).filter(id => !hpPctMap || (hpPctMap[id] === undefined || hpPctMap[id] > 0.01)).forEach(id => {
      const base = D.charById[id];
      const eff = C().effectiveStats(id);
      const idx = S.party.indexOf(id);
      const fullHp = Math.round(eff.hp * (1 + fb.hpPct));
      const hp = hpPctMap && hpPctMap[id] !== undefined ? Math.max(1, Math.round(fullHp * hpPctMap[id])) : fullHp;
      allies.push(Object.assign({}, eff, {
        name: cname(id), kind: base.kind, faction: base.faction,
        position: idx < 2 ? 'front' : 'back',
        skills: base.skills, skillLv: S.chars[id].skillLv,
        atk: Math.round(eff.atk * (1 + fb.atkPct + buffAtk)),
        hp, maxHp: fullHp,
        skillMult: eff.skillMult + fb.skillPct,
        charId: id,
      }));
    });
    return allies;
  }
  // 战斗配置：{ title, allies, enemies, worldId, maxRounds, onEnd(win, result, hpLeft) }
  function startBattle(cfg) {
    const S = C().S;
    const res = window.Battle.run({
      allies: JSON.parse(JSON.stringify(cfg.allies)),
      enemies: cfg.enemies,
      worldId: cfg.worldId,
      maxRounds: cfg.maxRounds,
      allyHitMod: (window.Battle.MECHANICS[cfg.worldId] || {}).allyHitMod || 0,
    });
    const root = document.getElementById('battle-root');
    const overlay = document.createElement('div');
    overlay.id = 'battle-overlay';
    overlay.innerHTML = `
      <div class="b-head">
        <div class="b-title">${esc(cfg.title)}</div>
        <button class="btn small ghost" data-speedbtn>${S.settings.speed}×速度</button>
      </div>
      <div class="b-field">
        <div class="b-row enemies"></div>
        <div class="b-row allies"></div>
      </div>
      <div id="battle-log"></div>
      <div class="b-controls"><button class="btn block" data-skip>跳过 ⏩</button></div>`;
    root.appendChild(overlay);
    // 单位状态
    const units = {};
    const start = res.frames[0];
    start.allies.concat(start.enemies).forEach(u => { units[u.uid] = Object.assign({}, u); });
    const eRow = overlay.querySelector('.enemies');
    const aRow = overlay.querySelector('.allies');
    function unitHtml(u) {
      return `<div class="unit ${u.side === 'enemy' ? 'enemy' : ''} ${u.isBoss ? 'boss' : ''}" id="u-${u.uid}">
        <div class="u-avatar">${esc(u.name[0])}</div>
        <div class="u-name">${esc(u.name)}</div>
        <div class="bar hp"><i style="width:100%"></i></div>
        ${u.side === 'ally' ? '<div class="bar energy"><i style="width:0%"></i></div>' : ''}
      </div>`;
    }
    eRow.innerHTML = start.enemies.map(unitHtml).join('');
    aRow.innerHTML = start.allies.map(unitHtml).join('');
    const logBox = overlay.querySelector('#battle-log');
    const nameOf = uid => (units[uid] || {}).name || '?';
    function log(text) {
      const d = document.createElement('div');
      d.textContent = text;
      logBox.appendChild(d);
      logBox.scrollTop = logBox.scrollHeight;
      while (logBox.children.length > 60) logBox.firstChild.remove();
    }
    function updateUnit(uid) {
      const u = units[uid];
      const el = overlay.querySelector('#u-' + uid);
      if (!el || !u) return;
      const pct = Math.max(0, u.hp / u.maxHp * 100);
      const bar = el.querySelector('.bar.hp');
      bar.classList.toggle('low', pct < 35);
      bar.querySelector('i').style.width = pct + '%';
      el.classList.toggle('dead', u.hp <= 0);
    }
    function floater(uid, text, cls) {
      const el = overlay.querySelector('#u-' + uid);
      if (!el) return;
      const f = document.createElement('div');
      f.className = 'floater ' + (cls || 'dmg');
      f.textContent = text;
      el.appendChild(f);
      setTimeout(() => f.remove(), 850);
    }
    function flash(uid, cls) {
      const el = overlay.querySelector('#u-' + uid);
      if (!el) return;
      el.classList.remove('hit', 'acting');
      void el.offsetWidth;
      el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 300);
    }
    function setEnergy(uid, val) {
      const el = overlay.querySelector('#u-' + uid);
      if (!el) return;
      const bar = el.querySelector('.bar.energy i');
      if (bar) bar.style.width = Math.min(100, val) + '%';
    }
    const energyMap = {};
    let speed = S.settings.speed;
    overlay.querySelector('[data-speedbtn]').onclick = ev => {
      speed = speed >= 3 ? 1 : speed + 1;
      S.settings.speed = speed; C().save();
      ev.target.textContent = speed + '×速度';
    };
    let idx = 0, skipped = false, finished = false;
    overlay.querySelector('[data-skip]').onclick = () => { skipped = true; };
    if (start.note) log(`⚠ 世界机制：${start.note}`);

    function applyFrame(f) {
      switch (f.type) {
        case 'round': if (f.n <= 5 || f.n % 5 === 0) log(`—— 第 ${f.n} 回合 ——`); break;
        case 'attack': flash(f.actor, 'acting'); energyMap[f.actor] = Math.min(100, (energyMap[f.actor] || 0) + 30); setEnergy(f.actor, energyMap[f.actor]); break;
        case 'skill':
          flash(f.actor, 'acting');
          log(`✨ ${nameOf(f.actor)} 使用【${f.name}】`);
          if (f.ult) { energyMap[f.actor] = 0; setEnergy(f.actor, 0); }
          break;
        case 'damage': {
          const u = units[f.target];
          if (u) { u.hp = Math.max(0, u.hp - f.dmg); updateUnit(f.target); }
          floater(f.target, (f.crit ? '暴击 ' : '-') + fmt(f.dmg), f.crit ? 'crit' : 'dmg');
          flash(f.target, 'hit');
          if (f.healed) { const s = units[f.source]; if (s) { s.hp = Math.min(s.maxHp, s.hp + f.healed); updateUnit(f.source); floater(f.source, '+' + fmt(f.healed), 'heal'); } }
          energyMap[f.target] = Math.min(100, (energyMap[f.target] || 0) + 15); setEnergy(f.target, energyMap[f.target]);
          if (f.killed) log(`💀 ${nameOf(f.target)} 倒下`);
          break;
        }
        case 'dot': {
          const u = units[f.target];
          if (u) { u.hp = Math.max(0, u.hp - f.dmg); updateUnit(f.target); }
          floater(f.target, `-${fmt(f.dmg)}`, 'dmg');
          if (f.killed) log(`💀 ${nameOf(f.target)} 倒下`);
          break;
        }
        case 'heal': {
          const u = units[f.target];
          if (u) { u.hp = Math.min(u.maxHp, u.hp + f.amount); updateUnit(f.target); }
          floater(f.target, '+' + fmt(f.amount), 'heal');
          break;
        }
        case 'shield': floater(f.target, '🛡+' + fmt(f.amount), 'heal'); break;
        case 'dodge': floater(f.target, '闪避', 'miss'); break;
        case 'skip': log(`😵 ${nameOf(f.actor)} 无法行动`); break;
        case 'buff': floater(f.target, '↑ ' + f.name, 'heal'); break;
        case 'phase': log(`🔥 ${f.text}`); break;
        case 'revive': {
          const u = units[f.boss];
          if (u) { u.hp = Math.round(u.maxHp * 0.3); updateUnit(f.boss); }
          log(`♻ ${f.text}`);
          break;
        }
        case 'summon': log(`🕯 ${f.text}`); break;
        case 'rule': log(`👁 ${f.text}`); break;
        case 'instantkill': floater(f.target, '☠ 即死', 'crit'); break;
      }
    }
    function finish() {
      if (finished) return;
      finished = true;
      // 补算剩余帧（保证状态正确）
      for (; idx < res.frames.length; idx++) { const f = res.frames[idx]; if (['damage', 'dot', 'heal', 'revive'].includes(f.type)) applyFrame(f); }
      const endF = res.frames[res.frames.length - 1];
      const hpLeft = {};
      start.allies.forEach(u => { const st = units[u.uid]; hpLeft[u.uid] = Math.max(0, st.hp / st.maxHp); });
      const outcome = cfg.onEnd(res.win, res, units) || {};
      const rewards = outcome.rewards || [];
      const panel = document.createElement('div');
      panel.className = 'b-result';
      panel.innerHTML = `
        <h2 class="${res.win ? 'win' : 'lose'}">${res.win ? '胜 利' : '任务失败'}</h2>
        <div style="color:var(--dim);font-size:12px">${res.rounds} 回合${outcome.sub ? ' · ' + outcome.sub : ''}</div>
        ${rewards.length ? `<div class="reward-chips">${rewards.map(r => `<span class="reward-chip">${r}</span>`).join('')}</div>` : ''}
        <button class="btn primary" style="min-width:200px" data-close>${res.win ? '收下奖励' : '返回'}</button>`;
      overlay.appendChild(panel);
      panel.querySelector('[data-close]').onclick = () => {
        overlay.remove();
        if (outcome.after) outcome.after();
      };
    }
    function step() {
      if (finished) return;
      if (skipped) { finish(); return; }
      const f = res.frames[idx++];
      if (!f || f.type === 'end') { finish(); return; }
      applyFrame(f);
      const delay = f.type === 'round' ? 260 : ['skill', 'phase', 'revive', 'summon'].includes(f.type) ? 520 : 300;
      setTimeout(step, delay / speed);
    }
    setTimeout(step, 400);
  }

  /* ================= 随机事件 ================= */
  function showEvent(ev, onDone) {
    const w = modal(ev.title, `
      <div class="event-desc">${esc(ev.desc)}</div>
      <div class="event-choices">
        ${ev.choices.map((c, i) => `<button class="btn block" data-choice="${i}">${esc(c.text)}</button>`).join('')}
      </div>
    `, { sticky: true });
    w.querySelectorAll('[data-choice]').forEach(b => b.onclick = () => {
      const ch = ev.choices[+b.dataset.choice];
      const eff = ch.effect || {};
      const S = C().S;
      const gains = [];
      ['points', 'holy', 'story', 'otherworld', 'skillChip', 'bloodCrystal'].forEach(k => {
        if (eff[k]) {
          if (eff[k] < 0 && S.cur[k] < -eff[k]) { /* 不够扣则清零 */ }
          C().addCur(k, eff[k]);
          gains.push(`${curIcon(k)}${eff[k] > 0 ? '+' : ''}${eff[k]}`);
        }
      });
      if (eff.item) { C().addItem(eff.item); gains.push(`🎁${D.ITEMS[eff.item].name}`); }
      if (eff.healPct && run) {
        Object.keys(run.hpPct).forEach(id => { run.hpPct[id] = Math.min(1, run.hpPct[id] + eff.healPct); });
        gains.push(`全队恢复 ${Math.round(eff.healPct * 100)}%`);
      }
      if (eff.hurtPct && run) {
        Object.keys(run.hpPct).forEach(id => { run.hpPct[id] = Math.max(0.05, run.hpPct[id] - eff.hurtPct); });
        gains.push(`全队受伤 ${Math.round(eff.hurtPct * 100)}%`);
      }
      if (eff.buff && run) {
        Object.entries(eff.buff).forEach(([k, v]) => { run.buffs[k] = (run.buffs[k] || 0) + v; });
        gains.push('获得探索增益');
      }
      closeModal(w);
      const proceed = () => {
        if (eff.battle && run) {
          doNodeBattle('elite', () => onDone && onDone());
        } else if (onDone) onDone();
      };
      const wr = modal('事件结果', `
        <div class="event-desc">${esc(ch.result)}</div>
        ${gains.length ? `<div class="reward-chips" style="margin-top:10px">${gains.map(g => `<span class="reward-chip">${g}</span>`).join('')}</div>` : ''}
        <button class="btn primary block" style="margin-top:12px" data-go>继续</button>
      `, { sticky: true, center: true });
      wr.querySelector('[data-go]').onclick = () => { closeModal(wr); proceed(); };
      refresh();
    });
  }

  /* ================= 副本战斗流程 ================= */
  function rewardChips(got) {
    return got.map(g => {
      if (g.k === 'equip') return `<span class="rtext-${g.v.rarity}">🗡${g.v.name}</span>`;
      if (g.k === 'exp') return `EXP+${fmt(g.v)}`;
      return `${curIcon(g.k)}+${fmt(g.v)}${g.sold ? '(自动分解)' : ''}`;
    });
  }
  function doNodeBattle(kind, onDone, premadeEnemies) {
    const Dun = window.Dungeon;
    const allies = buildAllies(run.hpPct, run.buffs);
    if (!allies.length) { toast('全队重伤，探索失败'); endRun(false); return; }
    const enemies = premadeEnemies || Dun.makeEnemies(run.worldId, run.diff, run.stage, kind);
    const w = D.WORLDS.find(x => x.id === run.worldId);
    startBattle({
      title: `${w.name} · ${kind === 'elite' ? '精英伏击' : '遭遇战'}`,
      allies, enemies, worldId: run.worldId,
      onEnd(win, res, units) {
        if (!win) {
          return { rewards: [], sub: '队伍全员重伤', after: () => endRun(false) };
        }
        const g = Dun.grantRewards(run.worldId, run.diff, run.stage, kind);
        window.Core.addCharExp(C().S.party.filter(Boolean), g.rewards.exp);
        C().addPlayerExp(Math.round(g.rewards.exp * 0.5));
        C().battleSettle({}, true, kind === 'elite');
        // 更新队伍血量
        start_allies(units);
        function start_allies(units) {
          Object.values(units).forEach(u => {
            if (u.side === 'ally' && u.charId !== undefined) run.hpPct[u.charId] = Math.max(0, u.hp / u.maxHp);
          });
        }
        C().save();
        return {
          rewards: rewardChips(g.got),
          after: () => { refresh(); onDone && onDone(); },
        };
      },
    });
  }
  function doFinalBattle(premadeEnemies) {
    const Dun = window.Dungeon;
    const kind = run.route.finalKind;
    const allies = buildAllies(run.hpPct, run.buffs);
    if (!allies.length) { toast('全队重伤，探索失败'); endRun(false); return; }
    const enemies = premadeEnemies || Dun.makeEnemies(run.worldId, run.diff, run.stage, kind);
    const w = D.WORLDS.find(x => x.id === run.worldId);
    const isBoss = kind === 'boss';
    startBattle({
      title: `${w.name} ${run.stage}/12 · ${isBoss ? w.boss : '区域决战'}`,
      allies, enemies, worldId: run.worldId,
      maxRounds: isBoss ? 50 : 30,
      onEnd(win, res, units) {
        if (!win) return { rewards: [], sub: '再接再厉', after: () => endRun(false) };
        const g = Dun.grantRewards(run.worldId, run.diff, run.stage, kind);
        window.Core.addCharExp(C().S.party.filter(Boolean), g.rewards.exp * 2);
        C().addPlayerExp(g.rewards.exp);
        C().battleSettle({}, true, isBoss);
        // 星级：1星保底；无人阵亡+1；回合≤20+1
        const anyDead = Object.values(units).some(u => u.side === 'ally' && u.hp <= 0);
        let stars = 1 + (anyDead ? 0 : 1) + (res.rounds <= 20 ? 1 : 0);
        const comp = C().stageComplete(run.worldId, run.diff, run.stageIdx, stars);
        const chips = rewardChips(g.got);
        if (comp.firstClearReward) {
          Object.entries(comp.firstClearReward).forEach(([k, v]) => chips.push(`首通 ${curIcon(k)}+${v}`));
        }
        if (comp.newUnlocks && comp.newUnlocks.length) {
          comp.newUnlocks.forEach(n => chips.push(`🔓 解锁【${n}】`));
        }
        return {
          rewards: chips,
          sub: '★'.repeat(stars) + ' 通关',
          after: () => endRun(true),
        };
      },
    });
  }
  function endRun(cleared) {
    const wid = run ? run.worldId : dungeonView.worldId;
    const diff = run ? run.diff : 'normal';
    run = null;
    dungeonView = { page: 'world', worldId: wid, diff };
    render();
    if (cleared) toast('关卡完成！', 2200);
  }
  function fightCorridor() {
    const S = C().S;
    // 主角必上阵，无需检查
    const floor = S.corridor.floor;
    const spec = D.corridorEnemy(floor);
    const allies = buildAllies();
    const enemies = [spec];
    if (spec.isBoss) enemies.push({ name: '回廊之影', hp: Math.round(spec.hp * 0.3), atk: Math.round(spec.atk * 0.5), def: Math.round(spec.def * 0.5), spd: 70, faction: null, eva: 0.05 });
    startBattle({
      title: `无限回廊 · 第 ${floor} 层`,
      allies, enemies, worldId: null,
      maxRounds: spec.isBoss ? 50 : 30,
      onEnd(win, res) {
        if (!win) return { rewards: [], sub: `止步于第 ${floor} 层`, after: () => {} };
        const rw = D.corridorReward(floor);
        C().addCur('points', rw.points);
        C().addCur('story', rw.story);
        C().addCur('corridor', rw.corridor);
        if (rw.bloodCrystal) C().addCur('bloodCrystal', rw.bloodCrystal);
        window.Core.addCharExp(C().S.party.filter(Boolean), 50 + floor * 5);
        C().addPlayerExp(30 + floor * 3);
        C().battleSettle({}, true, spec.isBoss);
        S.corridor.floor++;
        S.corridor.best = Math.max(S.corridor.best, floor);
        S.stats.bestFloor = S.corridor.best;
        C().save();
        return {
          rewards: [`◈+${rw.points}`, `❖+${rw.story}`, `♜+${rw.corridor}`].concat(rw.bloodCrystal ? [`❥+${rw.bloodCrystal}`] : []),
          sub: `进入第 ${floor + 1} 层`,
          after: () => render(),
        };
      },
    });
  }

  /* ================= 界面事件绑定 ================= */
  function bindScreen() {
    const root = $view();
    root.querySelectorAll('[data-act]').forEach(el => el.onclick = () => {
      const act = el.dataset.act;
      const S = C().S;
      switch (act) {
        case 'claim-idle': {
          const g = C().claimIdle();
          modal('挂机收益', `
            <div style="text-align:center;padding:6px 0 12px">
              <div style="font-size:12px;color:var(--dim)">本次挂机 ${formatDuration(g.seconds)}</div>
              <div class="reward-chips" style="margin-top:12px">
                <span class="reward-chip">◈+${fmt(g.points)}</span>
                <span class="reward-chip">EXP+${fmt(g.exp)}</span>
                ${g.otherworld ? `<span class="reward-chip">◆+${g.otherworld}</span>` : ''}
                ${g.story ? `<span class="reward-chip">❖+${g.story}</span>` : ''}
              </div>
            </div>`, { center: true });
          render();
          break;
        }
        case 'open-recruit': recruitModal(); break;
        case 'open-shop': shopModal('god'); break;
        case 'open-buildings': buildingsModal(); break;
        case 'open-tasks': tasksModal(); break;
        case 'open-genelock': geneLockModal(); break;
        case 'open-reincarn': reincarnModal(); break;
        case 'open-bag': bagModal(); break;
        case 'open-settings': settingsModal(); break;
        case 'claim-quest': {
          const cur = C().currentQuest();
          if (cur) {
            const r = C().claimQuest(cur.q.id);
            if (r.ok) {
              toast(`完成主线【${cur.q.name}】`, 2200);
              const next = C().currentQuest();
              if (next && next.q.unlock) {
                setTimeout(() => modal('🔓 新功能解锁', `<div style="text-align:center;padding:10px;font-size:14px">${next.q.unlock.split(',').map(id => (D.UNLOCKS.find(u => u.id === id) || {}).name).filter(Boolean).join(' · ')} 已解锁！</div>`, { center: true }), 400);
              }
            }
          }
          render();
          break;
        }
        case 'goto-quest': {
          const cur = C().currentQuest();
          if (!cur) break;
          const map = {
            q01: 'chars', q02: 'dungeon', q03: 'home', q04: 'party', q05: 'dungeon',
            q06: 'dungeon', q07: 'equip', q08: 'dungeon', q09: 'home', q10: 'dungeon',
            q11: 'dungeon', q12: 'dungeon', q13: 'chars', q14: 'dungeon', q15: 'dungeon',
          };
          setTab(map[cur.q.id] || 'dungeon');
          if (cur.q.id === 'q03') setTimeout(() => recruitModal(), 250);
          if (cur.q.id === 'q09') setTimeout(() => buildingsModal(), 250);
          if (cur.q.id === 'q11') setTimeout(() => { dungeonView = { page: 'corridor' }; render(); }, 250);
          break;
        }
        case 'open-corridor':
          if (!C().isUnlocked('corridor')) { toast('🔒 ' + C().unlockTip('corridor')); break; }
          dungeonView = { page: 'corridor' }; render(); break;
        case 'open-corridor-shop': shopModal('corridor'); break;
        case 'fight-corridor': fightCorridor(); break;
        case 'back-worlds': dungeonView = { page: 'worlds' }; run = null; render(); break;
        case 'abandon-run': run = null; dungeonView = { page: 'world', worldId: dungeonView.worldId, diff: dungeonView.diff }; render(); break;
        case 'sweep': {
          const st = S.worlds[dungeonView.worldId].stages[dungeonView.diff];
          let last = 0;
          st.forEach((s, i) => { if (s > 0) last = i; });
          const r = window.Dungeon.sweep(dungeonView.worldId, dungeonView.diff, last + 1, 10);
          if (!r.ok) { toast(r.msg); break; }
          const agg = {};
          r.total.forEach(t => t.got.forEach(g => {
            if (g.k === 'equip') { agg._equips = (agg._equips || 0) + 1; }
            else agg[g.k] = (agg[g.k] || 0) + g.v;
          }));
          const chips = Object.entries(agg).filter(([k]) => k !== '_equips').map(([k, v]) => k === 'exp' ? `EXP+${fmt(v)}` : `${curIcon(k)}+${fmt(v)}`);
          if (agg._equips) chips.push(`🗡装备×${agg._equips}`);
          modal('扫荡结果（×10）', `<div class="reward-chips" style="margin:10px 0">${chips.map(c => `<span class="reward-chip">${c}</span>`).join('')}</div>`, { center: true });
          refresh();
          break;
        }
      }
    });
    root.querySelectorAll('[data-locked]').forEach(el => el.onclick = () => {
      toast('🔒 ' + C().unlockTip(el.dataset.locked), 2200);
    });
    root.querySelectorAll('[data-world]').forEach(el => el.onclick = () => {
      const S = C().S;
      const w = S.worlds[el.dataset.world];
      if (!w || !w.unlocked) { toast('通关上一世界后解锁'); return; }
      dungeonView = { page: 'world', worldId: el.dataset.world, diff: 'normal' };
      render();
    });
    root.querySelectorAll('[data-diff]').forEach(el => el.onclick = () => {
      dungeonView.diff = el.dataset.diff;
      render();
    });
    root.querySelectorAll('[data-stage]').forEach(el => el.onclick = () => {
      startRun(dungeonView.worldId, dungeonView.diff, +el.dataset.stage);
    });
    root.querySelectorAll('[data-node]').forEach(el => el.onclick = () => {
      const type = el.dataset.node;
      if (!run) return;
      if (type === 'combat' || type === 'elite') {
        const enemies = window.Dungeon.makeEnemies(run.worldId, run.diff, run.stage, type);
        battlePreview(enemies, type === 'elite' ? '精英伏击 · 敌情' : '遭遇战 · 敌情', () => {
          doNodeBattle(type, () => { run.step++; render(); }, enemies);
        });
      } else if (type === 'event') {
        const ev = run.route.events[run.step % run.route.events.length];
        showEvent(ev, () => { run.step++; render(); });
      } else if (type === 'chest') {
        const r = window.Dungeon.nodeReward('chest', run.worldId, run.diff, run.stage);
        const chips = [`◈+${fmt(r.points)}`];
        if (r.equip) chips.push(`<span class="rtext-${r.equip.rarity}">🗡${r.equip.name}</span>`);
        if (r.sold) chips.push(`◆+${r.gain}(自动分解)`);
        modal('补给宝箱', `<div class="reward-chips" style="margin:10px 0">${chips.map(c => `<span class="reward-chip">${c}</span>`).join('')}</div>`, { center: true });
        run.step++;
        render(); refresh();
      } else if (type === 'heal') {
        Object.keys(run.hpPct).forEach(id => { run.hpPct[id] = Math.min(1, run.hpPct[id] + 0.3); });
        toast('全队恢复 30% 生命');
        run.step++;
        render();
      }
    });
    root.querySelectorAll('[data-final]').forEach(el => el.onclick = () => {
      const enemies = window.Dungeon.makeEnemies(run.worldId, run.diff, run.stage, run.route.finalKind);
      const w = D.WORLDS.find(x => x.id === run.worldId);
      battlePreview(enemies, run.route.finalKind === 'boss' ? `👹 ${w.boss} · 敌情` : '区域决战 · 敌情', () => {
        doFinalBattle(enemies);
      });
    });
    root.querySelectorAll('[data-potion]').forEach(el => el.onclick = () => {
      if (!run) return;
      const id = el.dataset.potion;
      const pct = { heal_s: 0.2, heal_m: 0.4, heal_l: 0.7 }[id] || 0;
      if (!pct) return;
      if (!C().removeItem(id)) { toast('道具不足'); return; }
      Object.keys(run.hpPct).forEach(cid => { run.hpPct[cid] = Math.min(1, run.hpPct[cid] + pct); });
      C().task('item1', 1);
      C().save();
      toast(`🧪 ${D.ITEMS[id].name}：全队恢复 ${pct * 100}% 生命`);
      render();
    });
    root.querySelectorAll('[data-slot]').forEach(el => el.onclick = () => pickPartyChar(+el.dataset.slot));
    root.querySelectorAll('[data-protag]').forEach(el => el.onclick = () => protagonistDetail());
    root.querySelectorAll('[data-remove]').forEach(el => el.onclick = ev => {
      ev.stopPropagation();
      const S = C().S;
      const idx = S.party.indexOf(el.dataset.remove);
      if (idx >= 0) { S.party[idx] = null; C().save(); render(); }
    });
    root.querySelectorAll('[data-char]').forEach(el => el.onclick = () => charDetail(el.dataset.char));
    root.querySelectorAll('[data-eqd]').forEach(el => el.onclick = () => equipDetail(el.dataset.eqd));
    root.querySelectorAll('[data-filter]').forEach(el => el.onclick = () => { charFilter = el.dataset.filter; render(); });
    root.querySelectorAll('[data-efilter]').forEach(el => el.onclick = () => { equipFilter = el.dataset.efilter; render(); });
    root.querySelectorAll('[data-autosell]').forEach(el => el.onchange = () => {
      C().S.settings['autoSell' + el.dataset.autosell] = el.checked;
      C().save();
    });
  }

  /* ================= 启动辅助 ================= */
  /* ================= GM 调试面板（隐藏入口：设置页连点版本号7次） ================= */
  function gmModal() {
    const S = C().S;
    const w = modal('🛠 GM 调试面板', `
      <div style="font-size:11px;color:var(--accent);margin-bottom:10px">仅用于开发测试，滥用会破坏游戏乐趣</div>
      <div class="grid2">
        <button class="btn small" data-gm="cur">货币 +10000（晶石+5000）</button>
        <button class="btn small" data-gm="unlocks">解锁全部功能</button>
        <button class="btn small" data-gm="worlds">解锁全部世界</button>
        <button class="btn small" data-gm="clearworld">当前世界普通全通</button>
        <button class="btn small" data-gm="plvup">主角(玩家) Lv+10</button>
        <button class="btn small" data-gm="lvup">全体角色 Lv+10</button>
        <button class="btn small" data-gm="skill">全体技能升满</button>
        <button class="btn small" data-gm="equip">获得 5 件 SSR 装备</button>
        <button class="btn small" data-gm="gene">基因锁 +1 阶</button>
        <button class="btn small" data-gm="floor">回廊 +10 层</button>
        <button class="btn small" data-gm="recruit">✦ +900（十连）</button>
      </div>
      <div style="font-size:11px;color:var(--dim);margin-top:12px">玩家Lv.${S.player.level} · 基因锁${S.player.geneLock} · 回廊${S.corridor.floor}层 · 角色${Object.keys(S.chars).length}</div>
    `);
    w.querySelectorAll('[data-gm]').forEach(b => b.onclick = () => {
      const act = b.dataset.gm;
      const Core = C();
      if (act === 'cur') {
        ['points', 'story', 'otherworld', 'skillChip', 'bloodCrystal', 'corridor'].forEach(k => Core.addCur(k, 10000));
        Core.addCur('holy', 5000);
      } else if (act === 'unlocks') {
        D.UNLOCKS.forEach(u => { S.unlocks[u.id] = true; });
      } else if (act === 'worlds') {
        D.WORLDS.forEach(x => Core.unlockWorld(x.id));
      } else if (act === 'clearworld') {
        const wid = (dungeonView && dungeonView.worldId) || 'W01';
        Core.unlockWorld(wid);
        S.worlds[wid].stages.normal = Array(12).fill(3);
        Core.refreshUnlocks();
      } else if (act === 'lvup') {
        Object.values(S.chars).forEach(c => { c.lv = Math.min(100, c.lv + 10); });
      } else if (act === 'plvup') {
        S.player.level = Math.min(100, S.player.level + 10);
      } else if (act === 'skill') {
        Object.values(S.chars).forEach(c => { c.skillLv = [10, 10, 10]; });
      } else if (act === 'equip') {
        for (let i = 0; i < 5; i++) Core.grantEquip('W01', 'SSR');
      } else if (act === 'gene') {
        if (S.player.geneLock < 5) S.player.geneLock++;
      } else if (act === 'floor') {
        S.corridor.floor += 10;
        S.corridor.best = Math.max(S.corridor.best, S.corridor.floor - 1);
      } else if (act === 'recruit') {
        Core.addCur('holy', 900);
      }
      Core.save();
      toast('GM: ' + b.textContent + ' 完成');
      refresh(); render();
    });
  }

  function showOfflineGains(g) {
    if (g.cheat) {
      modal('⚠ 时间异常', `<div class="event-desc">检测到系统时间被修改，本次离线收益已取消。</div>`, { center: true, sticky: true });
      return;
    }
    if (!g) return;
    modal('欢迎回来，轮回者', `
      <div style="text-align:center;padding:6px 0 12px">
        <div style="font-size:13px;color:var(--dim)">离线 ${formatDuration(g.seconds)}（效率 ${Math.round(g.efficiency * 100)}%）</div>
        <div class="reward-chips" style="margin-top:14px">
          <span class="reward-chip">◈+${fmt(g.gains.points)}</span>
          <span class="reward-chip">EXP+${fmt(g.gains.exp)}</span>
          ${g.gains.otherworld ? `<span class="reward-chip">◆+${g.gains.otherworld}</span>` : ''}
          ${g.gains.story ? `<span class="reward-chip">❖+${g.gains.story}</span>` : ''}
        </div>
      </div>`, { center: true });
    if (g.gains.points) {
      // 离线收益直接入库
      const S = C().S;
      C().addCur('points', g.gains.points);
      C().addCur('otherworld', g.gains.otherworld);
      C().addCur('story', g.gains.story);
      C().addPlayerExp(g.gains.exp);
      C().save();
    }
    refresh();
  }
  function showLoginReward(r) {
    if (!r) return;
    const rw = r.reward.ssrTicket ? '🎫 SSR自选券' : Object.entries(r.reward).map(([k, v]) => k === 'item' ? `🎁${D.ITEMS[v].name}` : `${curIcon(k)}+${v}`).join(' ');
    modal(`七日登录 · 第 ${r.day} 天`, `
      <div style="text-align:center;padding:10px 0">
        <div style="font-size:34px;margin-bottom:8px">${['🌑','🌒','🌓','🌔','🌕','🌖','🌗'][r.day - 1]}</div>
        <div style="font-size:14px">今日奖励</div>
        <div class="reward-chips" style="margin-top:10px"><span class="reward-chip" style="font-size:14px">${rw}</span></div>
      </div>`, { center: true });
  }
  function showTutorial() {
    const w = modal('欢迎来到主神空间', `
      <div class="event-desc">
        你被神秘存在选中，成为了<b style="color:var(--accent)">轮回者</b>。<br><br>
        在这里，你将：<br>
        🌀 进入恐怖世界执行轮回任务<br>
        👥 招募轮回者，组建五人小队（主角必上阵）<br>
        🧬 解锁血统与基因锁，突破极限<br>
        ♾ 挑战无限回廊，寻找离开的方法<br><br>
        新手补给已发放：◈50,000 · ✦1,000 · 经验模块×20 · 治疗剂×10<br><br>
        <b>如果下一场轮回真的会死，你会带谁进去？</b>
      </div>
      <button class="btn primary block" style="margin-top:12px" data-start>签订轮回契约</button>
    `, { sticky: true, center: true });
    w.querySelector('[data-start]').onclick = () => { closeModal(w); showCharCreate(); };
  }
  const RANDOM_NAMES = ['夜行者', '渡鸦', '白泽', '北辰', '惊蛰', '拾荒者', '阿岚', '无常', '青槐', '孤鸿', '墨白', '临渊'];
  function showCharCreate() {
    const w = modal('创建你的轮回者', `
      <div class="event-desc" style="margin-bottom:12px">主神需要一个名字来记录你的轮回。这个名字将伴随你进入每一个世界。</div>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <input id="cc-name" maxlength="12" placeholder="输入你的名字（12字内）" style="flex:1;background:var(--panel);border:1px solid var(--line);border-radius:10px;color:var(--text);padding:12px;font-size:15px;outline:none" />
        <button class="btn" data-dice style="flex:0 0 auto">🎲</button>
      </div>
      <button class="btn primary block" data-confirm>以这个名字进入轮回</button>
    `, { sticky: true, center: true });
    const input = w.querySelector('#cc-name');
    const roll = () => { input.value = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]; };
    roll();
    w.querySelector('[data-dice]').onclick = roll;
    const confirmName = () => {
      if (!C().setPlayerName(input.value)) { toast('请输入名字'); return; }
      closeModal(w);
      refresh(); render();
      toast(`欢迎你，${C().S.player.name}`, 2500);
    };
    w.querySelector('[data-confirm]').onclick = confirmName;
    input.onkeydown = ev => { if (ev.key === 'Enter') confirmName(); };
    setTimeout(() => input.focus(), 300);
  }

  return {
    init() { refresh(); render(); },
    render, refresh, toast, modal, closeModal,
    showOfflineGains, showLoginReward, showTutorial, showCharCreate,
    tickIdle() {
      if (curTab !== 'home') return;
      const timeEl = document.getElementById('idle-time');
      if (!timeEl) return;
      const bank = C().idleBankGains();
      timeEl.textContent = formatDuration(bank.seconds);
      const gainsEl = document.getElementById('idle-gains');
      if (gainsEl) gainsEl.textContent = `◈${fmt(bank.points)} · EXP ${fmt(bank.exp)}${bank.otherworld ? ` · ◆${bank.otherworld}` : ''}${bank.story ? ` · ❖${bank.story}` : ''}`;
      const btn = document.getElementById('idle-claim-btn');
      if (btn && bank.seconds >= 60 && btn.disabled) btn.disabled = false;
    },
    get tab() { return curTab; },
    _setTab: setTab,
  };
})();
