/* 《无限轮回》副本/关卡/回廊：敌人编成、路线生成、奖励 */
window.Dungeon = (function () {
  const D = window.DATA;
  const THEME_FACTION = { bio: '先锋', ghost: '异能', mystic: '策略', tech: '科技', god: null };

  function diffMult(diff) { return (D.DIFFICULTY.find(d => d.id === diff) || D.DIFFICULTY[0]).mult; }
  function rewardMult(diff) { return (D.DIFFICULTY.find(d => d.id === diff) || D.DIFFICULTY[0]).rewardMult; }
  function stageMult(stage) { return Math.pow(1.16, stage - 1); }

  // 生成一场战斗的敌人
  function makeEnemies(worldId, diff, stage, kind) {
    const w = D.WORLDS.find(x => x.id === worldId);
    const m = diffMult(diff) * stageMult(stage);                       // HP 用满倍率（V5 §51）
    const mAtk = diffMult(diff) * Math.pow(1.10, stage - 1);           // 攻击放缓
    const mDef = diffMult(diff) * Math.pow(1.06, stage - 1);           // 防御放缓，避免伤害坍缩
    const faction = THEME_FACTION[w.theme];
    const mk = (name, hp, atk, def, opts) => Object.assign({
      name, hp: Math.round(hp), atk: Math.round(atk), def: Math.round(def),
      spd: 55 + stage * 2 + (opts && opts.isBoss ? 20 : 0),
      faction, eva: 0.02 + (diff === 'hell' ? 0.03 : 0),
      resPct: diff === 'hell' ? 0.15 : diff === 'hard' ? 0.08 : 0,
    }, opts || {});
    // 同名敌人加 A/B/C 后缀，敌情预告与战斗画面保持一致
    const label = list => {
      const count = {};
      list.forEach(e => { count[e.name] = (count[e.name] || 0) + 1; });
      const seen = {};
      list.forEach(e => {
        if (count[e.name] > 1) {
          seen[e.name] = (seen[e.name] || 0) + 1;
          e.name = e.name + ' ' + String.fromCharCode(64 + seen[e.name]);
        }
      });
      return list;
    };
    if (kind === 'boss') {
      const bossHp = w.bossHp[D.DIFFICULTY.findIndex(d => d.id === diff)] || w.bossHp[0];
      // Boss 血量按世界序号缩放（早期世界玩家战力低，避免数值碾压）
      const wi = D.WORLDS.indexOf(w);
      const bossHpMult = 0.28 + wi * 0.05;
      const list = [mk(w.boss, bossHp * bossHpMult, w.atk * 2.2 * diffMult(diff) * (1 + stage * 0.04), w.def * 1.8 * diffMult(diff) * (1 + stage * 0.05), { isBoss: true })];
      list.push(mk(w.enemies[0], w.hp * m * 1.5, w.atk * mAtk, w.def * mDef, {}));
      if (diff !== 'normal') list.push(mk(w.enemies[1], w.hp * m * 1.5, w.atk * mAtk, w.def * mDef, {}));
      return label(list);
    }
    if (kind === 'elite') {
      return label([
        mk(w.elite, w.hp * 2.4 * m, w.atk * 1.5 * mAtk, w.def * 1.4 * mDef, { isElite: true }),
        mk(w.enemies[Math.floor(Math.random() * 3)], w.hp * m, w.atk * mAtk, w.def * mDef, {}),
      ]);
    }
    // 前期单人也能打：1关1只(70%)，2关1只(85%)，3关2只(85%)，4关2只(92%)，5关起满编，8关起3只
    if (stage <= 2) {
      const weak = stage === 1 ? 0.7 : 0.85;
      return [mk(w.enemies[0], w.hp * m * weak, w.atk * mAtk * weak, w.def * mDef * weak, {})];
    }
    if (stage <= 4) {
      const weak = stage === 3 ? 0.85 : 0.92;
      const out = [];
      for (let i = 0; i < 2; i++) out.push(mk(w.enemies[i % w.enemies.length], w.hp * m * weak, w.atk * mAtk * weak, w.def * mDef * weak, {}));
      return label(out);
    }
    const n = 2 + (stage >= 8 ? 1 : 0);
    const out = [];
    for (let i = 0; i < n; i++) out.push(mk(w.enemies[Math.floor(Math.random() * w.enemies.length)], w.hp * m, w.atk * mAtk, w.def * mDef, {}));
    return label(out);
  }

  // 战斗奖励
  function battleRewards(worldId, diff, stage, kind) {
    const tier = D.WORLDS.findIndex(x => x.id === worldId) + 1;
    const rm = rewardMult(diff) * (1 + (stage - 1) * 0.08);
    const base = { points: 0, exp: 0, story: 0, otherworld: 0, skillChip: 0, bloodCrystal: 0, equipChance: 0, equipMin: null };
    if (kind === 'boss') {
      base.points = Math.round((500 + tier * 150) * rm);
      base.exp = Math.round((300 + tier * 80) * rm);
      base.story = Math.round(50 * rm);
      base.otherworld = Math.round(30 * rm);
      base.skillChip = 50 + tier * 8;
      base.bloodCrystal = diff === 'hell' ? 30 : diff === 'hard' ? 15 : 5;
      base.equipChance = 1;
      base.equipMin = diff === 'hell' ? 'SSR' : 'SR';
    } else if (kind === 'elite') {
      base.points = Math.round((80 + tier * 40) * rm * 2.5);
      base.exp = Math.round((60 + tier * 20) * rm * 2.5);
      base.story = Math.random() < 0.5 ? Math.round(15 * rm) : 0;
      base.skillChip = 15 + tier * 2;
      base.equipChance = 0.55;
    } else {
      base.points = Math.round((80 + tier * 40) * rm);
      base.exp = Math.round((60 + tier * 20) * rm);
      base.skillChip = 5 + tier;
      base.equipChance = 0.15;
    }
    return base;
  }

  // 结算奖励（含装备掉落）
  function grantRewards(worldId, diff, stage, kind) {
    const r = battleRewards(worldId, diff, stage, kind);
    const got = [];
    const Core = window.Core;
    if (r.points) { Core.addCur('points', r.points); got.push({ k: 'points', v: r.points }); }
    if (r.story) { Core.addCur('story', r.story); got.push({ k: 'story', v: r.story }); }
    if (r.otherworld) { Core.addCur('otherworld', r.otherworld); got.push({ k: 'otherworld', v: r.otherworld }); }
    if (r.skillChip) { Core.addCur('skillChip', r.skillChip); got.push({ k: 'skillChip', v: r.skillChip }); }
    if (r.bloodCrystal) { Core.addCur('bloodCrystal', r.bloodCrystal); got.push({ k: 'bloodCrystal', v: r.bloodCrystal }); }
    if (Math.random() < r.equipChance) {
      const cap = D.stageDropCap(stage);
      let rarity = D.rollRarity(diff, r.equipMin);
      if (!r.equipMin) rarity = D.capRarity(rarity, cap);   // Boss保底不受上限影响
      const res = Core.grantEquip(worldId, rarity);
      if (res.equip) got.push({ k: 'equip', v: res.equip });
      else if (res.sold) got.push({ k: 'otherworld', v: res.gain, sold: true });
    }
    // 地狱 Boss：5% 掉落 SSR 伙伴专属装备
    if (kind === 'boss' && diff === 'hell' && Math.random() < 0.05) {
      const sig = D.SIGNATURE_EQUIPS[Math.floor(Math.random() * D.SIGNATURE_EQUIPS.length)];
      const sigRes = Core.grantSignatureEquip(D.SIGNATURE_EQUIPS.indexOf(sig));
      if (sigRes.equip) got.push({ k: 'equip', v: sigRes.equip, signature: true });
      else if (sigRes.sold) got.push({ k: 'otherworld', v: sigRes.gain, sold: true });
    }
    if (r.exp) got.push({ k: 'exp', v: r.exp });
    return { rewards: r, got };
  }

  // 关卡路线：3 步选择 + 最终战
  const NODE_TYPES = ['combat', 'elite', 'event', 'chest', 'heal'];
  function genRoute(worldId, stage) {
    const steps = [];
    const stepCount = 3;
    for (let i = 0; i < stepCount; i++) {
      const opts = [];
      while (opts.length < 2) {
        let t = NODE_TYPES[Math.floor(Math.random() * NODE_TYPES.length)];
        if (stage <= 2 && t === 'elite') t = 'combat';
        if (opts.includes(t)) continue;
        opts.push(t);
      }
      steps.push(opts);
    }
    const events = D.EVENTS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
    return { steps, events, finalKind: stage === 12 ? 'boss' : stage % 4 === 0 ? 'elite' : 'combat' };
  }

  // 宝箱节点奖励
  function nodeReward(type, worldId, diff, stage) {
    const Core = window.Core;
    if (type === 'chest') {
      const cap = D.stageDropCap(stage);
      const rarity = D.capRarity(D.rollRarity(diff, Math.random() < 0.3 ? 'SR' : null), cap);
      const res = Core.grantEquip(worldId, rarity);
      const pts = Math.round(100 * rewardMult(diff));
      Core.addCur('points', pts);
      return { points: pts, equip: res.equip || null, sold: res.sold, gain: res.gain };
    }
    return null;
  }

  // 扫荡
  function sweep(worldId, diff, stage, times) {
    const Core = window.Core;
    if (!Core.S.worlds[worldId] || Core.S.worlds[worldId].stages[diff][stage - 1] <= 0) {
      return { ok: false, msg: '通关后才能扫荡' };
    }
    // 每日扫荡上限
    if (Core.S.sweep.date !== Core.dailyDate()) { Core.S.sweep.date = Core.dailyDate(); Core.S.sweep.count = 0; }
    const left = D.SWEEP_DAILY_CAP - Core.S.sweep.count;
    if (left <= 0) { Core.save(); return { ok: false, msg: `今日扫荡次数已用完（${D.SWEEP_DAILY_CAP}/${D.SWEEP_DAILY_CAP}）` }; }
    const n = Math.min(times, left);
    const total = [];
    for (let i = 0; i < n; i++) total.push(grantRewards(worldId, diff, stage, stage === 12 ? 'boss' : stage % 4 === 0 ? 'elite' : 'combat'));
    Core.S.sweep.count += n;
    Core.save();
    return { ok: true, total, count: n, capped: n < times };
  }

  return { makeEnemies, battleRewards, grantRewards, genRoute, nodeReward, sweep, diffMult, stageMult, THEME_FACTION };
})();
