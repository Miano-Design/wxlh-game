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
    wrap._onClose = opts.onClose || null;
    wrap.querySelector('.close-x').onclick = () => closeModal(wrap);
    wrap.querySelector('.modal-mask').onclick = () => { if (!opts.sticky) closeModal(wrap); };
    return wrap;
  }
  function closeModal(wrap) {
    wrap = wrap || modalStack[modalStack.length - 1];
    if (!wrap) return;
    modalStack = modalStack.filter(w => w !== wrap);
    wrap.remove();
    if (wrap._onClose) wrap._onClose();
  }
  function closeAllModals() { modalStack.forEach(w => w.remove()); modalStack = []; }
  // 重开弹窗时保持滚动位置（加点/穿装备等连续操作不跳顶）
  function modalScroll(w) { const sb = w.querySelector('.sheet-body'); return sb ? sb.scrollTop : 0; }
  function restoreModalScroll(w, st) { if (st) { const sb = w.querySelector('.sheet-body'); if (sb) sb.scrollTop = st; } }
  // 原地刷新弹窗内容：不重建遮罩与面板，避免闪屏，保留滚动位置
  // 所有"操作后重新打开同一个弹窗"的地方都必须走这里，禁止 closeModal + 重新 modal()
  function updateModal(w, title, bodyHtml, keepScroll) {
    const sb = w.querySelector('.sheet-body');
    const st = keepScroll === false ? 0 : (sb ? sb.scrollTop : 0);
    if (title !== undefined) w.querySelector('.sheet-head h3').textContent = title;
    if (sb) { sb.innerHTML = bodyHtml; sb.scrollTop = st; }
    return w;
  }
  // 有 wrap 就原地刷新，没有就新建弹窗；返回弹窗元素
  function showPanel(wrap, title, bodyHtml, keepScroll) {
    if (wrap) return updateModal(wrap, title, bodyHtml, keepScroll);
    return modal(title, bodyHtml);
  }
  function confirmBox(title, text, onOk) {
    const w = modal(title, `
      <div style="color:var(--dim);font-size:13px;line-height:1.7;margin-bottom:14px">${text}</div>
      <div class="btn-row"><button class="btn ghost" data-x>取消</button><button class="btn primary" data-ok>确定</button></div>
    `, { center: true });
    w.querySelector('[data-x]').onclick = () => closeModal(w);
    w.querySelector('[data-ok]').onclick = () => { closeModal(w); onOk(); };
  }

  /* ================= 货币图鉴 / 玩法指南 ================= */
  function currencyModal(focusId, wrap, backFn) {
    const S = C().S;
    const body = `
      <div style="font-size:12px;color:var(--dim);line-height:1.7;margin-bottom:10px">
        每种货币只干一件事。拿不准该花哪个，就看下面这张表——「用途」写的是它能买什么，「来源」写的是去哪刷。
      </div>
      ${D.CURRENCIES.map(c => {
        const info = D.CURRENCY_INFO[c.id] || {};
        return `<div class="card" id="cur-${c.id}" style="margin-bottom:8px;${focusId === c.id ? 'border-color:' + c.color : ''}">
          <h3><span style="color:${c.color}">${c.icon}</span> ${c.name}
            <span class="sub">持有 ${fmt(S.cur[c.id] || 0)}</span></h3>
          <div style="font-size:12px;line-height:1.75"><b style="color:var(--gold)">用途</b>：${info.use || '—'}</div>
          <div style="font-size:12px;line-height:1.75;color:var(--dim)"><b>来源</b>：${info.gain || '—'}</div>
        </div>`;
      }).join('')}`;
    const w = showPanel(wrap, '货币图鉴', body + `<button class="btn ghost block" style="margin-top:6px" data-back>‹ 返回</button>`);
    w.querySelector('[data-back]').onclick = () => { if (backFn) backFn(w); else closeModal(w); };
    if (focusId) {
      const el = w.querySelector('#cur-' + focusId);
      if (el) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
    }
    return w;
  }
  function guideModal(chapterId, wrap) {
    const body = D.GUIDE_CHAPTERS.map(ch => `
      <div class="card" id="guide-${ch.id}" style="margin-bottom:8px">
        <h3>${ch.title}</h3>
        ${ch.body.map(line => `<div style="font-size:12px;line-height:1.85;color:var(--text)">· ${line}</div>`).join('')}
      </div>`).join('')
      + `<div class="card" style="background:var(--panel2)"><h3>📖 看不懂就点这里</h3>
        <div style="font-size:12px;color:var(--dim);line-height:1.8">任何一屏里有「?」或小字说明的地方，都可以点开看解释；货币、道具也都能点开看用途。</div>
        <button class="btn small block" style="margin-top:8px" data-curdoc>▤ 打开货币图鉴</button></div>`;
    const w = showPanel(wrap, '玩法指南', body);
    w.querySelector('[data-curdoc]').onclick = () => currencyModal(null, w, w2 => guideModal(null, w2));
    if (chapterId) {
      const el = w.querySelector('#guide-' + chapterId);
      if (el) setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 80);
    }
    return w;
  }
  // 角色图鉴：收集进度 + 里程碑奖励 + 全角色一览
  function codexModal(wrap) {
    const S = C().S;
    const cs = C().codexState();
    const body = `
      <div class="card" style="margin-bottom:10px">
        <h3>收集进度 <span class="sub">${cs.owned} / ${cs.total}</span></h3>
        <div class="bar exp" style="margin:6px 0 10px"><i style="width:${Math.min(100, cs.owned / cs.total * 100)}%"></i></div>
        ${cs.rewards.map(r => `<div class="list-row" style="${r.claimed ? 'opacity:.5' : ''}">
          <div class="grow"><div class="t1">收集 ${r.n} 名角色</div>
          <div class="t2">${Object.entries(r.reward).map(([k, v]) => `${curIcon(k)}${v}`).join(' · ')}</div></div>
          ${r.claimed ? '<button class="btn small" disabled>已领</button>'
            : r.reached ? `<button class="btn small primary" data-codex="${r.n}">领取</button>`
            : `<button class="btn small" disabled>还差 ${r.n - cs.owned}</button>`}
        </div>`).join('')}
      </div>
      <div class="section-title">全部角色（${cs.total}）</div>
      <div class="char-grid">
        ${D.characters.map(ch => {
          const got = S.codex.chars.includes(ch.id);
          if (!got) return `<div class="char-card" style="opacity:.35;filter:grayscale(1)">
            <div class="avatar">？</div><div class="cname">未获得</div><div class="cmeta">${ch.rarity}</div>
          </div>`;
          return `<div class="char-card rarity-${ch.rarity}">
            ${charAvatar(ch.id)}
            <div class="cname">${esc(ch.name)}</div>
            <div class="cmeta">${ch.role} · ${ch.faction}</div>
          </div>`;
        }).join('')}
      </div>`;
    const w = showPanel(wrap, '角色图鉴', body);
    w.querySelectorAll('[data-codex]').forEach(b => b.onclick = () => {
      const r = C().claimCodexReward(+b.dataset.codex);
      toast(r.msg);
      codexModal(w); renderTopbar();
    });
    return w;
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
    const main = D.CURRENCIES.filter(c => ['points', 'holy', 'otherworld'].includes(c.id));
    bar.innerHTML = main.map(c => `<button class="cur-chip" data-cur="${c.id}" title="${c.name}·查看用途"><span style="color:${c.color}">${c.icon}</span><b>${fmt(S.cur[c.id])}</b></button>`).join('')
      + `<button class="cur-chip more" data-cur="__all">▤ 货币</button>`;
    bar.querySelectorAll('[data-cur]').forEach(el => {
      el.onclick = () => currencyModal(el.dataset.cur === '__all' ? null : el.dataset.cur);
    });
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

  /* ================= 新手高亮引导 ================= */
  function coachmark(selector, text) {
    setTimeout(() => {
      const el = document.querySelector(selector);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => {
        const old = document.querySelector('.coach-overlay');
        if (old) old.remove();
        const r = el.getBoundingClientRect();
        const ov = document.createElement('div');
        ov.className = 'coach-overlay';
        const tipTop = r.bottom + 150 > innerHeight ? r.top - 130 : r.bottom + 14;
        ov.innerHTML = `
          <div class="coach-box" style="left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px"></div>
          <div class="coach-tip" style="left:${Math.max(12, Math.min(r.left, innerWidth - 292))}px;top:${Math.max(12, tipTop)}px">
            <div style="font-size:13px;line-height:1.6">${text}</div>
            <button class="btn small primary" style="margin-top:10px">知道了</button>
          </div>`;
        ov.onclick = () => ov.remove();
        document.body.appendChild(ov);
      }, 420);
    }, 280);
  }
  function refresh() { renderTopbar(); renderNavbar(); }
  function setTab(id) {
    curTab = id;
    dungeonView = { page: 'worlds' };
    batchMode = false; batchSel.clear();
    screenEnter = true;
    refresh();
    render();
  }
  let screenEnter = false;
  function render() {
    const fn = { home: homeScreen, dungeon: dungeonScreen, party: partyScreen, chars: charsScreen, equip: equipScreen }[curTab];
    // 切页签回到顶部；同一页内的操作保留滚动位置，避免"点一下跳回顶部"
    const keepScroll = !screenEnter;
    const scrollY = (typeof window !== 'undefined' && window.scrollY) || 0;
    $view().innerHTML = `<div class="screen${screenEnter ? ' enter' : ''}">${fn()}</div>`;
    screenEnter = false;
    // 副本探索中隐藏底部导航，防止误触丢失进度
    const inRun = curTab === 'dungeon' && dungeonView.page === 'run';
    document.getElementById('navbar').style.display = inRun ? 'none' : '';
    bindScreen();
    refresh();
    if (keepScroll && scrollY > 0 && typeof window.scrollTo === 'function') window.scrollTo(0, scrollY);
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
    <div class="grid2">
      ${featureBtn('open-recruit', '✦ 轮回者招募', 'recruit', C().isUnlocked('recruit') && C().freeRecruitAvailable())}
      ${featureBtn('open-shop', '🏪 兑换大厅', 'shop')}
      ${featureBtn('open-buildings', '🏗 基地建设', 'buildings')}
      ${featureBtn('open-tasks', '📋 任务', 'tasks')}
      ${featureBtn('open-genelock', '🧬 基因锁', 'geneLock')}
      ${featureBtn('open-reincarn', '♾ 转生', 'reincarn')}
      <button class="btn" data-act="open-bag">🧰 道具背包</button>
      <button class="btn" data-act="open-settings">⚙️ 设置存档</button>
      <button class="btn" data-act="open-guide">❓ 玩法指南</button>
    </div>
    ${questCard()}
    <div class="card">
      <h3>⏳ 轮回挂机 <span class="sub">${r.pointsPerMin.toFixed(1)} 点/分 · ${r.expPerMin.toFixed(1)} EXP/分</span></h3>
      <div class="kv"><span class="k">已累积</span><span id="idle-time">${formatDuration(bank.seconds)}</span></div>
      <div class="kv"><span class="k">待领取</span><span id="idle-gains">◈${fmt(bank.points)} · EXP ${fmt(bank.exp)}${bank.otherworld ? ` · ◆${bank.otherworld}` : ''}${bank.story ? ` · ❖${bank.story}` : ''}</span></div>
      <div class="kv"><span class="k">离线规则</span><span>效率 ${Math.round(C().offlineEfficiency() * 100)}% · 上限 ${C().offlineCapHours().toFixed(1)}小时</span></div>
      <button class="btn primary block" style="margin-top:10px" id="idle-claim-btn" data-act="claim-idle" ${bank.seconds < 60 ? 'disabled' : ''}>一键领取挂机收益</button>
    </div>`;
  }
  function featureBtn(act, label, unlockId, dot) {
    if (C().isUnlocked(unlockId)) return `<button class="btn" data-act="${act}">${label}${dot ? '<span class="dot"></span>' : ''}</button>`;
    return `<button class="btn" data-locked="${unlockId}" style="opacity:.5">🔒 ${label.replace(/^[^ ]+ /, '')}</button>`;
  }
  function questCard() {
    const list = C().mainQuestState();
    const idx = list.findIndex(x => !x.claimed);
    if (idx < 0) {
      return `<div class="card"><h3>📜 主线任务 <span class="sub">全部完成</span></h3>
        <div style="font-size:12px;color:var(--dim)">你已走完当前全部主线。继续挑战更高难度的世界与无限回廊吧。</div></div>`;
    }
    const cur = list[idx];
    const q = cur.q;
    const rewardText = Object.entries(q.reward).filter(([, v]) => v > 0).map(([k, v]) => `${curIcon(k)}${v}`).join(' ');
    return `<div class="card" style="border-color:#ffd76a55">
      <h3>📜 主线 · 第 ${idx + 1}/${list.length} 步 · ${q.name} <span class="sub">${rewardText}</span></h3>
      <div style="font-size:13px;color:var(--dim);margin-bottom:8px">${q.desc}</div>
      <div class="btn-row">
        ${cur.done ? '<button class="btn primary" data-act="claim-quest">领取奖励</button>' : '<button class="btn ghost" data-act="goto-quest">去完成 ›</button>'}
        <button class="btn small ghost" data-act="open-tasks">全部 ${list.length} 步 ›</button>
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
      ${canSweep ? `<button class="btn block" style="margin-top:12px" data-act="open-sweep" ${C().sweepLeft() <= 0 ? 'disabled' : ''}>⏩ 扫荡（可选关卡 · 今日剩余 ${C().sweepLeft()}/${D.SWEEP_DAILY_CAP} 次）</button>` : ''}
    `;
  }
  // 扫荡：可选关卡 + 可选次数
  function sweepModal(worldId, diff, wrap) {
    const S = C().S;
    const st = S.worlds[worldId] && S.worlds[worldId].stages;
    const cleared = ((st && st[diff]) || []).map((s, i) => ({ s, i })).filter(x => x.s > 0);
    if (!cleared.length) { toast('通关后才能扫荡'); return null; }
    let sel = cleared[cleared.length - 1].i;
    const w = showPanel(wrap, '扫荡', '');
    const draw = () => {
      const left = C().sweepLeft();
      updateModal(w, '扫荡', `
        <div class="kv"><span class="k">今日剩余次数</span><span>${left} / ${D.SWEEP_DAILY_CAP}</span></div>
        <div class="section-title">选择扫荡关卡（已通关）</div>
        <div class="stage-grid">${cleared.map(x => `<div class="stage-cell done" data-sstage="${x.i}" style="${x.i === sel ? 'border-color:var(--gold);color:var(--gold)' : ''}">${x.i + 1}<span class="st">${'★'.repeat(x.s)}</span></div>`).join('')}</div>
        <div class="section-title">扫荡次数</div>
        <div class="btn-row">
          ${[1, 5, 10].map(k => `<button class="btn small" data-stimes="${k}" ${left <= 0 ? 'disabled' : ''}>扫荡 ×${k}</button>`).join('')}
          <button class="btn small gold" data-stimes="0" ${left <= 0 ? 'disabled' : ''}>全部剩余（${left}）</button>
        </div>
        <div style="font-size:11px;color:var(--dim);margin-top:8px">奖励按所选关卡结算：Boss 关按 Boss 掉落，精英关按精英掉落。</div>`);
      bind();
    };
    const bind = () => {
      w.querySelectorAll('[data-sstage]').forEach(el => el.onclick = () => { sel = +el.dataset.sstage; draw(); });
      w.querySelectorAll('[data-stimes]').forEach(el => el.onclick = () => {
        const raw = +el.dataset.stimes;
        const times = raw === 0 ? C().sweepLeft() : raw;
        if (times <= 0) { toast('今日扫荡次数已用完'); return; }
        const r = window.Dungeon.sweep(worldId, diff, sel + 1, times);
        if (!r.ok) { toast(r.msg); return; }
        const agg = {};
        r.total.forEach(t => t.got.forEach(g => {
          if (g.k === 'equip') agg._equips = (agg._equips || 0) + 1;
          else if (g.k === 'item') agg._items = (agg._items || 0) + (g.n || 1);
          else agg[g.k] = (agg[g.k] || 0) + g.v;
        }));
        const chips = Object.entries(agg).filter(([k]) => k !== '_equips' && k !== '_items')
          .map(([k, v]) => k === 'exp' ? `EXP+${fmt(v)}` : `${curIcon(k)}+${fmt(v)}`);
        if (agg._equips) chips.push(`🗡装备×${agg._equips}`);
        if (agg._items) chips.push(`🎒道具×${agg._items}`);
        refresh(); renderTopbar();
        lootPanel(`扫荡结果（×${r.count}${r.capped ? ' · 已达上限' : ''}）`, chips.map(c => `<span class="reward-chip">${c}</span>`).join(''), () => draw(), w);
      });
    };
    draw();
    return w;
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
    // 探索中可用的消耗品：治疗剂（回血）与强化剂（本次探索增益）
    const bagItems = C().S.items;
    const consumables = Object.keys(D.ITEMS).filter(k => {
      const it = D.ITEMS[k];
      return it.type === 'consumable' && it.where === 'explore' && (bagItems[k] || 0) > 0;
    });
    const healList = consumables.filter(k => (D.ITEMS[k].effect || {}).healPct);
    const buffList = consumables.filter(k => !(D.ITEMS[k].effect || {}).healPct);
    const potionBtn = id => `<button class="btn small" data-potion="${id}">${(D.ITEMS[id].effect || {}).healPct ? '🧪' : '💉'} ${D.ITEMS[id].name} ×${bagItems[id]}</button>`;
    const potionBar = (healList.length || buffList.length) ? `
      <div style="margin-top:8px">
        ${healList.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${healList.map(potionBtn).join('')}</div>` : ''}
        ${buffList.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${buffList.map(potionBtn).join('')}</div>` : ''}
        <div style="font-size:10px;color:var(--dim);margin-top:5px">副本内使用 · 本场探索全程有效</div>
      </div>`
      : `<div style="font-size:10px;color:var(--dim);margin-top:8px">背包里还没有探索用道具（主神商店可买治疗剂 / 强化剂）</div>`;
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
      <div class="card">
        <h3>${WORLD_ICONS[w.theme]} ${w.name} · ${{ normal: '普通', hard: '困难', hell: '地狱' }[run.diff]} ${run.stage}/12</h3>
        <div class="route-progress">${prog}</div>
        <div style="display:flex;gap:6px">${partyHp}</div>
        ${potionBar}
        ${Object.keys(run.buffs).length ? `<div style="margin-top:8px;font-size:11px;color:var(--green)">探索增益：${Object.entries(run.buffs).map(([k, v]) => `${D.CONSUMABLE_TAG[k] || k}+${Math.round(v * 100)}%`).join(' ')}</div>` : ''}
      </div>
      ${mapHtml}
      ${body}
      <div style="height:84px"></div>
      <div class="run-bar"><button class="btn block" data-act="abandon-run">🚪 撤离副本（已获奖励保留）</button></div>`;
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
        }).join('') || `<div class="empty">还没有上阵任何角色。招募到的角色在这里上阵，前 2 后 2 共 4 位（主角必上阵）。</div>
          <button class="btn primary block" style="margin-top:10px" data-act="open-recruit">✦ 去招募角色</button>`}
      </div>`;
  }
  /* ================= 主角详情 ================= */
  function protagonistDetail(scrollTop, wrap) {
    const S = C().S;
    S.stats.profileViews = (S.stats.profileViews || 0) + 1; C().save(); // 主线 q01 熟悉身体
    const P = C().protagonistSkills();
    const st = C().effectivePlayerStats();
    const eq = S.equipped['@player'] || {};
    const gl = S.player.geneLock;
    const blCost = S.player.bloodline && S.player.bloodlineLv < D.BLOODLINE_MAX ? D.bloodlineCost(S.player.bloodlineLv) : null;
    const w = showPanel(wrap, `${cname('@player')}（主角）`, `
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
      <div class="section-title">六维属性 <span style="color:var(--gold)">可用点数 ${S.player.attrPoints || 0}</span></div>
      <div style="font-size:11px;color:var(--dim);margin-bottom:8px">每升 1 级获得 ${D.ATTR_POINTS_PER_LV} 点，每点 +${D.ATTR_POINT_VALUE} 维值</div>
      ${D.ATTR_META.map(a => `
        <div class="list-row">
          <div class="grow"><div class="t1">${a.name} <span style="color:var(--dim);font-size:11px">${a.desc}</span></div>
          <div class="t2">已分配 ${(S.player.attrs && S.player.attrs[a.id]) || 0} 点 → +${((S.player.attrs && S.player.attrs[a.id]) || 0) * D.ATTR_POINT_VALUE}</div></div>
          <button class="btn small" data-attr="${a.id}" data-n="1" ${(S.player.attrPoints || 0) > 0 ? '' : 'disabled'}>+1</button>
          <button class="btn small ghost" data-attr="${a.id}" data-n="10" ${(S.player.attrPoints || 0) >= 1 ? '' : 'disabled'}>+10</button>
        </div>`).join('')}
      <div class="section-title">${S.player.bloodline ? S.player.bloodline + '血统技能' : '技能'} <span style="color:var(--gold)">可用技能点 ${S.player.skillPoints || 0}</span></div>
      <div style="font-size:11px;color:var(--dim);margin-bottom:8px">每升 1 级获得 1 点技能点${S.player.bloodline ? '' : '；觉醒血统（Lv.' + D.BLOODLINE_UNLOCK_LV + '）后技能栏将替换为血统技能'}</div>
      ${[P.s1, P.s2, P.ult].map((sk, i) => `
        <div class="skill-row"><div class="sname">${['技能', '技能', '必杀'][i]}·${sk.name} <span class="tag">Lv.${(S.player.skillLv || [1, 1, 1])[i]}/10</span>
          <button class="btn small" data-pskill="${i}" style="float:right" ${(S.player.skillPoints || 0) > 0 && (S.player.skillLv || [1, 1, 1])[i] < 10 ? '' : 'disabled'}>+1</button></div>
        <div class="sdesc">${sk.desc}</div></div>`).join('')}
      <div class="skill-row"><div class="sname">被动·${P.passive.name}</div><div class="sdesc">${P.passive.desc}</div></div>
      <button class="btn small ghost" data-pskillreset="1" style="margin-top:6px">↺ 重置技能（返还全部技能点）</button>
      <div class="section-title">血统</div>
      ${S.player.bloodline ? `
        <div style="font-size:12px;margin-bottom:6px">${S.player.bloodline} Lv.${S.player.bloodlineLv}/${D.BLOODLINE_MAX} <span style="color:var(--dim);font-size:11px">${D.BLOODLINES[S.player.bloodline].desc}</span></div>
        ${blCost ? `<button class="btn small" data-pblup="1">血统升级（❥${blCost.bloodCrystal} + ◈${fmt(blCost.points)}）</button>` : '<div style="color:var(--gold);font-size:12px">已满级</div>'}
      ` : S.player.level < D.BLOODLINE_UNLOCK_LV ? `
        <div style="font-size:12px;color:var(--dim)">🔒 主角 Lv.${D.BLOODLINE_UNLOCK_LV} 觉醒血统（当前 Lv.${S.player.level}）</div>
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
    restoreModalScroll(w, scrollTop);
    const reopenSelf = () => { protagonistDetail(0, w); render(); };
    w.querySelectorAll('[data-attr]').forEach(b => b.onclick = () => {
      const r = C().allocateAttr(b.dataset.attr, +b.dataset.n);
      toast(r.msg);
      if (r.ok) reopenSelf();
    });
    w.querySelectorAll('[data-pskill]').forEach(b => b.onclick = () => {
      const r = C().allocateSkill(+b.dataset.pskill);
      toast(r.msg);
      if (r.ok) reopenSelf();
    });
    w.querySelector('[data-pskillreset]').onclick = () => {
      const r = C().resetSkills();
      toast(r.msg);
      if (r.ok) reopenSelf();
    };
    const blBtn = w.querySelector('[data-pblup]');
    if (blBtn) blBtn.onclick = () => {
      const r = C().upgradePlayerBloodline();
      toast(r.msg);
      if (r.ok) reopenSelf();
      renderTopbar();
    };
    w.querySelectorAll('[data-pbl]').forEach(b => b.onclick = () => {
      const r = C().choosePlayerBloodline(b.dataset.pbl);
      toast(r.msg, 2200);
      if (r.ok) reopenSelf();
    });
    w.querySelectorAll('[data-peqslot]').forEach(el => el.onclick = () => {
      const st = modalScroll(w);
      pickEquipFor('@player', el.dataset.peqslot, w2 => protagonistDetail(st, w2), w);
    });
    w.querySelectorAll('[data-punequip]').forEach(b => b.onclick = ev => {
      ev.stopPropagation();
      C().unequipItem('@player', b.dataset.punequip);
      reopenSelf();
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
        const oldId = S.party[slotIdx];
        S.party[slotIdx] = id;
        C().save();
        closeModal(w);
        render();
        toast(`${D.charById[id].name} 已上阵${oldId ? `（${D.charById[oldId].name} 已下阵）` : ''}`);
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
    const cs = C().codexState();
    return `
      <div class="pill-tabs">${filters.map(([k, n]) => `<div class="pill ${charFilter === k ? 'active' : ''}" data-filter="${k}">${n}</div>`).join('')}</div>
      <div style="display:flex;align-items:center;gap:8px;margin:2px 2px 8px">
        <div style="font-size:11px;color:var(--dim);flex:1">已收集 ${cs.owned}/${cs.total} · 拥有 ${owned.length}</div>
        <button class="btn small ghost" data-act="open-codex">📕 图鉴</button>
      </div>
      <div class="char-grid">${cards || `<div class="empty" style="grid-column:1/-1">还没有招募到任何角色</div>
        <button class="btn primary block" style="grid-column:1/-1" data-act="open-recruit">✦ 去招募角色</button>`}</div>`;
  }
  function charDetail(id, scrollTop, wrap) {
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
    const w = showPanel(wrap, `${cname(id)}`, `
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
    restoreModalScroll(w, scrollTop);
    const reopenSelf = () => { charDetail(id, 0, w); };
    w.querySelectorAll('[data-lvup]').forEach(b => b.onclick = () => {
      const r = C().levelUp(id, +b.dataset.lvup);
      toast(r.msg);
      reopenSelf(); renderTopbar();
    });
    w.querySelector('[data-starup]').onclick = () => {
      const r = C().starUp(id);
      toast(r.msg);
      if (r.ok) reopenSelf();
      renderTopbar();
    };
    w.querySelectorAll('[data-skillup]').forEach(b => b.onclick = () => {
      const r = C().skillUp(id, +b.dataset.skillup);
      toast(r.msg);
      if (r.ok) reopenSelf();
      renderTopbar();
    });
    w.querySelector('[data-blup]').onclick = () => {
      const r = C().bloodlineUpgrade(id);
      toast(r.msg);
      if (r.ok) reopenSelf();
      renderTopbar();
    };
    const expBtn = w.querySelector('[data-expitem]');
    if (expBtn) expBtn.onclick = () => pickExpItem(id, w);
    w.querySelectorAll('[data-eqslot]').forEach(el => el.onclick = () => {
      const st = modalScroll(w);
      pickEquipFor(id, el.dataset.eqslot, w2 => charDetail(id, st, w2), w);
    });
    w.querySelectorAll('[data-unequip]').forEach(b => b.onclick = ev => {
      ev.stopPropagation();
      C().unequipItem(id, b.dataset.unequip);
      reopenSelf();
    });
    return w;
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
  function pickExpItem(id, wrap) {
    const S = C().S;
    const items = Object.entries(S.items).filter(([k]) => D.ITEMS[k] && D.ITEMS[k].type === 'exp');
    const w = showPanel(wrap, '使用经验道具', `
      <div style="font-size:12px;color:var(--dim);margin-bottom:10px">给 <b>${cname(id)}</b> 喂经验模块，可一次喂多个。</div>
      ${items.map(([k, n]) => `
      <div class="list-row">
        <div class="grow"><div class="t1">${D.ITEMS[k].name}</div><div class="t2">+${fmt(D.ITEMS[k].exp)} EXP · 拥有 ${n}</div></div>
        <button class="btn small" data-use="${k}" data-n="1">用 1</button>
        <button class="btn small" data-use="${k}" data-n="10" ${n >= 10 ? '' : 'disabled'}>用 10</button>
        <button class="btn small gold" data-use="${k}" data-n="0">全用</button>
      </div>`).join('') || '<div class="empty">没有经验道具</div>'}
      <button class="btn ghost block" style="margin-top:12px" data-back>‹ 返回角色</button>`);
    w.querySelector('[data-back]').onclick = () => charDetail(id, 0, w);
    w.querySelectorAll('[data-use]').forEach(b => b.onclick = () => {
      const want = +b.dataset.n;
      const cnt = want === 0 ? (S.items[b.dataset.use] || 0) : want;
      const r = C().useExpItem(id, b.dataset.use, cnt);
      toast(r.msg);
      renderTopbar();
      pickExpItem(id, w);
    });
    return w;
  }
  // 与当前穿戴对比：新装备 - 旧装备，正数绿、负数红
  function equipDelta(curEq, newEq) {
    if (!curEq) return '';
    const a = C().equipStats(curEq), b = C().equipStats(newEq);
    const parts = [];
    [['atk', '攻'], ['def', '防'], ['hp', '血'], ['spd', '速']].forEach(([k, label]) => {
      const d = (b.flat[k] || 0) - (a.flat[k] || 0);
      if (Math.abs(d) < 0.5) return;
      parts.push(`<span style="color:${d > 0 ? 'var(--green)' : 'var(--accent)'}">${label}${d > 0 ? '+' : '-'}${Math.round(Math.abs(d))}</span>`);
    });
    Object.keys(Object.assign({}, a.affix, b.affix)).forEach(k => {
      const d = ((b.affix[k] || 0) - (a.affix[k] || 0)) * 100;
      if (Math.abs(d) < 0.05) return;
      const nm = (D.AFFIX_POOL[k] || {}).name || k;
      parts.push(`<span style="color:${d > 0 ? 'var(--green)' : 'var(--accent)'}">${nm}${d > 0 ? '+' : '-'}${Math.abs(d).toFixed(1)}%</span>`);
    });
    return parts.length ? parts.join(' ') : '<span style="color:var(--dim)">与当前持平</span>';
  }
  function pickEquipFor(charId, slot, back, wrap) {
    const S = C().S;
    const allowed = charId === '@player' ? D.PLAYER_SLOTS : D.RECRUIT_SLOTS;
    // 只列出该角色能穿的：过滤他人专属与非本职业/血统的套装
    const list = C().inventoryEquips().filter(e => e.slot === slot && allowed.includes(e.slot) && C().canEquip(charId, e));
    const backFn = back || (w2 => charDetail(charId, 0, w2));
    const curUid = (S.equipped[charId] || {})[slot];
    const curEq = curUid && S.equips[curUid];
    const w = showPanel(wrap, `选择${D.EQUIP_SLOTS[slot]}（${cname(charId)}）`, `
      ${curEq ? `<div style="font-size:11px;color:var(--dim);margin-bottom:8px">当前：<span class="rtext-${curEq.rarity}">${curEq.name} +${curEq.enhance}</span> · 下面是换成这件之后的属性变化</div>`
        : `<div style="font-size:11px;color:var(--dim);margin-bottom:8px">该部位还没有装备，装上即为净收益</div>`}
      ${list.map(eq => {
      const equippedBy = Object.entries(S.equipped).find(([cid, slots]) => slots[slot] === eq.uid);
      return `<div class="list-row" data-eq="${eq.uid}" style="cursor:pointer">
        <div class="grow"><div class="t1 rtext-${eq.rarity}">${eq.name} +${eq.enhance} ${equipCatTag(eq)}</div>
        <div class="t2">${equipBrief(eq)}${equippedBy ? ` · ${cname(equippedBy[0])}装备中` : ''}</div>
        ${eq.uid === curUid ? '<div class="t2" style="color:var(--gold)">当前穿戴中</div>' : (list.length && curEq ? `<div class="t2">对比：${equipDelta(curEq, eq)}</div>` : '')}</div>
      </div>`;
    }).join('') || '<div class="empty">背包中没有该角色可穿戴的此部位装备</div>'}
      <button class="btn ghost block" style="margin-top:12px" data-back>‹ 返回角色</button>`);
    w.querySelector('[data-back]').onclick = () => backFn(w);
    w.querySelectorAll('[data-eq]').forEach(el => el.onclick = () => {
      if (C().equipItem(charId, el.dataset.eq)) toast('已装备');
      else toast('该角色无法穿戴此装备');
      backFn(w);
    });
    return w;
  }

  /* ================= 装备页 ================= */
  let equipFilter = 'all';
  let equipCatFilter = 'all';
  let batchMode = false;
  const batchSel = new Set();
  function equippedUidSet(S) {
    const s = new Set();
    Object.values(S.equipped).forEach(sl => Object.values(sl).forEach(u => u && s.add(u)));
    return s;
  }
  function batchGain() {
    const S = C().S;
    let gain = 0;
    batchSel.forEach(uid => { const e = S.equips[uid]; if (e) gain += D.DECOMPOSE_GAIN[e.rarity] + Math.floor(e.enhance * 3); });
    return gain;
  }
  function updateBatchBar() {
    const info = document.querySelector('[data-binfo]');
    if (info) info.innerHTML = `已选 <b style="color:var(--gold)">${batchSel.size}</b> 件 · 预计 ◆${fmt(batchGain())}`;
  }

  // 装备类别标签：普通 / 世界套装 / 职业套装 / 专属
  function equipCatTag(eq) {
    if (eq.charId) { const ch = D.charById[eq.charId]; return `<span class="tag" style="color:var(--gold);border-color:var(--gold)">专属·${ch ? ch.name : '?'}</span>`; }
    if (eq.classSet) return `<span class="tag" style="color:#c5a3ff;border-color:#c5a3ff">${D.CLASS_SETS[eq.classSet] ? D.CLASS_SETS[eq.classSet].name : '职业套装'}</span>`;
    if (eq.set) return `<span class="tag" style="color:#6ec6ff;border-color:#6ec6ff">${D.SETS[eq.set] ? D.SETS[eq.set].name : '世界套装'}</span>`;
    return '<span class="tag">普通</span>';
  }
  function equipScreen() {
    const S = C().S;
    const list = C().inventoryEquips();
    const filters = [['all', '全部'], ['weapon', '武器'], ['armor', '胸甲'], ['head', '头部'], ['hands', '手部'], ['legs', '腿部'], ['accessory', '饰品'], ['SSR', 'SSR+']];
    const catFilters = [['all', '全部'], ['normal', '普通'], ['world', '世界套装'], ['class', '职业套装'], ['sig', '专属']];
    let shown = list;
    if (equipFilter === 'SSR') shown = list.filter(e => ['SSR', 'UR'].includes(e.rarity));
    else if (equipFilter !== 'all') shown = list.filter(e => e.slot === equipFilter);
    if (equipCatFilter === 'normal') shown = shown.filter(e => !e.set && !e.classSet && !e.charId);
    else if (equipCatFilter === 'world') shown = shown.filter(e => !!e.set);
    else if (equipCatFilter === 'class') shown = shown.filter(e => !!e.classSet);
    else if (equipCatFilter === 'sig') shown = shown.filter(e => !!e.charId);
    const rows = shown.slice(0, 80).map(eq => {
      const equippedBy = Object.entries(S.equipped).find(([cid, slots]) => Object.values(slots).includes(eq.uid));
      if (batchMode) {
        const canSel = !equippedBy;
        return `<div class="list-row ${canSel ? (batchSel.has(eq.uid) ? 'sel' : '') : 'no-sel'}" ${canSel ? `data-beq="${eq.uid}"` : ''} style="cursor:${canSel ? 'pointer' : 'default'}">
          <span class="sel-box">✓</span>
          <span class="tag">${D.EQUIP_SLOTS[eq.slot]}</span>
          <div class="grow"><div class="t1 rtext-${eq.rarity}">${eq.name} +${eq.enhance}</div>
          <div class="t2">${equipCatTag(eq)} ${equipBrief(eq)}${equippedBy ? ` · <span style="color:var(--green)">${cname(equippedBy[0])}装备中</span>` : ''}</div></div>
        </div>`;
      }
      return `<div class="list-row" data-eqd="${eq.uid}" style="cursor:pointer">
        <span class="tag">${D.EQUIP_SLOTS[eq.slot]}</span>
        <div class="grow"><div class="t1 rtext-${eq.rarity}">${eq.name} +${eq.enhance}</div>
        <div class="t2">${equipCatTag(eq)} ${equipBrief(eq)}${equippedBy ? ` · <span style="color:var(--green)">${cname(equippedBy[0])}</span>` : ''}</div></div>
      </div>`;
    }).join('');
    return `
      <div class="pill-tabs" style="margin-bottom:6px">${catFilters.map(([k, n]) => `<div class="pill ${equipCatFilter === k ? 'active' : ''}" data-ecat="${k}">${n}</div>`).join('')}</div>
      <div class="pill-tabs">${filters.map(([k, n]) => `<div class="pill ${equipFilter === k ? 'active' : ''}" data-efilter="${k}">${n}</div>`).join('')}</div>
      <div style="display:flex;align-items:center;font-size:11px;color:var(--dim);margin:2px 2px 8px">
        <span>背包 ${list.length} 件</span>
        <span style="margin-left:auto"></span>
        ${batchMode
          ? '<span style="color:var(--gold)">批量分解中 · 点选装备，装备中的不可选</span>'
          : '<button class="btn small" data-batchon>🧹 批量分解</button>'}
      </div>
      ${rows || '<div class="empty">背包空空如也，去副本打装备吧</div>'}
      ${shown.length > 80 ? '<div class="empty">仅显示前 80 件</div>' : ''}
      ${batchMode ? `
        <div style="height:116px"></div>
        <div class="batch-bar">
          <div class="bb-row" style="margin-bottom:8px">
            <span style="font-size:12px;color:var(--dim)">快选：</span>
            ${['N', 'R', 'SR'].map(r => `<button class="btn small ghost" data-bsel="${r}">${r}</button>`).join('')}
            <button class="btn small ghost" data-bclear>清空</button>
          </div>
          <div class="bb-row">
            <span style="font-size:12px" data-binfo></span>
            <span style="margin-left:auto"></span>
            <button class="btn small primary" data-bgo>⚡ 分解</button>
            <button class="btn small ghost" data-batchoff>取消</button>
          </div>
        </div>` : ''}`;
  }
  function equipDetail(uid, wrap) {
    const S = C().S;
    const eq = S.equips[uid];
    if (!eq) return;
    const cost = C().enhanceCost(eq);
    const rate = eq.enhance < 20 ? Math.round(D.ENHANCE_RATE[eq.enhance] * 100) : 0;
    const set = D.SETS[eq.set];
    const cs = eq.classSet ? D.CLASS_SETS[eq.classSet] : null;
    const equippedBy = Object.entries(S.equipped).find(([cid, slots]) => Object.values(slots).includes(uid));
    const catLine = eq.charId
      ? `专属装备 · 仅限 ${cname(eq.charId)} 装备${eq.sigText ? ' · ' + eq.sigText : ''}`
      : cs ? `${cs.name}（${cs.text}）· 限${D.KIND_NAMES[eq.classSet]}定位激活`
      : set ? `${set.name}（${set.text}）`
      : '普通装备';
    const w = showPanel(wrap, `${eq.name}`, `
      <div style="margin-bottom:10px">
        <span class="rtext-${eq.rarity}" style="font-size:17px;font-weight:800">${eq.rarity}</span>
        <b style="font-size:17px"> ${eq.name} <span style="color:var(--gold)">+${eq.enhance}</span></b>
        <div style="font-size:11px;color:var(--dim);margin-top:4px">${D.EQUIP_SLOTS[eq.slot]} · ${catLine}${equippedBy ? ` · ${cname(equippedBy[0])}装备中` : ''}</div>
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
      equipDetail(uid, w); renderTopbar();
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
      const candidates = (eq.charId ? [eq.charId] : (canPlayer ? ['@player'] : []).concat(Object.keys(S.chars)))
        .filter(id => C().canEquip(id, eq));
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
      }).join('') || '<div class="empty">没有可穿戴该装备的角色</div>');
      w2.querySelectorAll('[data-to]').forEach(el => el.onclick = () => {
        if (C().equipItem(el.dataset.to, uid)) toast('已装备');
        else toast('该角色无法穿戴此装备');
        closeModal(w2);
        render();
      });
    };
  }

  /* ================= 招募 ================= */
  // 所有入口统一走这里：没解锁就给提示，不许绕过解锁直接开招募
  function openRecruit(wrap) {
    if (!C().isUnlocked('recruit')) { toast('🔒 ' + C().unlockTip('recruit'), 2400); return null; }
    return recruitModal(wrap);
  }
  function recruitModal(wrap) {
    const S = C().S;
    const free = C().freeRecruitAvailable();
    const w = showPanel(wrap, '轮回者招募', `
      <div class="card" style="margin-bottom:10px">
        <h3>每日免费 <span class="sub">${free ? '今日可领' : '明天再来'}</span></h3>
        <div style="font-size:11px;color:var(--dim);margin-bottom:8px">一天一次，免费招募同样计入主线与每日任务。</div>
        <button class="btn primary block" data-free="1" ${free ? '' : 'disabled'}>免费招募 1 次</button>
      </div>
      ${Object.entries(D.RECRUIT_POOLS).map(([pid, p]) => `
      <div class="card" style="margin-bottom:10px">
        <h3>${p.name} <span class="sub">${Object.entries(p.rates).map(([r, v]) => `${r} ${(v * 100).toFixed(1)}%`).join(' · ')}</span></h3>
        <div class="btn-row">
          <button class="btn small" data-pull1="${pid}">抽 1 次（${p.cost.holy ? '✦' + p.cost.holy : '◈' + fmt(p.cost.points)}）</button>
          <button class="btn small gold" data-pull10="${pid}">十连（${pid === 'normal' ? '◈' + fmt(45000) : '✦900'}·保底SR·9折）</button>
        </div>
        ${pid !== 'normal' ? `<div style="font-size:10px;color:var(--dim);margin-top:6px">SSR保底 ${pid === 'limited' ? S.recruit.pityLimS : S.recruit.pityAdvS}/50 · UR保底 ${pid === 'limited' ? S.recruit.pityLim : S.recruit.pityAdv}/100（同池继承）</div>` : ''}
      </div>`).join('')}
      ${S.ssrTicket > 0 ? `<button class="btn gold block" data-ssrpick="1">🎫 使用SSR自选券（剩 ${S.ssrTicket}）</button>` : ''}
    `);
    const showResults = results => {
      // 就地换成结果页：不重建遮罩，避免每次抽卡整屏闪一下
      updateModal(w, '招募结果', `
        <div class="char-grid">${results.map(r => {
        const ch = D.charById[r.id];
        return `<div class="char-card rarity-${r.rarity} ${['SSR', 'UR'].includes(r.rarity) ? 'shine' : ''}">
          ${charAvatar(r.id)}
          <div class="cname">${cname(r.id)}</div>
          <div class="cmeta">${r.isNew ? '<span style="color:var(--green)">NEW</span>' : `碎片+${r.shards}`}</div>
        </div>`;
      }).join('')}</div>
        <button class="btn primary block" style="margin-top:12px" data-back>继续招募</button>`);
      w.querySelector('[data-back]').onclick = () => recruitModal(w);
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
    if (tk) tk.onclick = () => ssrPickModal(w);
    return w;
  }
  function ssrPickModal(wrap) {
    const ssrs = D.characters.filter(c => c.rarity === 'SSR' && !c.hidden);
    const w = showPanel(wrap, 'SSR 自选（剩 ' + C().S.ssrTicket + ' 张）', `
      <div style="font-size:12px;color:var(--dim);margin-bottom:10px">选一名 SSR 轮回者入队；已拥有的角色会转成碎片。</div>
      <div class="char-grid">${ssrs.map(ch => `
      <div class="char-card rarity-SSR" data-pickssr="${ch.id}">${charAvatar(ch.id)}<div class="cname">${esc(ch.name)}</div><div class="cmeta">${ch.role} · ${ch.faction}</div></div>`).join('')}</div>
      <button class="btn ghost block" style="margin-top:12px" data-back>‹ 返回招募</button>`);
    w.querySelector('[data-back]').onclick = () => recruitModal(w);
    w.querySelectorAll('[data-pickssr]').forEach(el => el.onclick = () => {
      const r = C().ssrTicketUse(el.dataset.pickssr);
      toast(r.msg);
      refresh(); renderTopbar();
      const left = C().S.ssrTicket;
      updateModal(w, 'SSR 自选', `
        <div class="reward-chips" style="margin:16px 0;justify-content:center"><span class="reward-chip" style="font-size:14px">${esc(r.msg)}</span></div>
        <div style="text-align:center;font-size:12px;color:var(--dim);margin-bottom:12px">剩余自选券 ${left} 张</div>
        <button class="btn primary block" data-back>返回招募</button>`);
      w.querySelector('[data-back]').onclick = () => recruitModal(w);
    });
    return w;
  }

  /* ================= 商店 ================= */
  let shopTab = 'god';
  function shopModal(tab, wrap) {
    shopTab = tab || shopTab;
    const S = C().S;
    const shop = D.SHOPS[shopTab];
    const info = D.CURRENCY_INFO[shop.currency] || {};
    const w = showPanel(wrap, '兑换大厅', `
      <div class="pill-tabs">${Object.entries(D.SHOPS).map(([k, s]) => `<div class="pill ${shopTab === k ? 'active' : ''}" data-shoptab="${k}">${s.name}（${curIcon(s.currency)}${fmt(S.cur[s.currency])}）</div>`).join('')}</div>
      <div style="font-size:11px;color:var(--dim);line-height:1.7;margin:2px 2px 8px">
        本店用 ${curIcon(shop.currency)}${curName(shop.currency)} 结算 · 用途：${info.use || '—'}
      </div>
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
    w.querySelectorAll('[data-shoptab]').forEach(el => el.onclick = () => shopModal(el.dataset.shoptab, w));
    w.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const r = C().buyShopItem(shopTab, +b.dataset.buy);
      toast(r.msg);
      shopModal(shopTab, w);
      renderTopbar();
    });
    return w;
  }

  /* ================= 建筑 ================= */
  function buildingsModal(wrap) {
    const S = C().S;
    const w = showPanel(wrap, '基地建设', `<div style="font-size:11px;color:var(--dim);line-height:1.7;margin-bottom:8px">建筑升级全部消耗 ◈点数（挂机与副本产出），每级效果永久生效。</div>` + D.BUILDINGS.map(b => {
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
      buildingsModal(w);
      renderTopbar();
    });
    return w;
  }

  /* ================= 任务（主线 / 日常） ================= */
  let taskTab = 'main';
  // 主线的"去完成"统一走这里：首页卡片与任务面板共用同一套跳转
  function gotoQuest(qid) {
    const worldOf = { q12: 'W02', q14: 'W02', q15: 'W03' }[qid] || 'W01';
    if (qid === 'q01') {
      setTab('home');
      setTimeout(() => {
        protagonistDetail();
        coachmark('.stat-6', '这是你的属性面板：升级得属性点和技能点，点 +1 分配；Lv.10 觉醒血统后解锁血统技能。看完关掉面板，回首页领取奖励。');
      }, 250);
      return;
    }
    if (qid === 'q03') { setTab('home'); setTimeout(() => openRecruit(), 250); return; }
    if (qid === 'q09') { setTab('home'); setTimeout(() => buildingsModal(), 250); return; }
    if (qid === 'q13') { setTab('home'); setTimeout(() => protagonistDetail(), 250); return; }
    if (qid === 'q04') {
      setTab('party');
      coachmark('[data-slot="0"]', '点击空位，把招募到的角色放入队伍。主角必上阵，还可再上 4 名队友（前 2 后 2）。');
      return;
    }
    if (qid === 'q07') {
      setTab('equip');
      coachmark('[data-eqd]', '点击一件装备即可强化，消耗材料提升数值。');
      return;
    }
    if (qid === 'q11') { setTab('dungeon'); setTimeout(() => { dungeonView = { page: 'corridor' }; render(); }, 250); return; }
    // 战斗类任务：直达对应世界的关卡页
    setTab('dungeon');
    dungeonView = { page: 'world', worldId: worldOf, diff: 'normal' };
    render();
    if (qid === 'q01b') coachmark('[data-stage="0"]', '点击第 1 关进入探索，途中遭遇敌人会自动战斗，完成后即可回来领取奖励。');
  }
  // 日常任务的"去完成"
  function gotoDaily(key) {
    if (key === 'idle1') { setTab('home'); coachmark('[data-act="claim-idle"]', '挂机满 60 秒就能领，离线期间也会累积收益。'); return; }
    if (key === 'enhance1') { setTab('equip'); coachmark('[data-eqd]', '点一件装备进去强化，成功或失败都算完成一次。'); return; }
    if (key === 'recruit1') { setTab('home'); setTimeout(() => openRecruit(), 250); return; }
    if (key === 'item1') { setTab('home'); setTimeout(() => bagModal(), 250); return; }
    setTab('dungeon');
  }
  const DAILY_MAIN_GO = { battle5: '轮回副本打一场', idle1: '主神空间领挂机', enhance1: '装备页强化', recruit1: '招募 1 次', dungeon1: '轮回副本通关一关', item1: '背包用道具' };
  function tasksModal(tab, wrap) {
    taskTab = tab || taskTab;
    const S = C().S;
    C().ensureDaily();
    const allDone = D.DAILY_TASKS.every(t => (S.tasks.daily[t.id] || 0) >= t.target);
    const mainList = C().mainQuestState();
    const curIdx = mainList.findIndex(x => !x.claimed);
    const mainHtml = mainList.map(({ q, done, claimed }, i) => {
      const isCur = i === curIdx;
      return `<div class="list-row" style="${claimed ? 'opacity:.45' : ''}${isCur ? ';border-color:#ffd76a88' : ''}">
        <div class="grow">
          <div class="t1">第 ${i + 1}/${mainList.length} 步 · ${q.name} ${isCur ? '<span class="tag" style="color:var(--gold);border-color:var(--gold)">当前</span>' : ''}</div>
          <div class="t2">${q.desc} · 奖励 ${Object.entries(q.reward).filter(([, v]) => v > 0).map(([k, v]) => `${curIcon(k)}${v}`).join(' ')}</div>
        </div>
        ${claimed
          ? '<button class="btn small" disabled>已完成</button>'
          : done
            ? `<button class="btn small primary" data-mclaim="${q.id}">领取</button>`
            : `<button class="btn small ghost" data-gotoq="${q.id}">前往 ›</button>`}
      </div>`;
    }).join('');
    const dailyHtml = `
      ${D.DAILY_TASKS.map(t => {
        const prog = S.tasks.daily[t.id] || 0;
        const done = prog >= t.target;
        const claimed = S.tasks.claimed[t.id];
        return `<div class="list-row">
          <div class="grow"><div class="t1">${t.name}</div>
          <div class="t2">${Math.min(prog, t.target)}/${t.target} · 奖励 ${Object.entries(t.reward).map(([k, v]) => `${curIcon(k)}${v}`).join(' ')}${done || claimed ? '' : ` · ${DAILY_MAIN_GO[t.id] || ''}`}</div></div>
          ${claimed
            ? '<button class="btn small" disabled>已领</button>'
            : done
              ? `<button class="btn small primary" data-claim="${t.id}">领取</button>`
              : `<button class="btn small ghost" data-godaily="${t.id}">前往 ›</button>`}
        </div>`;
      }).join('')}
      <div class="card" style="margin-top:10px">
        <h3>全部完成奖励</h3>
        <div style="font-size:12px;color:var(--dim);margin-bottom:8px">${Object.entries(D.DAILY_ALL_REWARD).map(([k, v]) => `${curIcon(k)}${v}`).join(' · ')}</div>
        <button class="btn gold block" data-claimall="1" ${allDone && !S.tasks.allClaimed ? '' : 'disabled'}>${S.tasks.allClaimed ? '已领取' : '一键领取'}</button>
      </div>`;
    const w = showPanel(wrap, '任务', `
      <div class="pill-tabs">
        <div class="pill ${taskTab === 'main' ? 'active' : ''}" data-ttab="main">📜 主线</div>
        <div class="pill ${taskTab === 'daily' ? 'active' : ''}" data-ttab="daily">📋 日常</div>
      </div>
      ${taskTab === 'main' ? mainHtml : dailyHtml}
    `);
    w.querySelectorAll('[data-ttab]').forEach(el => el.onclick = () => tasksModal(el.dataset.ttab, w));
    w.querySelectorAll('[data-mclaim]').forEach(b => b.onclick = () => {
      const r = C().claimQuest(b.dataset.mclaim);
      if (r.ok) toast('主线奖励已领取');
      tasksModal(taskTab, w); renderTopbar();
    });
    w.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => {
      C().claimTask(b.dataset.claim);
      tasksModal(taskTab, w); renderTopbar();
    });
    w.querySelectorAll('[data-gotoq]').forEach(b => b.onclick = () => { closeModal(w); gotoQuest(b.dataset.gotoq); });
    w.querySelectorAll('[data-godaily]').forEach(b => b.onclick = () => { closeModal(w); gotoDaily(b.dataset.godaily); });
    w.querySelector('[data-claimall]').onclick = () => {
      const r = C().claimAllTasks();
      toast(r.ok ? '领取成功' : r.msg);
      tasksModal(taskTab, w); renderTopbar();
    };
    return w;
  }

  /* ================= 基因锁 / 转生 ================= */
  function geneLockModal(wrap) {
    const S = C().S;
    const info = C().geneLockInfo();
    const w = showPanel(wrap, '基因锁', `
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
      geneLockModal(w);
      refresh();
    };
    return w;
  }
  function reincarnModal(wrap) {
    const S = C().S;
    const can = C().canReincarnate();
    const n = S.player.reincarnations + 1;
    const rpGain = Math.floor(100 * Math.pow(n, 1.15));
    const w = showPanel(wrap, '转生', `
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
      reincarnModal(w);
      renderTopbar();
    });
    return w;
  }

  /* ================= 背包 / 设置 ================= */
  function itemIcon(it) {
    if (it.type === 'box') return '🎁';
    if (it.type === 'exp') return '📘';
    if (it.type === 'material') return '⚙️';
    if ((it.effect || {}).healPct) return '🧪';
    return '💉';
  }
  // 结果面板：开箱 / 使用道具之后把拿到的东西摆出来
  function lootPanel(title, chipsHtml, backFn, wrap) {
    const w = showPanel(wrap, title, `
      <div class="reward-chips" style="margin:10px 0">${chipsHtml || '<span class="reward-chip">没有变化</span>'}</div>
      <button class="btn block" data-back>‹ 返回</button>`);
    w.querySelector('[data-back]').onclick = () => backFn(w);
    return w;
  }
  function bagModal(wrap) {
    const S = C().S;
    const entries = Object.entries(S.items).filter(([, n]) => n > 0);
    const usage = C().bagUsage();
    const expandCost = D.bagExpandCost(S.bag.expands);
    const body = `
      <div class="kv" style="margin-bottom:4px"><span class="k">容量</span><span>${usage.used} / ${usage.cap}</span></div>
      <div class="bar exp" style="margin-bottom:10px"><i style="width:${Math.min(100, usage.used / usage.cap * 100)}%;${usage.used / usage.cap > 0.9 ? 'background:var(--accent)' : ''}"></i></div>
      <button class="btn small block" data-expand="1" style="margin-bottom:12px">🎒 扩容 +${D.BAG_EXPAND_SIZE} 格（◈${fmt(expandCost)}）</button>
      <div class="section-title">货币 <span style="font-size:11px;font-weight:400">（点一下看用途）</span></div>
      <div class="cur-chips">
        ${D.CURRENCIES.map(c => `<button class="cur-chip" data-cur="${c.id}"><span style="color:${c.color}">${c.icon}</span><b>${fmt(S.cur[c.id])}</b></button>`).join('')}
      </div>
      <div class="section-title">道具（${usage.itemStacks} 种 · 装备 ${usage.eqCount} 件在装备页）</div>
      <div class="bag-grid">
        ${entries.map(([k, n]) => {
          const it = D.ITEMS[k];
          if (!it) return '';
          return `<div class="bag-card" data-item="${k}" style="cursor:pointer${it.type === 'box' ? ';border-color:var(--gold)' : ''}">
            <div class="bico">${itemIcon(it)}</div>
            <div class="bname">${it.name}</div>
            <div class="bcount">×${n}${it.type === 'box' || it.type === 'exp' ? ' · 可批量' : ''}</div>
          </div>`;
        }).join('') || '<div class="empty" style="grid-column:1/-1">背包是空的</div>'}
      </div>
      <div style="font-size:11px;color:var(--dim);margin-top:10px">点任意道具可看用途与用法；宝箱、经验模块支持 1 / 10 / 全部 批量使用。每种道具占 1 格，未装备的装备每件占 1 格。</div>`;
    const w = showPanel(wrap, '背包', body);
    w.querySelector('[data-expand]').onclick = () => {
      const r = C().buyBagCap();
      toast(r.msg);
      bagModal(w);
      renderTopbar();
    };
    w.querySelectorAll('[data-cur]').forEach(el => el.onclick = () => currencyModal(el.dataset.cur, w, w2 => bagModal(w2)));
    w.querySelectorAll('[data-item]').forEach(el => el.onclick = () => itemDetail(el.dataset.item, w));
    return w;
  }
  // 道具详情卡：说明 + 在哪用 + 批量操作
  function itemDetail(itemId, wrap) {
    const S = C().S;
    const it = D.ITEMS[itemId];
    if (!it) return bagModal(wrap);
    const n = S.items[itemId] || 0;
    const where = { explore: '副本探索中', character: '角色培养页', anywhere: '随时' }[it.where] || '—';
    let actions = '';
    if (it.type === 'box') {
      actions = `<div class="btn-row">
        <button class="btn small" data-open="1" ${n >= 1 ? '' : 'disabled'}>开 1 个</button>
        <button class="btn small" data-open="10" ${n >= 2 ? '' : 'disabled'}>开 10 个</button>
        <button class="btn small gold" data-open="0" ${n >= 1 ? '' : 'disabled'}>全部开（${n}）</button>
      </div>`;
    } else if (it.type === 'exp') {
      actions = `<div class="btn-row">
        <button class="btn small" data-exp="1" ${n >= 1 ? '' : 'disabled'}>用 1 个</button>
        <button class="btn small" data-exp="10" ${n >= 10 ? '' : 'disabled'}>用 10 个</button>
        <button class="btn small gold" data-exp="0" ${n >= 1 ? '' : 'disabled'}>全部用（${n}）</button>
      </div>
      <div style="font-size:11px;color:var(--dim);margin-top:6px">先选角色，再确认数量。</div>`;
    } else if (it.type === 'consumable') {
      actions = run
        ? `<div class="btn-row"><button class="btn small gold" data-runuse="1">在本次探索中使用</button></div>`
        : `<div class="btn-row"><button class="btn small" data-gotoexplore="1">进副本后使用 ›</button></div>
           <div style="font-size:11px;color:var(--dim);margin-top:6px">探索中的队伍血量会继承，进场前也可以先备好。</div>`;
    } else if (it.type === 'material') {
      actions = `<div style="font-size:12px;color:var(--dim);line-height:1.8">强化装备时自动优先消耗，不需要手动使用。</div>`;
    }
    const body = `
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
        <div style="font-size:38px">${itemIcon(it)}</div>
        <div>
          <div><b style="font-size:16px">${it.name}</b></div>
          <div style="font-size:12px;color:var(--dim);margin-top:3px">持有 ×${n}</div>
        </div>
      </div>
      <div class="card" style="margin-bottom:10px">
        <h3>说明</h3>
        <div style="font-size:12px;line-height:1.8">${esc(it.desc || '')}</div>
      </div>
      <div class="card" style="margin-bottom:10px">
        <h3>在哪用</h3>
        <div class="kv"><span class="k">使用场景</span><span>${where}</span></div>
        <div style="font-size:12px;color:var(--dim);line-height:1.8;margin-top:6px">${esc(it.use || '')}</div>
      </div>
      ${actions}
      <button class="btn ghost block" style="margin-top:12px" data-back>‹ 返回背包</button>`;
    const w = showPanel(wrap, '道具详情', body);
    w.querySelector('[data-back]').onclick = () => bagModal(w);
    const afterChange = () => { renderTopbar(); if ((C().S.items[itemId] || 0) > 0) itemDetail(itemId, w); else bagModal(w); };
    w.querySelectorAll('[data-open]').forEach(b => b.onclick = () => {
      const want = +b.dataset.open;
      const cnt = want === 0 ? (C().S.items[itemId] || 0) : want;
      const doOpen = () => {
        const r = C().openBoxes(itemId, cnt);
        if (!r.ok) { toast(r.msg || '开箱失败'); return; }
        const chips = (r.equips || []).map(e => `<span class="reward-chip rtext-${e.rarity}">${itemIcon(it)} ${e.name} +${e.enhance}</span>`);
        if (r.sold) chips.push(`<span class="reward-chip">◆+${fmt(r.soldGain)}（自动分解 ${r.sold} 件）</span>`);
        refresh();
        lootPanel(`开箱结果（×${r.count}）`, chips.join(''), () => afterChange(), w);
      };
      if (cnt > 10) confirmBox('批量开箱', `确定一次开启 <b>${cnt}</b> 个「${it.name}」？`, doOpen);
      else doOpen();
    });
    w.querySelectorAll('[data-exp]').forEach(b => b.onclick = () => {
      const want = +b.dataset.exp;
      pickExpTarget(itemId, want === 0 ? (C().S.items[itemId] || 0) : want, w);
    });
    const runUse = w.querySelector('[data-runuse]');
    if (runUse) runUse.onclick = () => {
      const eff = it.effect || {};
      if (!C().removeItem(itemId)) { toast('道具不足'); return; }
      const parts = [];
      if (eff.healPct) { Object.keys(run.hpPct).forEach(cid => { run.hpPct[cid] = Math.min(1, run.hpPct[cid] + eff.healPct); }); parts.push(`全队恢复 ${Math.round(eff.healPct * 100)}%`); }
      ['atkPct', 'spdPct', 'defPct'].forEach(k => { if (eff[k]) { run.buffs[k] = (run.buffs[k] || 0) + eff[k]; parts.push(`${D.CONSUMABLE_TAG[k]}+${Math.round(eff[k] * 100)}%`); } });
      C().task('item1', 1); C().save();
      toast(`${it.name}：${parts.join(' · ')}`);
      render();
      afterChange();
    };
    const go = w.querySelector('[data-gotoexplore]');
    if (go) go.onclick = () => { closeModal(w); setTab('dungeon'); };
    return w;
  }
  // 经验道具：先选角色
  function pickExpTarget(itemId, count, wrap) {
    const S = C().S;
    const owned = Object.keys(S.chars);
    if (!D.ITEMS[itemId] || (S.items[itemId] || 0) <= 0) { toast('道具不足'); return bagModal(wrap); }
    if (!owned.length) { setTab('home'); closeModal(wrap); setTimeout(() => openRecruit(), 250); return; }
    const body = `
      <div style="font-size:12px;color:var(--dim);margin-bottom:10px">选择要吃「${D.ITEMS[itemId].name} ×${count}」的角色</div>
      ${owned.map(id => {
        const ch = D.charById[id], c = S.chars[id];
        return `<div class="list-row" data-target="${id}" style="cursor:pointer">
          ${charAvatar(id, 40)}
          <div class="grow"><div class="t1">${rarityTag(ch.rarity)} ${cname(id)}</div>
          <div class="t2">Lv.${c.lv} · ${ch.role} · EXP ${fmt(c.exp)}</div></div>
        </div>`;
      }).join('')}
      <button class="btn ghost block" style="margin-top:12px" data-back>‹ 返回</button>`;
    const w = showPanel(wrap, '使用经验道具', body);
    w.querySelector('[data-back]').onclick = () => itemDetail(itemId, w);
    w.querySelectorAll('[data-target]').forEach(el => el.onclick = () => {
      const r = C().useExpItem(el.dataset.target, itemId, count);
      toast(r.msg);
      renderTopbar();
      itemDetail(itemId, w);
    });
    return w;
  }
  function settingsModal(wrap) {
    const S = C().S;
    const body = `
      <div class="card">
        <h3>玩法说明</h3>
        <div style="font-size:11px;color:var(--dim);margin-bottom:8px">不知道点哪个、不知道货币怎么花，先看这两处。</div>
        <div class="btn-row">
          <button class="btn small" data-act="open-guide">❓ 玩法指南</button>
          <button class="btn small" data-act="open-curdoc">▤ 货币图鉴</button>
        </div>
      </div>
      <div class="card">
        <h3>战斗速度</h3>
        <div class="btn-row">${[1, 2, 3].map(s => `<button class="btn small ${S.settings.speed === s ? 'primary' : ''}" data-speed="${s}">${s}×</button>`).join('')}</div>
      </div>
      <div class="card">
        <h3>自动分解 <span class="sub">背包满之前就开始省格子</span></h3>
        <div class="list-row">
          <div class="grow"><div class="t1">自动分解 N 装备</div><div class="t2">掉到 N 品质直接换成 ◆异界结晶</div></div>
          <button class="btn small ${S.settings.autoSellN ? 'primary' : ''}" data-autosell="autoSellN">${S.settings.autoSellN ? '已开启' : '已关闭'}</button>
        </div>
        <div class="list-row">
          <div class="grow"><div class="t1">自动分解 R 装备</div><div class="t2">掉到 R 品质直接换成 ◆异界结晶</div></div>
          <button class="btn small ${S.settings.autoSellR ? 'primary' : ''}" data-autosell="autoSellR">${S.settings.autoSellR ? '已开启' : '已关闭'}</button>
        </div>
      </div>
      <div class="card">
        <h3>角色列表</h3>
        ${C().protagonistList().map(p => `
          <div class="list-row" style="${p.current ? 'border-color:var(--gold)' : ''}">
            <div class="grow"><div class="t1">${esc(p.name)} ${p.current ? '<span class="tag" style="color:var(--gold);border-color:var(--gold)">当前</span>' : ''}</div>
            <div class="t2">Lv.${p.level} · ${p.bloodline ? p.bloodline + '血统 Lv.' + p.bloodlineLv : '未觉醒血统'}</div></div>
            ${p.current ? '' : `<button class="btn small" data-switchprotag="${p.altIndex}">切换</button>`}
          </div>`).join('')}
        <div style="font-size:11px;color:var(--dim);margin:8px 0">新建角色从 Lv.1 开始，可体验不同血统路线；世界进度、货币、队伍不受影响</div>
        <button class="btn small block" data-newprotag="1">➕ 新建角色</button>
      </div>
      <div class="card">
        <h3>危险区</h3>
        <button class="btn small ghost" data-reset="1" style="color:var(--accent)">删除当前进度，重新开始</button>
      </div>
      <div style="text-align:center;font-size:10px;color:var(--dim);padding:8px;opacity:.6" data-ver>无限轮回 V5.0</div>
    `;
    const w = showPanel(wrap, '设置与存档', body);
    let verTaps = 0, verTimer = null;
    w.querySelector('[data-ver]').onclick = () => {
      verTaps++;
      clearTimeout(verTimer);
      verTimer = setTimeout(() => { verTaps = 0; }, 2000);
      if (verTaps >= 7) { closeModal(w); gmModal(); }
    };
    w.querySelectorAll('[data-speed]').forEach(b => b.onclick = () => {
      C().S.settings.speed = +b.dataset.speed; C().save();
      settingsModal(w);
    });
    w.querySelectorAll('[data-autosell]').forEach(b => b.onclick = () => {
      const k = b.dataset.autosell;
      C().S.settings[k] = !C().S.settings[k];
      C().save();
      toast(`${k === 'autoSellN' ? 'N' : 'R'} 装备自动分解已${C().S.settings[k] ? '开启' : '关闭'}`);
      settingsModal(w);
    });
    w.querySelectorAll('[data-act]').forEach(el => el.onclick = () => {
      const a = el.dataset.act;
      if (a === 'open-guide') guideModal(null, w);
      else if (a === 'open-curdoc') currencyModal(null, w);
    });
    w.querySelectorAll('[data-switchprotag]').forEach(b => b.onclick = () => {
      const r = C().switchProtagonist(+b.dataset.switchprotag);
      toast(r.msg, 2200);
      closeModal(w); if (r.ok) { refresh(); render(); }
    });
    w.querySelector('[data-newprotag]').onclick = () => {
      closeModal(w);
      const nw = modal('新建角色', `
        <div style="font-size:12px;color:var(--dim);margin-bottom:10px">当前角色会被保留，可随时切回。新角色从 Lv.1 开始，用于体验不同的血统路线。</div>
        <input id="np-input" maxlength="12" placeholder="输入新角色名字（12字内）" style="width:100%;background:var(--panel);border:1px solid var(--line);border-radius:10px;color:var(--text);padding:12px;font-size:15px;outline:none;margin-bottom:12px" />
        <button class="btn primary block" data-ok>创建并开始轮回</button>`, { center: true });
      nw.querySelector('[data-ok]').onclick = () => {
        const r = C().createProtagonist(nw.querySelector('#np-input').value);
        toast(r.msg, 2400);
        if (r.ok) { closeModal(nw); refresh(); render(); }
      };
    };
    w.querySelector('[data-reset]').onclick = () => {
      closeModal(w);
      confirmBox('删除进度', '将永久删除当前游戏进度（不影响手动存档槽），确定重新开始？', () => {
        C().wipeSave();
        location.reload();
      });
    };
  }

  /* ================= 战斗播放器 ================= */
  function buildAllies(hpPctMap, extraBuffs) {
    const S = C().S;
    const fb = C().factionBuffs(S.party);
    const buffAtk = (extraBuffs && extraBuffs.atkPct) || 0;
    const buffSpd = (extraBuffs && extraBuffs.spdPct) || 0;
    const allies = [];
    // 主角必上阵
    if (!hpPctMap || hpPctMap['@player'] === undefined || hpPctMap['@player'] > 0.01) {
      const pst = C().effectivePlayerStats();
      const pFullHp = pst.hp;
      const pHp = hpPctMap && hpPctMap['@player'] !== undefined ? Math.max(1, Math.round(pFullHp * hpPctMap['@player'])) : pFullHp;
      allies.push(Object.assign({}, pst, {
        name: cname('@player'), kind: 'warrior', faction: null,
        position: 'front',
        skills: C().protagonistSkills(), skillLv: S.player.skillLv || [1, 1, 1],
        atk: Math.round(pst.atk * (1 + buffAtk)),
        spd: Math.round(pst.spd * (1 + buffSpd)),
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
        spd: Math.round(eff.spd * (1 + buffSpd)),
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
    const S0 = C().S;
    // 需要花钱的选项：余额不足就先禁用，别让玩家点了才发现扣成 0
    const lackOf = eff => Object.entries(eff || {}).filter(([k, v]) => v < 0 && (S0.cur[k] || 0) < -v).map(([k]) => curName(k));
    const w = modal(ev.title, `
      <div class="event-desc">${esc(ev.desc)}</div>
      <div class="event-choices">
        ${ev.choices.map((c, i) => {
          const lack = lackOf(c.effect);
          return `<button class="btn block" data-choice="${i}" ${lack.length ? 'disabled' : ''}>${esc(c.text)}${lack.length ? `（${lack.join('、')}不足）` : ''}</button>`;
        }).join('')}
      </div>
    `, { sticky: true });
    w.querySelectorAll('[data-choice]').forEach(b => b.onclick = () => {
      const ch = ev.choices[+b.dataset.choice];
      const eff = ch.effect || {};
      const S = C().S;
      const gains = [];
      ['points', 'holy', 'story', 'otherworld', 'skillChip', 'bloodCrystal'].forEach(k => {
        if (!eff[k]) return;
        const before = S.cur[k] || 0;
        C().addCur(k, eff[k]);
        gains.push(`${curIcon(k)}${eff[k] > 0 ? '+' : ''}${eff[k]}${eff[k] < 0 && before < -eff[k] ? '（不足，已扣至 0）' : ''}`);
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
      if (g.k === 'item') return `🎒${D.ITEMS[g.v].name}${g.n > 1 ? '×' + g.n : ''}`;
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
        case 'open-recruit': openRecruit(); break;
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
          gotoQuest(cur.q.id);
          break;
        }
        case 'open-guide': guideModal(); break;
        case 'open-codex': codexModal(); break;
        case 'open-curdoc': currencyModal(); break;
        case 'open-corridor':
          if (!C().isUnlocked('corridor')) { toast('🔒 ' + C().unlockTip('corridor')); break; }
          dungeonView = { page: 'corridor' }; render(); break;
        case 'open-corridor-shop': shopModal('corridor'); break;
        case 'fight-corridor': fightCorridor(); break;
        case 'back-worlds': dungeonView = { page: 'worlds' }; run = null; render(); break;
        case 'abandon-run':
          confirmBox('撤离副本', '确定撤离？本次探索进度将丢失，已获得的奖励会保留。', () => {
            const wid = run ? run.worldId : dungeonView.worldId;
            const df = run ? run.diff : (dungeonView.diff || 'normal');
            run = null;
            dungeonView = { page: 'world', worldId: wid, diff: df };
            render();
          });
          break;
        case 'open-sweep':
          sweepModal(dungeonView.worldId, dungeonView.diff);
          break;
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
        if (r.item) chips.push(`🎒${D.ITEMS[r.item].name}`);
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
      const eff = (D.ITEMS[id] || {}).effect || {};
      if (!C().removeItem(id)) { toast('道具不足'); return; }
      const parts = [];
      if (eff.healPct) {
        Object.keys(run.hpPct).forEach(cid => { run.hpPct[cid] = Math.min(1, run.hpPct[cid] + eff.healPct); });
        parts.push(`全队恢复 ${Math.round(eff.healPct * 100)}% 生命`);
      }
      ['atkPct', 'spdPct', 'defPct'].forEach(k => {
        if (!eff[k]) return;
        run.buffs[k] = (run.buffs[k] || 0) + eff[k];
        parts.push(`${D.CONSUMABLE_TAG[k] || k}+${Math.round(eff[k] * 100)}%`);
      });
      C().task('item1', 1);
      C().save();
      toast(`${eff.healPct ? '🧪' : '💉'} ${D.ITEMS[id].name}：${parts.join(' · ')}`);
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
    root.querySelectorAll('[data-ecat]').forEach(el => el.onclick = () => { equipCatFilter = el.dataset.ecat; render(); });
    // 批量分解
    const batchOn = root.querySelector('[data-batchon]');
    if (batchOn) batchOn.onclick = () => { batchMode = true; batchSel.clear(); render(); };
    const batchOff = root.querySelector('[data-batchoff]');
    if (batchOff) batchOff.onclick = () => { batchMode = false; batchSel.clear(); render(); };
    root.querySelectorAll('[data-beq]').forEach(el => el.onclick = () => {
      const uid = el.dataset.beq;
      if (batchSel.has(uid)) batchSel.delete(uid); else batchSel.add(uid);
      el.classList.toggle('sel', batchSel.has(uid));
      updateBatchBar();
    });
    root.querySelectorAll('[data-bsel]').forEach(b => b.onclick = () => {
      const r = b.dataset.bsel;
      const eqd = equippedUidSet(C().S);
      const uids = C().inventoryEquips().filter(e => e.rarity === r && !eqd.has(e.uid)).map(e => e.uid);
      const allIn = uids.length > 0 && uids.every(u => batchSel.has(u));
      uids.forEach(u => { if (allIn) batchSel.delete(u); else batchSel.add(u); });
      root.querySelectorAll('[data-beq]').forEach(el => el.classList.toggle('sel', batchSel.has(el.dataset.beq)));
      updateBatchBar();
    });
    const bClear = root.querySelector('[data-bclear]');
    if (bClear) bClear.onclick = () => {
      batchSel.clear();
      root.querySelectorAll('[data-beq]').forEach(el => el.classList.remove('sel'));
      updateBatchBar();
    };
    const bGo = root.querySelector('[data-bgo]');
    if (bGo) bGo.onclick = () => {
      if (!batchSel.size) { toast('请先点选要分解的装备'); return; }
      const n = batchSel.size, gain = batchGain();
      confirmBox('批量分解', `确定分解选中的 <b>${n}</b> 件装备？将获得 ◆${fmt(gain)}（异界结晶）`, () => {
        const r = C().decomposeMany([...batchSel]);
        toast(`分解 ${r.count} 件装备，获得 ◆${fmt(r.gain)}`, 2400);
        batchMode = false; batchSel.clear();
        render(); renderTopbar();
      });
    };
    if (batchMode) updateBatchBar();
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
    // 测试用：直接开面板，检查模板与空引用
    _panels: { bagModal, itemDetail, currencyModal, guideModal, codexModal, shopModal, tasksModal, settingsModal, sweepModal, recruitModal, gotoQuest },
  };
})();
