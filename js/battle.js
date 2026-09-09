/* 《无限轮回》战斗引擎：同步计算整局战斗，输出帧序列供 UI 播放 */
window.Battle = (function () {
  const D = window.DATA;

  /* ---------- 世界机制 ---------- */
  const MECHANICS = {
    W01: { onEnemyHit(t) { if (Math.random() < 0.30) addStatus(t, 'poison', 2); }, note: '感染' },
    W02: { enemySpd: 1.2, onEnemyHit(t) { if (Math.random() < 0.30) addStatus(t, 'bleed', 2); }, note: '突袭/流血' },
    W03: { onEnemyHit(t) { if (Math.random() < 0.25) addStatus(t, 'weak', 2); }, note: '恐惧' },
    W04: { onEnemyHit(t) { if (Math.random() < 0.15) addStatus(t, 'stun', 1); }, bossRevive: true, note: '陷阱/复活' },
    W05: { onEnemyHit(t, frames) { if (Math.random() < 0.03 && t.hp > 1) { t.hp = 1; frames.push({ type: 'instantkill', target: t.uid }); } }, note: '即死判定' },
    W06: { enemyShield: 0.2, note: '护盾' },
    W07: { onEnemyHit(t) { if (Math.random() < 0.20) addStatus(t, 'stun', 1); }, note: '睡眠' },
    W08: { allyHitMod: -0.15, note: '浓雾' },
    W09: { onEnemyHit(t) { if (Math.random() < 0.30) addStatus(t, 'bleed', 3); }, note: '撕裂' },
    W10: { onEnemyHit(t) { if (Math.random() < 0.35) addStatus(t, 'poison', 3); }, note: '中毒' },
    W11: { bossSummon: true, enemyLifesteal: 0.2, note: '召唤/吸血' },
    W12: { onEnemyHit(t) { if (Math.random() < 0.25) addStatus(t, 'sunder', 2); }, note: '腐化' },
    W13: { onEnemyHit(t) { if (Math.random() < 0.20) addStatus(t, 'freeze', 1); }, note: '冰冻' },
    W14: { randomRule: true, note: '随机规则' },
  };

  let uidSeq = 0;
  function addStatus(unit, id, turns, extra) {
    // 异常抗性
    const isDebuff = ['poison', 'burn', 'bleed', 'stun', 'freeze', 'weak', 'sunder', 'fear'].includes(id);
    if (isDebuff && unit.resPct && Math.random() < unit.resPct) return false;
    const ex = unit.statuses.find(s => s.id === id);
    if (ex) ex.turns = Math.max(ex.turns, turns);
    else unit.statuses.push(Object.assign({ id, turns }, extra || {}));
    return true;
  }
  function hasStatus(unit, id) { return unit.statuses.some(s => s.id === id); }
  function getBuffs(unit) {
    const b = { atkPct: 0, defPct: 0, critPct: 0, skillPct: 0, evaPct: 0, lifesteal: 0, poisonOnHit: 0 };
    unit.statuses.forEach(s => {
      if (s.id === 'buff') Object.keys(b).forEach(k => { b[k] += (s[k] || 0); });
      if (s.id === 'debuff') { b.atkPct += (s.atkPct || 0); b.defPct += (s.defPct || 0); }
    });
    if (hasStatus(unit, 'weak')) b.atkPct -= 0.25;
    if (hasStatus(unit, 'sunder')) b.defPct -= 0.30;
    return b;
  }

  function dealDamage(src, dst, mult, opts, frames, log) {
    opts = opts || {};
    const sb = getBuffs(src), db = getBuffs(dst);
    let atk = src.atk * (1 + sb.atkPct);
    if (src.kind === 'warrior' && src.hp / src.maxHp < 0.5) atk *= 1.2; // 嗜战
    let def = Math.max(1, dst.def * (1 + db.defPct));
    if (opts.pierce) def *= (1 - opts.pierce);
    let dmg = (atk * atk) / (atk + def) * (mult || 1);
    if (src.side === 'ally') dmg *= (src.skillMult || 1) * (1 + sb.skillPct);
    // 命中/闪避
    let hitChance = 0.95 + (opts.hitMod || 0) - Math.min(0.6, dst.eva + db.evaPct);
    hitChance = Math.max(0.3, Math.min(1, hitChance));
    if (Math.random() > hitChance) {
      frames.push({ type: 'dodge', target: dst.uid });
      return 0;
    }
    // 暴击
    let crit = false;
    const critRate = Math.min(0.6, (src.crit || 0.05) + sb.critPct + (src.kind === 'assassin' ? 0.10 : 0));
    if (opts.sureCrit || Math.random() < critRate) {
      crit = true;
      let cd = (src.critDmg || 2.0) + (src.kind === 'ranger' ? 0.25 : 0);
      dmg *= cd;
    }
    // 阵营克制（玩家阵营 vs 敌人无阵营，敌人按世界主题映射阵营）
    if (src.faction && dst.faction) {
      if (D.FACTION_COUNTER[src.faction] === dst.faction) dmg *= 1.15;
      else if (D.FACTION_COUNTER[dst.faction] === src.faction) dmg *= 0.90;
    }
    dmg *= 0.9 + Math.random() * 0.2;
    if (hasStatus(dst, 'bleed')) dmg *= 1.15;
    if (dst.kind === 'tank') dmg *= 0.88;
    dmg = Math.max(1, Math.round(dmg));
    // 护盾
    let absorbed = 0;
    if (dst.shield > 0) {
      absorbed = Math.min(dst.shield, dmg);
      dst.shield -= absorbed;
      dmg -= absorbed;
    }
    dst.hp = Math.max(0, dst.hp - dmg);
    // 吸血
    const ls = (src.lifesteal || 0) + sb.lifesteal;
    let healed = 0;
    if (ls > 0 && dmg > 0) {
      healed = Math.round(dmg * ls);
      src.hp = Math.min(src.maxHp, src.hp + healed);
    }
    src.energy = Math.min(100, (src.energy || 0) + 30);
    dst.energy = Math.min(100, (dst.energy || 0) + 15);
    frames.push({ type: 'damage', source: src.uid, target: dst.uid, dmg, crit, absorbed, healed, killed: dst.hp <= 0 });
    if (opts.execute && dst.hp / dst.maxHp < 0.5 && dmg > 0) {
      const extra = Math.round(dmg * 0.5);
      dst.hp = Math.max(0, dst.hp - extra);
      frames.push({ type: 'damage', source: src.uid, target: dst.uid, dmg: extra, crit: false, execute: true, killed: dst.hp <= 0 });
    }
    return dmg;
  }

  function healUnit(src, dst, mult, frames) {
    let amount = src.side === 'ally' ? src.atk * mult * (src.skillMult || 1) : src.atk * mult;
    if (src.kind === 'healer') amount *= 1.2;
    amount = Math.round(amount * (0.9 + Math.random() * 0.2));
    dst.hp = Math.min(dst.maxHp, dst.hp + amount);
    frames.push({ type: 'heal', source: src.uid, target: dst.uid, amount });
  }

  function alive(units) { return units.filter(u => u.hp > 0); }
  function pickTarget(src, enemies, preferred) {
    const list = alive(enemies);
    if (!list.length) return null;
    const taunter = list.find(u => hasStatus(u, 'taunt'));
    if (taunter && src.side !== taunter.side) return taunter;
    if (preferred === 'lowest') return list.reduce((a, b) => (a.hp / a.maxHp < b.hp / b.maxHp ? a : b));
    if (preferred === 'boss') return list.find(u => u.isBoss) || list[0];
    // 敌人优先打前排
    if (src.side === 'enemy') {
      const front = list.filter(u => u.position === 'front');
      const pool = front.length ? front : list;
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return list[Math.floor(Math.random() * list.length)];
  }

  /* ---------- 敌人构造 ---------- */
  function makeEnemyUnit(spec, side) {
    return Object.assign({
      uid: 'e' + (uidSeq++), side: side || 'enemy', name: spec.name, faction: spec.faction || null,
      maxHp: spec.hp, hp: spec.hp, atk: spec.atk, def: spec.def, spd: spec.spd || 60,
      crit: 0.05, critDmg: 2.0, eva: spec.eva || 0.02, skillMult: 1, lifesteal: spec.lifesteal || 0,
      resPct: spec.resPct || 0, energy: 0, statuses: [], shield: spec.shield || 0,
      isBoss: !!spec.isBoss, isElite: !!spec.isElite, kind: 'mob',
      phase70: false, phase30: false, revived: false, summoned: false,
    }, {});
  }

  /* ---------- 主流程 ---------- */
  // cfg: { allies:[unitSpec], enemies:[unitSpec], worldId, maxRounds, allyHitMod }
  function run(cfg) {
    const frames = [];
    const mech = MECHANICS[cfg.worldId] || {};
    const allies = cfg.allies.map(spec => {
      const u = makeEnemyUnit(spec, 'ally');
      u.kind = spec.kind; u.faction = spec.faction; u.position = spec.position;
      u.skills = spec.skills; u.skillLv = spec.skillLv || [1, 1, 1];
      u.name = spec.name;
      return u;
    });
    const enemies = cfg.enemies.map(spec => makeEnemyUnit(spec));
    if (mech.enemyShield) enemies.forEach(u => { u.shield = Math.round(u.maxHp * mech.enemyShield); });
    if (mech.enemySpd) enemies.forEach(u => { u.spd *= mech.enemySpd; });
    if (mech.enemyLifesteal) enemies.forEach(u => { u.lifesteal += mech.enemyLifesteal; });
    const all = allies.concat(enemies);
    all.forEach(u => { u.name = u.name || '敌人'; });
    frames.push({ type: 'start', allies: allies.map(publicUnit), enemies: enemies.map(publicUnit), note: mech.note });

    const maxRounds = cfg.maxRounds || (enemies.some(e => e.isBoss) ? 50 : 30);
    let win = false;
    let round = 0;

    for (round = 1; round <= maxRounds; round++) {
      frames.push({ type: 'round', n: round });
      // W14 随机规则
      if (mech.randomRule) {
        const rules = ['atkUp', 'defDown', 'spdUp'];
        const rule = rules[round % 3];
        const pool = rule === 'defDown' ? allies : enemies;
        pool.forEach(u => addStatus(u, 'debuff', 1, rule === 'defDown' ? { defPct: -0.2 } : { atkPct: 0.15 }));
        frames.push({ type: 'rule', text: rule === 'atkUp' ? '主神规则：敌方攻击提升' : rule === 'defDown' ? '主神规则：我方防御下降' : '主神规则：敌方速度提升' });
      }
      // 回合开始：DOT / 恢复
      for (const u of all) {
        if (u.hp <= 0) continue;
        for (const s of u.statuses) {
          if (s.id === 'poison' || s.id === 'burn') {
            const dot = Math.max(1, Math.round(u.maxHp * (s.id === 'poison' ? 0.05 : 0.06)));
            u.hp = Math.max(0, u.hp - dot);
            frames.push({ type: 'dot', target: u.uid, status: s.id, dmg: dot, killed: u.hp <= 0 });
          }
          if (s.id === 'regen') {
            const amt = Math.round(u.maxHp * 0.06);
            u.hp = Math.min(u.maxHp, u.hp + amt);
            frames.push({ type: 'heal', target: u.uid, amount: amt, status: 'regen' });
          }
        }
      }
      if (!checkEnd()) break;
      // 行动顺序
      const order = alive(all).sort((a, b) => b.spd * (0.95 + Math.random() * 0.1) - a.spd * (0.95 + Math.random() * 0.1));
      for (const u of order) {
        if (u.hp <= 0) continue;
        // 眩晕/冰冻
        if (hasStatus(u, 'stun') || hasStatus(u, 'freeze')) {
          frames.push({ type: 'skip', actor: u.uid, reason: hasStatus(u, 'stun') ? 'stun' : 'freeze' });
          continue;
        }
        const foes = u.side === 'ally' ? enemies : allies;
        const friends = u.side === 'ally' ? allies : enemies;
        if (!alive(foes).length) break;
        act(u, foes, friends, frames, mech, cfg);
        if (!checkEnd()) break;
      }
      // Boss 复活检查（需遍历所有 Boss，含已死亡）
      if (mech.bossRevive) {
        for (const boss of enemies.filter(e => e.isBoss)) {
          if (!boss.revived && boss.hp <= 0) {
            boss.revived = true;
            boss.hp = Math.round(boss.maxHp * 0.3);
            frames.push({ type: 'revive', boss: boss.uid, text: `${boss.name} 从灰烬中复活！` });
          }
        }
      }
      // Boss 阶段
      for (const boss of enemies.filter(e => e.isBoss && e.hp > 0)) {
        const ratio = boss.hp / boss.maxHp;
        if (!boss.phase70 && ratio <= 0.70) {
          boss.phase70 = true;
          boss.atk *= 1.2;
          frames.push({ type: 'phase', boss: boss.uid, phase: 70, text: `${boss.name} 进入第二阶段！攻击提升` });
        }
        if (!boss.phase30 && ratio <= 0.30) {
          boss.phase30 = true;
          boss.atk *= 1.3;
          boss.spd *= 1.2;
          frames.push({ type: 'phase', boss: boss.uid, phase: 30, text: `${boss.name} 狂暴了！` });
        }
        if (mech.bossSummon && !boss.summoned && ratio <= 0.5) {
          boss.summoned = true;
          const add = makeEnemyUnit({ name: '被召唤的亡灵', hp: Math.round(boss.maxHp * 0.25), atk: boss.atk * 0.6, def: boss.def * 0.6, spd: 50 });
          enemies.push(add); all.push(add);
          frames.push({ type: 'summon', enemy: publicUnit(add), text: `${boss.name} 召唤了亡灵！` });
        }
      }
      if (!checkEnd()) break;
      // 状态计时
      all.forEach(u => {
        u.statuses.forEach(s => { s.turns--; });
        u.statuses = u.statuses.filter(s => s.turns > 0);
        Object.keys(u.cds || {}).forEach(k => { if (u.cds[k] > 0) u.cds[k]--; });
      });
    }
    win = alive(allies).length > 0 && !alive(enemies).length;
    frames.push({ type: 'end', win, rounds: Math.min(round, maxRounds), timeout: round > maxRounds });
    return { frames, win, rounds: Math.min(round, maxRounds) };

    function checkEnd() {
      if (!alive(enemies).length || !alive(allies).length) return false;
      return true;
    }
  }

  function publicUnit(u) {
    return { uid: u.uid, name: u.name, side: u.side, maxHp: u.maxHp, hp: u.hp, isBoss: u.isBoss, position: u.position, kind: u.kind };
  }

  /* ---------- 单位行动 ---------- */
  function act(u, foes, friends, frames, mech, cfg) {
    u.cds = u.cds || { s1: 0, s2: 0 };
    const isAlly = u.side === 'ally';
    const sb = getBuffs(u);
    // ===== 盟友技能 AI =====
    if (isAlly && u.skills) {
      const skillMultLv = i => 1 + (u.skillLv[i] - 1) * 0.07;
      // 必杀
      if (u.energy >= 100) {
        u.energy = 0;
        castSkill(u, u.skills.ult, 2, foes, friends, frames, mech, cfg, skillMultLv(2), true);
        return;
      }
      const liveFriends = alive(friends);
      const lowAlly = liveFriends.length ? liveFriends.reduce((a, b) => (a.hp / a.maxHp < b.hp / b.maxHp ? a : b)) : null;
      // 治疗优先
      if (u.kind === 'healer' && lowAlly && lowAlly.hp / lowAlly.maxHp < 0.55 && u.cds.s1 <= 0) {
        u.cds.s1 = u.skills.s1.cd; castSkill(u, u.skills.s1, 0, foes, friends, frames, mech, cfg, skillMultLv(0)); return;
      }
      // 控制优先打 Boss
      if (u.kind === 'controller' && u.cds.s1 <= 0 && alive(foes).some(f => f.isBoss)) {
        u.cds.s1 = u.skills.s1.cd; castSkill(u, u.skills.s1, 0, foes, friends, frames, mech, cfg, skillMultLv(0)); return;
      }
      if (u.cds.s1 <= 0) { u.cds.s1 = u.skills.s1.cd; castSkill(u, u.skills.s1, 0, foes, friends, frames, mech, cfg, skillMultLv(0)); return; }
      if (u.cds.s2 <= 0) { u.cds.s2 = u.skills.s2.cd; castSkill(u, u.skills.s2, 1, foes, friends, frames, mech, cfg, skillMultLv(1)); return; }
    }
    // ===== 敌人技能 =====
    if (!isAlly) {
      // Boss 特殊技（每 4 行动一次 AOE）
      u.actCount = (u.actCount || 0) + 1;
      if (u.isBoss && u.actCount % 4 === 0) {
        frames.push({ type: 'skill', actor: u.uid, name: '毁灭冲击' });
        alive(foes).forEach(t => dealDamage(u, t, 1.5, { hitMod: 0.1 }, frames));
        alive(foes).forEach(t => { if (mech.onEnemyHit) mech.onEnemyHit(t, frames); });
        return;
      }
      if (u.isElite && u.actCount % 3 === 0) {
        const t = pickTarget(u, foes);
        frames.push({ type: 'skill', actor: u.uid, name: '猛击' });
        if (t) dealDamage(u, t, 1.8, {}, frames);
        if (t && mech.onEnemyHit) mech.onEnemyHit(t, frames);
        return;
      }
    }
    // ===== 普攻 =====
    const target = pickTarget(u, foes);
    if (!target) return;
    frames.push({ type: 'attack', actor: u.uid });
    const hitMod = u.side === 'ally' ? (cfg.allyHitMod || 0) : 0;
    dealDamage(u, target, 1.0, { hitMod }, frames);
    if (u.side === 'enemy' && mech.onEnemyHit) mech.onEnemyHit(target, frames);
    if (sb.poisonOnHit && target.hp > 0) addStatus(target, 'poison', sb.poisonOnHit);
  }

  function castSkill(u, sk, idx, foes, friends, frames, mech, cfg, lvMult, isUlt) {
    frames.push({ type: 'skill', actor: u.uid, name: sk.name, ult: !!isUlt });
    const mult = sk.mult * (lvMult || 1);
    const targetsOf = t => {
      if (t === 'allEnemies') return alive(foes);
      if (t === 'team') return alive(friends);
      if (t === 'self') return [u];
      if (t === 'lowest') return [alive(friends).reduce((a, b) => (a.hp / a.maxHp < b.hp / b.maxHp ? a : b))];
      if (t === 'topAlly') return [alive(friends).reduce((a, b) => (a.atk > b.atk ? a : b))];
      if (t === 'random') return [pickTarget(u, foes)];
      return [pickTarget(u, foes, alive(foes).some(f => f.isBoss) && Math.random() < 0.7 ? 'boss' : null)];
    };
    switch (sk.type) {
      case 'dmg': {
        const hits = sk.hits || 1;
        for (let h = 0; h < hits; h++) {
          const ts = targetsOf(sk.target).filter(Boolean);
          let dealt = 0;
          ts.forEach(t => {
            dealt += dealDamage(u, t, mult, { pierce: sk.pierce, sureCrit: sk.sureCrit, execute: sk.execute, hitMod: cfg.allyHitMod || 0 }, frames);
            if (sk.status && t.hp > 0) {
              const st = sk.status;
              if (!st.chance || Math.random() < st.chance) {
                if (st.self) addStatus(u, st.id, st.turns);
                else addStatus(t, st.id, st.turns);
              }
            }
          });
          if (sk.lifesteal && dealt > 0) {
            const healed = Math.round(dealt * sk.lifesteal);
            u.hp = Math.min(u.maxHp, u.hp + healed);
            frames.push({ type: 'heal', source: u.uid, target: u.uid, amount: healed, lifesteal: true });
          }
        }
        break;
      }
      case 'heal': {
        targetsOf(sk.target).filter(Boolean).forEach(t => {
          healUnit(u, t, mult, frames);
          if (sk.status) addStatus(t, sk.status.id, sk.status.turns);
        });
        break;
      }
      case 'cleanseHeal': {
        targetsOf(sk.target).filter(Boolean).forEach(t => {
          const bad = t.statuses.find(s => ['poison', 'burn', 'bleed', 'stun', 'freeze', 'weak', 'sunder', 'fear'].includes(s.id));
          if (bad) t.statuses = t.statuses.filter(s => s !== bad);
          healUnit(u, t, mult, frames);
        });
        break;
      }
      case 'shield': {
        targetsOf(sk.target).filter(Boolean).forEach(t => {
          t.shield = (t.shield || 0) + Math.round(t.maxHp * mult);
          frames.push({ type: 'shield', target: t.uid, amount: Math.round(t.maxHp * mult) });
        });
        break;
      }
      case 'teamshield': {
        targetsOf(sk.target).filter(Boolean).forEach(t => {
          t.shield = (t.shield || 0) + Math.round(t.maxHp * mult);
          frames.push({ type: 'shield', target: t.uid, amount: Math.round(t.maxHp * mult) });
          if (sk.buff) addStatus(t, 'buff', sk.buff.turns, sk.buff);
        });
        break;
      }
      case 'buff': case 'debuff': {
        targetsOf(sk.target).filter(Boolean).forEach(t => {
          addStatus(t, sk.type === 'buff' ? 'buff' : 'debuff', sk.buff.turns, sk.buff);
          frames.push({ type: 'buff', target: t.uid, name: sk.name });
        });
        break;
      }
      case 'energy': {
        targetsOf(sk.target).filter(Boolean).forEach(t => {
          t.energy = Math.min(100, (t.energy || 0) + sk.mult);
          frames.push({ type: 'buff', target: t.uid, name: '能量+' + sk.mult });
        });
        break;
      }
    }
  }

  return { run, MECHANICS };
})();
