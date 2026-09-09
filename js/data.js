/* 《无限轮回》静态数据库 —— 依据 V5.0《完整内容数据库》冻结版落地 */
window.DATA = (function () {
  // 确定性随机（保证每次加载生成的数据一致）
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(20260909);
  const ri = (min, max) => min + Math.floor(rng() * (max - min + 1));

  /* ================= 基础常量 ================= */
  const ATTR_NAMES = { muscle: '肌肉', immune: '免疫', cell: '细胞', nerve: '神经', intelligence: '智力', spirit: '精神' };
  const RARITIES = ['N', 'R', 'SR', 'SSR', 'UR'];
  const RARITY_COLOR = { N: '#9aa4b2', R: '#4da3ff', SR: '#b06bff', SSR: '#ffb03a', UR: '#ff4d6d' };
  const STAR_MULT = [1, 1.10, 1.22, 1.36, 1.52, 1.70];
  const RARITY_MAXSTAR = { N: 3, R: 4, SR: 5, SSR: 6, UR: 6 };
  const STAR_COST = [0, 50, 100, 180, 300, 500];            // 1→2…5→6 所需碎片
  const DUP_SHARDS = { N: 20, R: 40, SR: 80, SSR: 160, UR: 320 };
  const FACTIONS = ['先锋', '策略', '科技', '异能'];
  // 克制环：先锋→策略→科技→异能→先锋（克制方伤害+15%，被克-10%）
  const FACTION_COUNTER = { '先锋': '策略', '策略': '科技', '科技': '异能', '异能': '先锋' };

  // 经验表：Lv→Lv+1 所需 EXP = round(100 × Lv^1.55)；角色升级另耗点数 round(50 × 1.075^(Lv-1))
  const EXP_TABLE = [0];
  const LEVEL_POINTS = [0];
  for (let lv = 1; lv <= 100; lv++) {
    EXP_TABLE[lv] = Math.round(100 * Math.pow(lv, 1.55));
    LEVEL_POINTS[lv] = Math.round(50 * Math.pow(1.075, lv - 1));
  }

  const CURRENCIES = [
    { id: 'points',     name: '点数',     icon: '◈', color: '#ffd76a' },
    { id: 'story',      name: '故事点',   icon: '❖', color: '#7ee0a3' },
    { id: 'otherworld', name: '异界结晶', icon: '◆', color: '#6ec6ff' },
    { id: 'holy',       name: '圣洁晶石', icon: '✦', color: '#ff9ecb' },
    { id: 'skillChip',  name: '技能芯片', icon: '▣', color: '#c5a3ff' },
    { id: 'bloodCrystal', name: '血统结晶', icon: '❥', color: '#ff6b6b' },
    { id: 'corridor',   name: '回廊徽记', icon: '♜', color: '#8be9e9' },
    { id: 'rp',         name: '转生点',   icon: '♾', color: '#ffe08a' },
  ];

  /* ================= 角色 ================= */
  // 定位 → 战斗模板
  const ROLE_KIND = {
    '战士': 'warrior', '狂战': 'warrior', '近战输出': 'warrior', '全能战士': 'warrior', '终极狂战': 'warrior', '反击坦克': 'tank',
    '坦克': 'tank', '重装': 'tank',
    '射手': 'ranger', '狙击': 'ranger', '重火力': 'ranger', '能量炮': 'ranger', '星舰炮手': 'ranger', '无人机': 'ranger',
    '法师': 'mage', '爆发法师': 'mage', '冰法': 'mage', '火焰': 'mage', '元素大师': 'mage',
    '治疗': 'healer', '群体治疗': 'healer', '圣愈': 'healer', '终极治疗': 'healer',
    '控制': 'controller', '精神控制': 'controller', '控场': 'controller', '精神支配': 'controller', '终极控制': 'controller', '精神爆发': 'mage',
    '刺客': 'assassin', '暗杀': 'assassin', '终极刺客': 'assassin',
    '剑士': 'saber', '剑修': 'saber', '法剑': 'saber', '终极剑修': 'saber',
    '辅助': 'support', '全能辅助': 'support', '增益': 'support', '法阵': 'support', '法阵大师': 'support',
    '吸血': 'vampire', '吸血辅助': 'vampire',
  };
  const ROLE_WEIGHT = {
    warrior:    [1.5, 1.0, 1.1, 1.0, 0.5, 0.6],
    tank:       [1.1, 1.6, 1.5, 0.6, 0.4, 0.4],
    ranger:     [1.0, 0.7, 0.8, 1.6, 1.1, 0.5],
    mage:       [0.4, 0.7, 0.8, 1.0, 1.7, 1.4],
    healer:     [0.5, 0.9, 1.2, 0.9, 1.2, 1.7],
    controller: [0.4, 0.7, 0.8, 1.5, 1.4, 1.6],
    assassin:   [1.3, 0.6, 0.8, 1.8, 0.8, 0.7],
    support:    [0.5, 1.0, 1.0, 1.0, 1.3, 1.5],
    saber:      [1.2, 0.8, 0.9, 1.4, 1.1, 0.8],
    vampire:    [1.2, 0.8, 1.2, 1.3, 0.8, 0.9],
  };
  const ATK_ATTR = { mage: 'intelligence', controller: 'intelligence', healer: 'spirit', support: 'spirit' };

  // 技能模板（按战斗模板）：技能1(CD3) / 技能2(CD5) / 必杀(能量100) / 被动
  const SKILL_TPL = {
    warrior: {
      s1: { name: '重斩', desc: '对单体造成 180% 伤害', cd: 3, type: 'dmg', mult: 1.8, target: 'enemy' },
      s2: { name: '战意觉醒', desc: '自身攻击 +30%，持续 3 回合', cd: 5, type: 'buff', buff: { atkPct: 0.3, turns: 3 }, target: 'self' },
      ult: { name: '裂空斩', desc: '对单体造成 380% 伤害并附加破甲 2 回合', type: 'dmg', mult: 3.8, status: { id: 'sunder', turns: 2 }, target: 'enemy' },
      passive: { name: '嗜战', desc: '生命低于 50% 时攻击 +20%' },
    },
    tank: {
      s1: { name: '盾击', desc: '造成 120% 伤害并嘲讽 2 回合', cd: 3, type: 'dmg', mult: 1.2, status: { id: 'taunt', turns: 2, self: true }, target: 'enemy' },
      s2: { name: '铁壁', desc: '获得 25% 最大生命的护盾', cd: 5, type: 'shield', mult: 0.25, target: 'self' },
      ult: { name: '主神壁垒', desc: '全队获得 20% 最大生命护盾并减伤 20%（2 回合）', type: 'teamshield', mult: 0.20, buff: { defPct: 0.2, turns: 2 }, target: 'team' },
      passive: { name: '坚韧', desc: '受到伤害 -12%' },
    },
    ranger: {
      s1: { name: '连射', desc: '对随机敌人射击 2 次，每次 90% 伤害', cd: 3, type: 'dmg', mult: 0.9, hits: 2, target: 'random' },
      s2: { name: '瞄准', desc: '自身暴击率 +25%，持续 3 回合', cd: 5, type: 'buff', buff: { critPct: 0.25, turns: 3 }, target: 'self' },
      ult: { name: '毁灭狙击', desc: '对单体造成 420% 伤害，必定暴击', type: 'dmg', mult: 4.2, sureCrit: true, target: 'enemy' },
      passive: { name: '猎手直觉', desc: '暴击伤害 +25%' },
    },
    mage: {
      s1: { name: '元素冲击', desc: '对单体造成 190% 伤害并附加燃烧 2 回合', cd: 3, type: 'dmg', mult: 1.9, status: { id: 'burn', turns: 2 }, target: 'enemy' },
      s2: { name: '法力涌动', desc: '全队技能伤害 +15%，持续 3 回合', cd: 5, type: 'buff', buff: { skillPct: 0.15, turns: 3 }, target: 'team' },
      ult: { name: '陨星坠落', desc: '对敌方全体造成 260% 伤害', type: 'dmg', mult: 2.6, target: 'allEnemies' },
      passive: { name: '元素亲和', desc: '技能伤害 +12%' },
    },
    healer: {
      s1: { name: '治疗术', desc: '治疗生命最低的队友 220% 精神', cd: 3, type: 'heal', mult: 2.2, target: 'lowest' },
      s2: { name: '净化', desc: '清除全队 1 个异常状态并治疗 120% 精神', cd: 5, type: 'cleanseHeal', mult: 1.2, target: 'team' },
      ult: { name: '生命礼赞', desc: '全队治疗 300% 精神并附加持续恢复 2 回合', type: 'heal', mult: 3.0, status: { id: 'regen', turns: 2 }, target: 'team' },
      passive: { name: '仁心', desc: '治疗效果 +20%' },
    },
    controller: {
      s1: { name: '精神锁链', desc: '造成 130% 伤害并 40% 概率眩晕 1 回合', cd: 3, type: 'dmg', mult: 1.3, status: { id: 'stun', turns: 1, chance: 0.4 }, target: 'enemy' },
      s2: { name: '恐惧低语', desc: '敌方全体攻击 -20%，持续 2 回合', cd: 5, type: 'debuff', buff: { atkPct: -0.2, turns: 2 }, target: 'allEnemies' },
      ult: { name: '思维禁锢', desc: '对单体造成 300% 伤害并眩晕 1 回合', type: 'dmg', mult: 3.0, status: { id: 'stun', turns: 1 }, target: 'enemy' },
      passive: { name: '精神场', desc: '敌方全体速度 -5%' },
    },
    assassin: {
      s1: { name: '背刺', desc: '造成 200% 伤害，对生命低于 50% 的目标 +50%', cd: 3, type: 'dmg', mult: 2.0, execute: true, target: 'enemy' },
      s2: { name: '淬毒', desc: '普攻附加中毒 2 回合，持续 3 回合', cd: 5, type: 'buff', buff: { poisonOnHit: 2, turns: 3 }, target: 'self' },
      ult: { name: '影杀', desc: '对单体造成 400% 伤害并附加流血 3 回合', type: 'dmg', mult: 4.0, status: { id: 'bleed', turns: 3 }, target: 'enemy' },
      passive: { name: '致命节奏', desc: '暴击率 +10%' },
    },
    support: {
      s1: { name: '激励', desc: '攻击最高的队友攻击 +25%，持续 2 回合', cd: 3, type: 'buff', buff: { atkPct: 0.25, turns: 2 }, target: 'topAlly' },
      s2: { name: '能量灌注', desc: '为队友回复 30 点能量', cd: 5, type: 'energy', mult: 30, target: 'topAlly' },
      ult: { name: '主神祝福', desc: '全队攻击 +25%、防御 +25%，持续 3 回合', type: 'buff', buff: { atkPct: 0.25, defPct: 0.25, turns: 3 }, target: 'team' },
      passive: { name: '鼓舞', desc: '全队攻击 +6%' },
    },
    saber: {
      s1: { name: '御剑术', desc: '造成 170% 伤害并无视 30% 防御', cd: 3, type: 'dmg', mult: 1.7, pierce: 0.3, target: 'enemy' },
      s2: { name: '剑心', desc: '自身闪避 +20%，持续 3 回合', cd: 5, type: 'buff', buff: { evaPct: 0.20, turns: 3 }, target: 'self' },
      ult: { name: '万剑归宗', desc: '对敌方全体造成 220% 伤害', type: 'dmg', mult: 2.2, target: 'allEnemies' },
      passive: { name: '剑意', desc: '攻击 +10%' },
    },
    vampire: {
      s1: { name: '血之利爪', desc: '造成 160% 伤害并回复伤害 40% 的生命', cd: 3, type: 'dmg', mult: 1.6, lifesteal: 0.4, target: 'enemy' },
      s2: { name: '鲜血狂热', desc: '自身攻击 +20%、吸血 +15%，持续 3 回合', cd: 5, type: 'buff', buff: { atkPct: 0.2, lifesteal: 0.15, turns: 3 }, target: 'self' },
      ult: { name: '猩红盛宴', desc: '对敌方全体造成 200% 伤害并吸取伤害 30% 的生命', type: 'dmg', mult: 2.0, lifesteal: 0.3, target: 'allEnemies' },
      passive: { name: '血族本能', desc: '吸血 +10%' },
    },
  };

  // 60 名角色（前 20 名基础属性取自 V5.0 表格，其余按稀有度总属性区间 + 定位权重生成）
  const CHAR_TABLE = [
    ['C001', '林默', '先锋', '科技', '战士', 'N', 68, 58, 62, 52, 45, 40],
    ['C002', '周野', '先锋', '狼人', '坦克', 'N', 72, 65, 70, 45, 38, 35],
    ['C003', '唐宁', '策略', '魔法', '法师', 'N', 38, 42, 45, 55, 75, 70],
    ['C004', '叶青', '支援', '修真', '治疗', 'N', 42, 50, 65, 52, 58, 72],
    ['C005', '韩森', '科技', '科技', '射手', 'N', 58, 48, 50, 70, 62, 40],
    ['C006', '苏琪', '异能', '念动力', '控制', 'N', 35, 40, 48, 65, 70, 78],
    ['C007', '顾川', '先锋', '狼人', '狂战', 'R', 82, 60, 72, 60, 40, 35],
    ['C008', '沈岳', '先锋', '科技', '重装', 'R', 78, 80, 75, 38, 35, 30],
    ['C009', '白屿', '策略', '修真', '剑士', 'R', 70, 55, 60, 72, 58, 55],
    ['C010', '苏黎', '策略', '魔法', '法师', 'R', 35, 45, 48, 62, 82, 78],
    ['C011', '江寒', '异能', '念动力', '控制', 'R', 40, 45, 55, 75, 70, 85],
    ['C012', '陆沉', '科技', '科技', '射手', 'R', 65, 52, 58, 80, 68, 40],
    ['C013', '宁雪', '支援', '血族', '吸血', 'R', 60, 48, 70, 68, 55, 60],
    ['C014', '韩墨', '先锋', '狼人', '坦克', 'R', 85, 72, 80, 42, 38, 32],
    ['C015', '林晚', '支援', '魔法', '治疗', 'R', 38, 50, 72, 58, 70, 88],
    ['C016', '赵恒', '科技', '科技', '辅助', 'R', 50, 65, 62, 55, 75, 58],
    ['C017', '陈锋', '先锋', '科技', '战士', 'R', 75, 60, 65, 62, 48, 38],
    ['C018', '苏曼', '异能', '念动力', '控制', 'R', 38, 45, 52, 70, 75, 82],
    ['C019', '方哲', '策略', '修真', '法剑', 'R', 62, 52, 55, 65, 72, 68],
    ['C020', '唐岳', '先锋', '血族', '战士', 'R', 78, 58, 70, 68, 45, 55],
    ['C021', '叶沉舟', '先锋', '狼人', '狂战', 'SR'],
    ['C022', '洛辰', '先锋', '修真', '剑修', 'SR'],
    ['C023', '沈昭', '策略', '魔法', '爆发法师', 'SR'],
    ['C024', '林霜', '支援', '血族', '吸血辅助', 'SR'],
    ['C025', '顾言', '科技', '科技', '狙击', 'SR'],
    ['C026', '白璃', '异能', '念动力', '控制', 'SR'],
    ['C027', '周启', '先锋', '科技', '重装', 'SR'],
    ['C028', '宁川', '策略', '修真', '法阵', 'SR'],
    ['C029', '苏瑾', '支援', '魔法', '群体治疗', 'SR'],
    ['C030', '唐若', '异能', '念动力', '精神爆发', 'SR'],
    ['C031', '霍青', '先锋', '狼人', '反击坦克', 'SR'],
    ['C032', '江黎', '科技', '科技', '无人机', 'SR'],
    ['C033', '司空夜', '异能', '血族', '刺客', 'SR'],
    ['C034', '云深', '策略', '修真', '增益', 'SR'],
    ['C035', '白曜', '先锋', '科技', '近战输出', 'SR'],
    ['C036', '苏岚', '支援', '血族', '治疗', 'SR'],
    ['C037', '叶辰', '策略', '魔法', '火焰', 'SR'],
    ['C038', '顾宁', '异能', '念动力', '精神控制', 'SR'],
    ['C039', '沈夜', '先锋', '血族', '暗杀', 'SSR'],
    ['C040', '洛川', '先锋', '修真', '剑修', 'SSR'],
    ['C041', '顾寒', '策略', '魔法', '冰法', 'SSR'],
    ['C042', '林渊', '科技', '科技', '重火力', 'SSR'],
    ['C043', '苏月', '支援', '念动力', '全能辅助', 'SSR'],
    ['C044', '江玄', '异能', '念动力', '控场', 'SSR'],
    ['C045', '宁无尘', '策略', '修真', '法阵大师', 'SSR'],
    ['C046', '韩烬', '先锋', '狼人', '狂战', 'SSR'],
    ['C047', '白夜', '异能', '血族', '刺客', 'SSR'],
    ['C048', '唐星', '科技', '科技', '能量炮', 'SSR'],
    ['C049', '叶璃', '支援', '魔法', '圣愈', 'SSR'],
    ['C050', '顾长风', '先锋', '科技', '全能战士', 'SSR'],
    ['C051', '沈青', '策略', '魔法', '元素大师', 'SSR'],
    ['C052', '林昭', '异能', '念动力', '精神支配', 'SSR'],
    ['C053', '司夜', '异能', '血族', '终极刺客', 'UR'],
    ['C054', '洛神', '策略', '修真', '终极剑修', 'UR'],
    ['C055', '星尘', '科技', '科技', '星舰炮手', 'UR'],
    ['C056', '白昼', '支援', '魔法', '终极治疗', 'UR'],
    ['C057', '深渊', '先锋', '狼人', '终极狂战', 'UR'],
    ['C058', '零', '异能', '念动力', '终极控制', 'UR'],
    ['C059', '楚衍', '策略', '念动力', '精神支配', 'UR', 'hidden'],
    ['C060', '郑遥', '先锋', '狼人', '终极狂战', 'UR', 'hidden'],
  ];
  const RARITY_TOTAL = { SR: [330, 390], SSR: [440, 500], UR: [540, 610] };

  const characters = CHAR_TABLE.map(row => {
    const [id, name, faction, bloodline, role, rarity, hiddenOrA, b, c, d, e, f] = row;
    const kind = ROLE_KIND[role] || 'warrior';
    let attrs;
    if (typeof hiddenOrA === 'number') {
      attrs = [hiddenOrA, b, c, d, e, f];
    } else {
      const [lo, hi] = RARITY_TOTAL[rarity];
      const total = ri(lo, hi);
      const w = ROLE_WEIGHT[kind];
      const wSum = w.reduce((s, x) => s + x, 0);
      attrs = w.map(x => Math.round(total * x / wSum));
    }
    return {
      id, name, faction, bloodline, role, kind, rarity,
      hidden: hiddenOrA === 'hidden',
      attrs: { muscle: attrs[0], immune: attrs[1], cell: attrs[2], nerve: attrs[3], intelligence: attrs[4], spirit: attrs[5] },
      skills: SKILL_TPL[kind],
    };
  });
  const charById = {};
  characters.forEach(ch => { charById[ch.id] = ch; });

  /* ================= 14 个世界 ================= */
  // 敌人基准：普通怪 HP/ATK/DEF；精英 ×(2.4/1.5/1.4)；关卡倍率 1.16^(stage-1)；Hard ×1.8；Hell ×3.2
  const WORLDS = [
    { id: 'W01', name: '生化蜂巢', theme: 'bio',    desc: 'T病毒泄露的地下研究所，感染者游荡在蜂巢深处。', hp: 900,  atk: 120, def: 70,  mechanic: '感染：敌人攻击附带中毒', boss: '蜂巢母体', bossHp: [92111, 165799, 294754],
      enemies: ['丧尸研究员', '舔食者', '猎杀者α'], elite: '变异猎杀者', unlock: null },
    { id: 'W02', name: '异形巢穴', theme: 'bio',    desc: '废弃太空站已被异形占据，黑暗里全是粘液与尾刺。', hp: 1100, atk: 150, def: 85,  mechanic: '突袭：敌人速度+20%；流血', boss: '巢穴女王', bossHp: [112580, 202644, 360255],
      enemies: ['抱脸虫', '工蜂异形', '战士异形'], elite: '禁卫异形', unlock: 'W01' },
    { id: 'W03', name: '咒怨凶宅', theme: 'ghost',  desc: '踏入这栋房子的人，都会被怨念缠上。', hp: 1250, atk: 135, def: 110, mechanic: '恐惧：降低攻击；诅咒', boss: '怨灵核心', bossHp: [133049, 239488, 425756],
      enemies: ['怨念残影', '白衣怨灵', '黑猫咒灵'], elite: '阁楼厉鬼', unlock: 'W02' },
    { id: 'W04', name: '神鬼秘陵', theme: 'mystic', desc: '黄沙之下的法老陵墓，亡灵守卫永不眠。', hp: 1500, atk: 180, def: 130, mechanic: '陷阱：随机眩晕；复活', boss: '陵墓守卫', bossHp: [163752, 294754, 524008],
      enemies: '木乃伊战士|沙暴怨灵|圣甲虫群'.split('|'), elite: '祭司亡灵', unlock: 'W03' },
    { id: 'W05', name: '死神游轮', theme: 'ghost',  desc: '死亡名单上的游轮，意外接踵而至。', hp: 1750, atk: 205, def: 150, mechanic: '即死判定：低概率直接重伤', boss: '死神船长', bossHp: [194456, 350021, 622259],
      enemies: '溺水亡魂|甲板幻影|船舱幽影'.split('|'), elite: '死亡使者', unlock: 'W04' },
    { id: 'W06', name: '星河战场', theme: 'tech',   desc: '轨道战争白热化，机械军团碾压一切。', hp: 2200, atk: 260, def: 190, mechanic: '护盾：开场获得护盾；远程炮击', boss: '轨道战争核心', bossHp: [235394, 423710, 753261],
      enemies: '机械步兵|悬浮炮台|歼灭机甲'.split('|'), elite: '轨道毁灭者', unlock: 'W05' },
    { id: 'W07', name: '猛鬼梦境', theme: 'ghost',  desc: '在梦里被杀死，现实中也会死去。', hp: 2500, atk: 240, def: 220, mechanic: '睡眠：概率无法行动；幻觉', boss: '梦魇之主', bossHp: [286567, 515820, 917014],
      enemies: '梦境傀儡|锈爪梦魔|呓语幽灵'.split('|'), elite: '噩梦编织者', unlock: 'W06' },
    { id: 'W08', name: '寂静雾镇', theme: 'ghost',  desc: '浓雾中的小镇，里世界随时降临。', hp: 2900, atk: 280, def: 250, mechanic: '浓雾：命中-15%', boss: '雾中猎人', bossHp: [347974, 626353, 1113517],
      enemies: '雾中人影|三角头|无脸护士'.split('|'), elite: '里世界行刑者', unlock: 'W07' },
    { id: 'W09', name: '侏罗纪孤岛', theme: 'bio',  desc: '基因复活的史前霸主，视人类为猎物。', hp: 3400, atk: 320, def: 270, mechanic: '撕裂：流血；群体攻击', boss: '暴龙王', bossHp: [419616, 755308, 1342770],
      enemies: '迅猛龙|双脊龙|翼龙'.split('|'), elite: '棘背龙', unlock: 'W08' },
    { id: 'W10', name: '狂蟒沼泽', theme: 'bio',    desc: '沼泽深处的巨蟒已变异成灾厄。', hp: 3800, atk: 350, def: 300, mechanic: '中毒：持续掉血；缠绕', boss: '沼泽巨蟒', bossHp: [501492, 902685, 1604774],
      enemies: '毒沼蟒|沼泽鳄|吸血水蛭'.split('|'), elite: '变异森蚺', unlock: 'W09' },
    { id: 'W11', name: '加勒比亡灵船', theme: 'mystic', desc: '月光下的诅咒船员，永远无法安息。', hp: 4300, atk: 390, def: 330, mechanic: '召唤亡灵；吸血', boss: '亡灵舰长', bossHp: [603837, 1086907, 1932279],
      enemies: '骷髅水手|诅咒炮手|腐尸船员'.split('|'), elite: '黑珍珠大副', unlock: 'W10' },
    { id: 'W12', name: '魔戒远征', theme: 'mystic', desc: '魔多大军压境，黑暗侵蚀中土。', hp: 5000, atk: 450, def: 380, mechanic: '腐化：降低防御；群体增益', boss: '黑曜王', bossHp: [742003, 1335606, 2374411],
      enemies: '半兽人|座狼骑士|戒灵侍从'.split('|'), elite: '戒灵', unlock: 'W11' },
    { id: 'W13', name: '纳尼亚王座', theme: 'mystic', desc: '白女巫的冰封王座，永冬笼罩王国。', hp: 5800, atk: 510, def: 430, mechanic: '冰冻：无法行动；王权强化', boss: '冰冠女王', bossHp: [910873, 1639572, 2914794],
      enemies: '冰狼|雪魔|霜冻武士'.split('|'), elite: '冰宫禁卫', unlock: 'W12' },
    { id: 'W14', name: '主神试炼场', theme: 'god', desc: '主神亲自设下的试炼，规则由它书写。', hp: 7000, atk: 600, def: 500, mechanic: '随机规则：每回合变化', boss: '试炼执行者', bossHp: [1125798, 2026437, 3602554],
      enemies: '试炼傀儡|规则执行体|主神幻影'.split('|'), elite: '主神代行者', unlock: 'W13' },
  ];
  const DIFFICULTY = [
    { id: 'normal', name: '普通', mult: 1.0, rewardMult: 1.0 },
    { id: 'hard',   name: '困难', mult: 1.8, rewardMult: 1.6 },
    { id: 'hell',   name: '地狱', mult: 3.2, rewardMult: 2.5 },
  ];
  const FIRST_CLEAR = { // 世界首通奖励
    normal: { holy: 100, story: 500, otherworld: 200, skillChip: 100 },
    hard:   { holy: 150, story: 800, otherworld: 400, skillChip: 200 },
    hell:   { holy: 250, story: 1200, otherworld: 800, skillChip: 400 },
  };

  /* ================= 装备 ================= */
  const EQUIP_SLOTS = { weapon: '武器', armor: '胸甲', accessory: '饰品', head: '头部', hands: '手部', legs: '腿部' };
  const RECRUIT_SLOTS = ['weapon', 'armor', 'accessory'];                       // 招募角色 3 槽
  const PLAYER_SLOTS = ['weapon', 'head', 'armor', 'hands', 'legs', 'accessory']; // 主角 6 槽（V5 §22）
  const DROP_SLOTS = ['weapon', 'armor', 'accessory', 'head', 'hands', 'legs'];
  const EQUIP_RARITY_MULT = { N: 1.00, R: 1.15, SR: 1.35, SSR: 1.65, UR: 2.00 };
  const EQUIP_AFFIX_COUNT = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4 };
  const DECOMPOSE_GAIN = { N: 5, R: 15, SR: 50, SSR: 180, UR: 600 };
  const ENHANCE_RATE = [1, 1, 1, 1, 1, 1, 0.95, 0.90, 0.85, 0.80, 0.75, 0.70, 0.65, 0.60, 0.55, 0.50, 0.45, 0.40, 0.35, 0.30, 0.25]; // +0→+1…+19→+20
  // 世界套装：2 件 / 3 件加成
  const SETS = {};
  WORLDS.forEach((w, i) => {
    SETS[w.id] = {
      name: w.name + '套装',
      b2: i % 2 === 0 ? { hpPct: 0.08 } : { atkPct: 0.08 },
      b3: i % 2 === 0 ? { atkPct: 0.12, text: '生命+8%，攻击+12%' } : { hpPct: 0.12, text: '攻击+8%，生命+12%' },
    };
  });
  const EQUIP_NAMES = {
    weapon:   { bio: ['生化军刀', '脉冲步枪', '基因切割者'], ghost: ['镇魂铃', '驱邪短刃', '缚灵符剑'], mystic: ['秘银法杖', '圣光权杖', '咒纹长剑'], tech: ['磁轨枪', '粒子刀', '湮灭炮'], god: ['主神之刃', '轮回权杖', '试炼圣枪'] },
    armor:    { bio: ['防化作战服', '蜂巢护甲', '再生殖装'], ghost: ['符咒道袍', '怨念披风', '镇宅法衣'], mystic: ['秘陵铠甲', '圣甲护胸', '咒缚长袍'], tech: ['纳米装甲', '反应外骨骼', '相位护盾'], god: ['主神战甲', '轮回之袍', '试炼圣铠'] },
    accessory:{ bio: ['血清注射器', '病毒样本', '基因稳定环'], ghost: ['护身佛珠', '盐晶挂坠', '往生铜钱'], mystic: ['圣甲虫护符', '太阳金环', '安卡十字'], tech: ['战术目镜', '神经增幅器', '能量核心'], god: ['轮回徽记', '主神腕表', '试炼徽章'] },
    head:     { bio: ['防毒面具', '战术头盔', '生化护目镜'], ghost: ['镇魂冠', '驱邪头巾', '符纸额带'], mystic: ['秘银头环', '圣光头盔', '咒纹面甲'], tech: ['战术头盔', '全息面罩', '神经头环'], god: ['主神之冕', '轮回头盔', '试炼面甲'] },
    hands:    { bio: ['防化手套', '战术手套', '基因臂铠'], ghost: ['缚灵手套', '符咒护腕', '镇魂臂甲'], mystic: ['秘银护手', '圣光手套', '咒纹臂环'], tech: ['磁力手套', '粒子臂铠', '能量护腕'], god: ['主神护手', '轮回臂铠', '试炼手套'] },
    legs:     { bio: ['防化护腿', '战术军靴', '生化腿甲'], ghost: ['疾行符靴', '镇魂护腿', '怨灵绑腿'], mystic: ['秘银护腿', '圣光战靴', '咒纹腿甲'], tech: ['磁力战靴', '喷射腿甲', '幻影护腿'], god: ['主神战靴', '轮回护腿', '试炼腿甲'] },
  };
  const AFFIX_POOL = {
    atkPct: { name: '攻击力', min: 0.02, max: 0.22, pct: true },
    critPct: { name: '暴击率', min: 0.01, max: 0.07, pct: true },
    critDmg: { name: '暴击伤害', min: 0.03, max: 0.28, pct: true },
    skillPct: { name: '技能伤害', min: 0.02, max: 0.22, pct: true },
    hpPct: { name: '生命', min: 0.03, max: 0.28, pct: true },
    defPct: { name: '防御', min: 0.02, max: 0.22, pct: true },
    resPct: { name: '异常抗性', min: 0.02, max: 0.16, pct: true },
    evaPct: { name: '闪避', min: 0.01, max: 0.07, pct: true },
  };
  const AFFIX_BY_RARITY = { N: 0.25, R: 0.4, SR: 0.6, SSR: 0.8, UR: 1.0 }; // 词条取值位置（区间内）

  // 装备实例生成：worldTier 1-14，rarity 指定，slot 指定
  function makeEquip(worldId, slot, rarity, uid) {
    const w = WORLDS.find(x => x.id === worldId) || WORLDS[0];
    const tier = WORLDS.indexOf(w) + 1;
    const mult = EQUIP_RARITY_MULT[rarity];
    const names = EQUIP_NAMES[slot][w.theme];
    const name = names[Math.floor(Math.random() * names.length)];
    const base = {};
    if (slot === 'weapon') base.atk = Math.round((22 + tier * 20) * mult);
    if (slot === 'armor') { base.def = Math.round((14 + tier * 13) * mult); base.hp = Math.round((220 + tier * 200) * mult); }
    if (slot === 'accessory') { base.spd = Math.round((8 + tier * 6) * mult); base.critPct = +(0.02 * mult).toFixed(3); }
    if (slot === 'head') { base.def = Math.round((8 + tier * 8) * mult); base.hp = Math.round((120 + tier * 110) * mult); }
    if (slot === 'hands') { base.atk = Math.round((10 + tier * 9) * mult); base.critPct = +(0.01 * mult).toFixed(3); }
    if (slot === 'legs') { base.spd = Math.round((6 + tier * 5) * mult); base.def = Math.round((6 + tier * 5) * mult); }
    const affixes = [];
    const keys = Object.keys(AFFIX_POOL);
    const n = EQUIP_AFFIX_COUNT[rarity];
    for (let i = 0; i < n; i++) {
      const k = keys[Math.floor(Math.random() * keys.length)];
      if (affixes.find(a => a.k === k)) continue;
      const pool = AFFIX_POOL[k];
      const pos = AFFIX_BY_RARITY[rarity] * (0.7 + Math.random() * 0.3);
      affixes.push({ k, v: +(pool.min + (pool.max - pool.min) * pos).toFixed(3) });
    }
    return { uid, name, slot, rarity, set: worldId, enhance: 0, base, affixes };
  }

  /* ================= 道具 ================= */
  const ITEMS = {
    heal_s: { name: '小型治疗剂', type: 'consumable', desc: '战斗中回复 20% 生命' },
    heal_m: { name: '中型治疗剂', type: 'consumable', desc: '战斗中回复 40% 生命' },
    heal_l: { name: '大型治疗剂', type: 'consumable', desc: '战斗中回复 70% 生命' },
    buff_muscle: { name: '肌肉强化剂', type: 'consumable', desc: '本场战斗肌肉+15%' },
    buff_nerve: { name: '神经刺激剂', type: 'consumable', desc: '本场战斗速度+20%' },
    exp_s: { name: '初级经验模块', type: 'exp', exp: 500 },
    exp_m: { name: '中级经验模块', type: 'exp', exp: 2000 },
    exp_l: { name: '高级经验模块', type: 'exp', exp: 10000 },
    exp_xl: { name: '超级经验模块', type: 'exp', exp: 50000 },
    mat_t1: { name: '基础金属', type: 'material', tier: 1 },
    mat_t2: { name: '强化合金', type: 'material', tier: 2 },
    mat_t3: { name: '异界合金', type: 'material', tier: 3 },
    mat_t4: { name: '虚空晶体', type: 'material', tier: 4 },
    mat_t5: { name: '主神核心', type: 'material', tier: 5 },
    box_r: { name: 'R装备箱', type: 'box', rarity: 'R' },
    box_sr: { name: 'SR装备箱', type: 'box', rarity: 'SR' },
    box_ssr: { name: 'SSR装备箱', type: 'box', rarity: 'SSR' },
    box_ur: { name: 'UR装备箱', type: 'box', rarity: 'UR' },
  };

  /* ================= 随机事件（副本节点） ================= */
  // effect: {points, holy, story, otherworld, skillChip, bloodCrystal, item, healPct, hurtPct, battle, buff}
  const EVENTS = [
    { id: 'E01', title: '废弃实验室', desc: '你发现一间废弃的实验室，操作台上还放着一个上锁的样品箱。', choices: [
      { text: '撬开样品箱', result: '箱子里是完好的补给品。', effect: { points: 300, item: 'heal_m' } },
      { text: '搜索实验记录', result: '记录里夹着一张主神兑换券碎片。', effect: { story: 30 } },
      { text: '谨慎离开', result: '安全离开，但一无所获。', effect: {} } ] },
    { id: 'E02', title: '垂死的轮回者', desc: '一名其他小队的轮回者倒在血泊中，他抓住你的脚踝。', choices: [
      { text: '救治他', result: '他将全部积蓄托付给你。', effect: { points: 500, holy: 20 } },
      { text: '搜刮他的装备', result: '你拿走了他的物资，但负罪感让队伍士气下降。', effect: { points: 800, hurtPct: 0.1 } },
      { text: '离开', result: '你装作没看见。', effect: {} } ] },
    { id: 'E03', title: '主神补给箱', desc: '一个印着主神徽记的金属箱，似乎还有电。', choices: [
      { text: '暴力破拆', result: '触发了防御电击！但拿到了补给。', effect: { points: 400, hurtPct: 0.08 } },
      { text: '破解密码', result: '密码是今天的日期。箱子弹开了。', effect: { otherworld: 40, item: 'exp_s' } },
      { text: '无视', result: '多一事不如少一事。', effect: {} } ] },
    { id: 'E04', title: '诡异的神龛', desc: '角落里供着一尊看不清脸的神像，香炉里还插着三炷香。', choices: [
      { text: '上香祭拜', result: '一股暖流涌遍全身。', effect: { healPct: 0.3 } },
      { text: '拿走供品', result: '神像的眼睛似乎动了一下……', effect: { points: 600, hurtPct: 0.15 } },
      { text: '快步离开', result: '背后的烛火熄灭了。', effect: {} } ] },
    { id: 'E05', title: '隐藏的军火库', desc: '墙上的暗门后是一间小型军火库。', choices: [
      { text: '全副武装', result: '队伍战力短暂提升！', effect: { buff: { atkPct: 0.15 }, points: 200 } },
      { text: '只拿值钱货', result: '换了不少点数。', effect: { points: 700 } },
      { text: '撤离', result: '可能是陷阱，你没有冒险。', effect: {} } ] },
    { id: 'E06', title: '迷雾中的哭声', desc: '浓雾深处传来小女孩的哭声。', choices: [
      { text: '循声查看', result: '是陷阱！一只怨灵扑向队伍。', effect: { battle: 'elite' } },
      { text: '撒盐结界绕行', result: '哭声渐渐远去。你在路边捡到了别人遗失的物资。', effect: { item: 'heal_s', points: 150 } },
      { text: '原地等待雾散', result: '浪费了时间，但安全。', effect: { healPct: 0.1 } } ] },
    { id: 'E07', title: '自动贩售机', desc: '一台老式贩售机，屏幕上闪着"点数支付"。', choices: [
      { text: '购买饮料（-100点）', result: '冰凉的饮料让全队精神一振。', effect: { points: -100, healPct: 0.2 } },
      { text: '踹开取货口', result: '机器报警了！但掉出了一堆零钱。', effect: { points: 250, hurtPct: 0.05 } },
      { text: '离开', result: '你忍住了口渴。', effect: {} } ] },
    { id: 'E08', title: '安全屋', desc: '一间加固过的安全屋，里面有床铺和净水。', choices: [
      { text: '休整一小时', result: '全队恢复了状态。', effect: { healPct: 0.4 } },
      { text: '快速搜刮后离开', result: '找到了前人藏起来的结晶。', effect: { otherworld: 25 } } ] },
    { id: 'E09', title: '神秘商人', desc: '戴着防毒面具的商人拦住你们："有好货，看看？"', choices: [
      { text: '购买技能芯片（-400点）', result: '芯片是正品。', effect: { points: -400, skillChip: 30 } },
      { text: '购买血统结晶（-600点）', result: '结晶散发着微光。', effect: { points: -600, bloodCrystal: 20 } },
      { text: '转身就走', result: '商人在背后耸了耸肩。', effect: {} } ] },
    { id: 'E10', title: '血迹斑斑的日记', desc: '地上有一本日记，最后一页写着："别相信钟声。"', choices: [
      { text: '仔细阅读', result: '你提前避开了前方的埋伏，并找到了暗格。', effect: { story: 40, points: 200 } },
      { text: '烧掉日记', result: '火焰中传来一声叹息。你感到莫名的心安。', effect: { healPct: 0.15 } },
      { text: '无视', result: '钟声在你身后响起……', effect: { hurtPct: 0.1 } } ] },
    { id: 'E11', title: '通风管道', desc: '狭窄的通风管道，可能通向捷径，也可能通向巢穴。', choices: [
      { text: '钻进去', result: '你绕过了一大群敌人，还捡到了掉落物。', effect: { points: 350, item: 'mat_t1' } },
      { text: '往里面扔燃烧瓶', result: '里面传来凄厉的嘶吼，随后安静了。', effect: { points: 500, story: 20 } },
      { text: '走大路', result: '稳妥但绕远。', effect: {} } ] },
    { id: 'E12', title: '共振水晶', desc: '一块悬浮的异界水晶，与队伍的装备产生共振。', choices: [
      { text: '吸收能量', result: '装备被强化之力浸润。', effect: { otherworld: 60 } },
      { text: '敲碎带走', result: '碎裂的水晶割伤了手。', effect: { otherworld: 90, hurtPct: 0.08 } } ] },
    { id: 'E13', title: '同类的尸体', desc: '一具轮回者的尸体，手里紧紧攥着什么。', choices: [
      { text: '掰开他的手', result: '是一颗圣洁晶石。', effect: { holy: 30 } },
      { text: '安葬他', result: '你花了点时间，但主神似乎记录了你的善举。', effect: { story: 50 } } ] },
    { id: 'E14', title: '失控的防御系统', desc: '自动炮塔突然转向你们！', choices: [
      { text: '强行突破', result: '队伍受了点伤，但拆下了值钱的零件。', effect: { hurtPct: 0.12, points: 600 } },
      { text: '黑入系统', result: '炮塔现在为你们开路。', effect: { buff: { atkPct: 0.1 } } },
      { text: '绕道', result: '多花了些时间。', effect: {} } ] },
    { id: 'E15', title: '镜中人', desc: '一面落地镜，镜中的"你们"露出了诡异的微笑。', choices: [
      { text: '打碎镜子', result: '镜片后藏着一间暗室！', effect: { holy: 15, points: 300 } },
      { text: '与镜中人对视', result: '恐惧攫住了心脏……', effect: { hurtPct: 0.1, story: 40 } },
      { text: '用布盖住', result: '安全通过。', effect: {} } ] },
    { id: 'E16', title: '陷阱走廊', desc: '地板上满是触发式陷阱的痕迹。', choices: [
      { text: '小心拆除', result: '拆下的机关能卖个好价钱。', effect: { points: 450 } },
      { text: '冲刺通过', result: '几支暗箭擦着头皮飞过！', effect: { hurtPct: 0.1, points: 200 } },
      { text: '退回去绕路', result: '浪费了时间。', effect: {} } ] },
    { id: 'E17', title: '受伤的研究员', desc: '一名幸存的研究员，他知道这个世界的秘密。', choices: [
      { text: '护送他离开', result: '他给了你一份完整的区域地图和补给。', effect: { story: 60, item: 'heal_m' } },
      { text: '逼问情报', result: '他惊恐地说出了Boss的弱点位置。', effect: { buff: { atkPct: 0.12 }, story: 20 } },
      { text: '不管他', result: '身后传来惨叫，你没有回头。', effect: {} } ] },
    { id: 'E18', title: '主神广播', desc: '广播里响起主神冰冷的声音："检测到轮回者，投放补给。"', choices: [
      { text: '前往投放点', result: '补给箱里有好东西！', effect: { holy: 25, item: 'exp_m' } },
      { text: '原地待命', result: '补给被别的队伍抢走了，但你保存了体力。', effect: { healPct: 0.1 } } ] },
    { id: 'E19', title: '地下黑市摊位', desc: '废墟中的黑市摊位，老板是个独眼老人。', choices: [
      { text: '买装备箱（-800点）', result: '箱子沉甸甸的。', effect: { points: -800, item: 'box_r' } },
      { text: '买药（-200点）', result: '货真价实的治疗剂。', effect: { points: -200, item: 'heal_l' } },
      { text: '离开', result: '老人眯起眼睛看着你们离开。', effect: {} } ] },
    { id: 'E20', title: '诅咒宝箱', desc: '一个华丽的宝箱，锁孔里渗出黑雾。', choices: [
      { text: '直接打开', result: '黑雾灼伤了你，但财宝是真的。', effect: { hurtPct: 0.15, holy: 40 } },
      { text: '先净化再开', result: '安全的拿到了财物。', effect: { points: 400, otherworld: 30 } },
      { text: '不碰它', result: '宝箱在你身后发出磨牙声。', effect: {} } ] },
  ];

  /* ================= 血统 / 基因锁 ================= */
  /* ================= 主角（玩家）独立成长 ================= */
  // 主角 = 玩家本人，不消耗点数升级（玩家等级即主角等级），无星级/碎片，6 装备槽，可选血统
  const PROTAGONIST = {
    id: '@player',
    baseAttrs: { muscle: 65, immune: 60, cell: 62, nerve: 58, intelligence: 50, spirit: 55 },
    kind: 'warrior',
    // 技能随基因锁强化（每阶技能效果提升）
    skills: {
      s1: { name: '求生突刺', desc: '对单体造成 180% 伤害', cd: 3, type: 'dmg', mult: 1.8, target: 'enemy' },
      s2: { name: '潜能爆发', desc: '自身攻击+30%、暴击+15%，持续 3 回合', cd: 5, type: 'buff', buff: { atkPct: 0.3, critPct: 0.15, turns: 3 }, target: 'self' },
      ult: { name: '基因解放', desc: '对单体造成 400% 伤害并回复伤害 30% 的生命', type: 'dmg', mult: 4.0, lifesteal: 0.3, target: 'enemy' },
      passive: { name: '轮回者直觉', desc: '闪避 +5%，基因锁每阶全属性额外 +3%' },
    },
  };

  const BLOODLINES = {
    '血族':  { desc: '吸血、暴击。每级：攻击+1.2%、吸血+0.4%', atkPct: 0.012, lifesteal: 0.004 },
    '狼人':  { desc: '生命、近战。每级：生命+1.5%、防御+0.8%', hpPct: 0.015, defPct: 0.008 },
    '修真':  { desc: '增益、剑术。每级：全属性+0.6%', allPct: 0.006 },
    '魔法':  { desc: '元素、爆发。每级：技能伤害+1.5%', skillPct: 0.015 },
    '科技':  { desc: '远程、炮台。每级：攻击+0.9%、暴击+0.5%', atkPct: 0.009, critPct: 0.005 },
    '念动力': { desc: '控制、精神。每级：速度+1%、精神+1%', spdPct: 0.01, spiritPct: 0.01 },
  };
  const BLOODLINE_MAX = 30;
  const bloodlineCost = lv => ({ bloodCrystal: 10 + lv * 5, points: 2000 * (lv + 1) });
  const GENE_LOCKS = [
    { stage: 1, name: '初醒', desc: '全队全属性+5%，挂机收益+10%', req: '通关 生化蜂巢·普通', cost: { bloodCrystal: 100 } },
    { stage: 2, name: '强化', desc: '全队技能伤害+15%', req: '玩家Lv20 + 通关 咒怨凶宅·普通', cost: { bloodCrystal: 300 } },
    { stage: 3, name: '突破', desc: '必杀技伤害+30%', req: '玩家Lv40 + 通关 星河战场·普通', cost: { bloodCrystal: 800 } },
    { stage: 4, name: '超越', desc: '血统效果+50%', req: '玩家Lv60 + 通关 侏罗纪孤岛·普通', cost: { bloodCrystal: 2000 } },
    { stage: 5, name: '完全解锁', desc: '全属性+15%，挂机上限+12小时', req: '玩家Lv80 + 通关 魔戒远征·普通', cost: { bloodCrystal: 5000 } },
  ];

  /* ================= 建筑 ================= */
  const BUILDINGS = [
    { id: 'core',     name: '主神核心',   base: 1000, desc: '每级：挂机收益 +2%' },
    { id: 'training', name: '训练室',     base: 800,  desc: '每级：挂机经验 +3%' },
    { id: 'medical',  name: '医疗室',     base: 700,  desc: '每级：离线效率 +1%、离线上限 +12分钟' },
    { id: 'workshop', name: '装备工坊',   base: 900,  desc: '每级：装备强化费用 -1%（最多-40%）' },
    { id: 'geneLab',  name: '基因实验室', base: 1200, desc: '每级：血统升级费用 -1%（最多-40%）' },
  ];
  const buildingCost = (id, lv) => {
    const b = BUILDINGS.find(x => x.id === id);
    return Math.round(b.base * Math.pow(1.12, lv - 1));
  };

  /* ================= 招募 ================= */
  const RECRUIT_POOLS = {
    normal:  { name: '普通招募', rates: { N: 0.40, R: 0.35, SR: 0.20, SSR: 0.045, UR: 0.005 }, cost: { points: 5000 } },
    advanced:{ name: '高级招募', rates: { R: 0.30, SR: 0.50, SSR: 0.17, UR: 0.03 }, cost: { holy: 100 } },
    limited: { name: '限定招募', rates: { R: 0.20, SR: 0.50, SSR: 0.25, UR: 0.05 }, cost: { holy: 100 } },
  };
  const RECRUIT_TEN_COST = { holy: 900 };
  const PITY = { SSR: 50, UR: 100 };

  /* ================= 商店 ================= */
  const SHOPS = {
    god: { name: '主神商店', currency: 'points', items: [
      { item: 'exp_s', name: '初级经验模块', price: 500, stock: -1 },
      { item: 'exp_m', name: '中级经验模块', price: 2000, stock: -1 },
      { item: 'heal_s', name: '小型治疗剂', price: 500, stock: -1 },
      { item: 'mat_t1', name: '基础金属×10', price: 300, count: 10, stock: -1 },
      { currencyGain: { skillChip: 10 }, name: '技能芯片×10', price: 2000, stock: -1 },
      { item: 'box_r', name: '随机R装备', price: 5000, stock: -1 },
      { item: 'box_sr', name: '随机SR装备', price: 30000, stock: -1 },
    ] },
    otherworld: { name: '异界商店', currency: 'otherworld', items: [
      { item: 'box_sr', name: 'SR装备箱', price: 100, stock: -1 },
      { item: 'box_ssr', name: 'SSR装备箱', price: 500, stock: -1 },
      { item: 'box_ur', name: 'UR装备箱', price: 2000, stock: -1 },
      { item: 'mat_t2', name: '强化合金×10', price: 50, count: 10, stock: -1 },
      { item: 'mat_t3', name: '异界合金×5', price: 100, count: 5, stock: -1 },
    ] },
    story: { name: '故事商店', currency: 'story', items: [
      { shardRandom: 'R', shardCount: 10, name: '随机R角色碎片×10', price: 100, stock: -1 },
      { shardRandom: 'SR', shardCount: 10, name: '随机SR角色碎片×10', price: 300, stock: -1 },
      { item: 'box_sr', name: '世界装备箱', price: 200, stock: -1 },
      { item: 'mat_t1', name: '世界材料×50', price: 50, count: 50, stock: -1 },
      { currencyGain: { skillChip: 100 }, name: '技能芯片×100', price: 200, stock: -1 },
      { currencyGain: { holy: 10 }, name: '圣洁晶石×10', price: 500, stock: 1 },
    ] },
    corridor: { name: '回廊商店', currency: 'corridor', items: [
      { shardRandom: 'SR', shardCount: 10, name: 'SR角色碎片×10', price: 100, stock: -1 },
      { shardRandom: 'SSR', shardCount: 5, name: 'SSR角色碎片×5', price: 300, stock: -1 },
      { currencyGain: { skillChip: 100 }, name: '技能芯片×100', price: 150, stock: -1 },
      { currencyGain: { bloodCrystal: 100 }, name: '血统结晶×100', price: 200, stock: -1 },
      { item: 'box_ssr', name: 'SSR装备箱', price: 500, stock: -1 },
      { item: 'box_ur', name: 'UR装备箱', price: 1500, stock: -1 },
    ] },
  };

  /* ================= 任务 / 登录 / 成就 ================= */
  const DAILY_TASKS = [
    { id: 'battle5',  name: '战斗 5 次', target: 5, reward: { points: 1000 } },
    { id: 'idle1',    name: '领取挂机收益 1 次', target: 1, reward: { points: 800 } },
    { id: 'enhance1', name: '强化装备 1 次', target: 1, reward: { otherworld: 30 } },
    { id: 'recruit1', name: '招募 1 次', target: 1, reward: { holy: 20 } },
    { id: 'dungeon1', name: '完成 1 次副本', target: 1, reward: { story: 100 } },
    { id: 'item1',    name: '使用 1 个道具', target: 1, reward: { points: 500 } },
  ];
  const DAILY_ALL_REWARD = { points: 5000, skillChip: 50, holy: 20 };
  const LOGIN_REWARDS = [
    { holy: 100 }, { points: 10000 }, { skillChip: 100 }, { otherworld: 200 },
    { holy: 200 }, { item: 'box_ssr' }, { ssrTicket: true },
  ];
  const STARTER = {
    points: 50000, holy: 1000,
    items: { exp_s: 20, heal_s: 10 },
    chars: ['C001'],   // 开局只有主角
  };

  /* ================= 功能解锁（随关卡进度） ================= */
  const UNLOCKS = [
    { id: 'recruit',   name: '轮回者招募', world: 'W01', stage: 1,  tip: '通关 生化蜂巢·第1关 解锁' },
    { id: 'shop',      name: '兑换大厅',   world: 'W01', stage: 2,  tip: '通关 生化蜂巢·第2关 解锁' },
    { id: 'enhance',   name: '装备强化',   world: 'W01', stage: 3,  tip: '通关 生化蜂巢·第3关 解锁' },
    { id: 'buildings', name: '基地建设',   world: 'W01', stage: 4,  tip: '通关 生化蜂巢·第4关 解锁' },
    { id: 'tasks',     name: '每日任务',   world: 'W01', stage: 4,  tip: '通关 生化蜂巢·第4关 解锁' },
    { id: 'geneLock',  name: '基因锁',     world: 'W01', stage: 12, tip: '通关 生化蜂巢·第12关 解锁' },
    { id: 'corridor',  name: '无限回廊',   world: 'W01', stage: 12, tip: '通关 生化蜂巢·第12关 解锁' },
    { id: 'bloodline', name: '血统强化',   world: 'W02', stage: 1,  tip: '通关 异形巢穴·第1关 解锁' },
    { id: 'reincarn',  name: '转生',       world: 'W03', stage: 12, tip: '通关 咒怨凶宅·第12关 解锁' },
  ];

  /* ================= 主线任务 ================= */
  // check: (S, helpers) => bool；reward 自动结算，点击领取
  const MAIN_QUESTS = [
    { id: 'q01', name: '熟悉身体', desc: '使用经验道具，将主角升到 Lv.5', reward: { points: 1000 },
      check: S => Object.values(S.chars).some(c => c.lv >= 5) },
    { id: 'q02', name: '初临蜂巢', desc: '通关 生化蜂巢·第1关', reward: { holy: 100 }, unlock: 'recruit',
      check: S => S.worlds.W01 && S.worlds.W01.stages.normal[0] > 0 },
    { id: 'q03', name: '第一位同伴', desc: '进行 1 次招募', reward: { points: 2000 },
      check: S => S.stats.recruits >= 1 },
    { id: 'q04', name: '并肩作战', desc: '在队伍中上阵 1 名招募角色', reward: { story: 50 },
      check: S => S.party.filter(Boolean).length >= 1 },
    { id: 'q05', name: '深入蜂巢', desc: '通关 生化蜂巢·第2关', reward: { points: 2000 }, unlock: 'shop',
      check: S => S.worlds.W01 && S.worlds.W01.stages.normal[1] > 0 },
    { id: 'q06', name: '工欲善其事', desc: '通关 生化蜂巢·第3关', reward: { otherworld: 50 }, unlock: 'enhance',
      check: S => S.worlds.W01 && S.worlds.W01.stages.normal[2] > 0 },
    { id: 'q07', name: '第一次强化', desc: '强化 1 次装备', reward: { points: 3000 },
      check: S => S.stats.enhances >= 1 },
    { id: 'q08', name: '安身立命', desc: '通关 生化蜂巢·第4关', reward: { points: 3000 }, unlock: 'buildings,tasks',
      check: S => S.worlds.W01 && S.worlds.W01.stages.normal[3] > 0 },
    { id: 'q09', name: '大兴土木', desc: '升级 1 次建筑', reward: { points: 2000 },
      check: S => Object.values(S.buildings).some(lv => lv >= 2) },
    { id: 'q10', name: '蜂巢之主', desc: '击杀 蜂巢母体（第12关）', reward: { holy: 200, bloodCrystal: 100 }, unlock: 'geneLock,corridor',
      check: S => S.worlds.W01 && S.worlds.W01.stages.normal[11] > 0 },
    { id: 'q11', name: '回廊的呼唤', desc: '挑战 1 次无限回廊', reward: { story: 100 },
      check: S => S.corridor.floor >= 2 },
    { id: 'q12', name: '新的恐怖', desc: '通关 异形巢穴·第1关', reward: { bloodCrystal: 50 }, unlock: 'bloodline',
      check: S => S.worlds.W02 && S.worlds.W02.stages.normal[0] > 0 },
    { id: 'q13', name: '血脉觉醒', desc: '升级 1 次血统', reward: { points: 5000 },
      check: S => Object.values(S.chars).some(c => c.bloodlineLv >= 1) },
    { id: 'q14', name: '巢穴女王', desc: '通关 异形巢穴·第12关', reward: { holy: 300, otherworld: 200 },
      check: S => S.worlds.W02 && S.worlds.W02.stages.normal[11] > 0 },
    { id: 'q15', name: '轮回者之路', desc: '通关 咒怨凶宅·第12关', reward: { holy: 500, rp: 0 }, unlock: 'reincarn',
      check: S => S.worlds.W03 && S.worlds.W03.stages.normal[11] > 0 },
  ];

  // 新手掉落保护：按关卡限制掉落品质上限
  function stageDropCap(stage) {
    if (stage <= 3) return 'R';
    if (stage <= 6) return 'SR';
    return null;
  }

  /* ================= 转生天赋 ================= */
  const TALENTS = {
    body:  { name: '永恒之躯', desc: '生命/防御/恢复', nodes: ['生命+5%', '防御+5%', '受治疗+8%', '生命+8%', '减伤+3%', '生命+12%', '防御+8%', '减伤+5%', '生命+20%', '不朽：重伤恢复+50%'] },
    energy:{ name: '无限能源', desc: '技能/精神/能量', nodes: ['精神+5%', '技能伤害+5%', '初始能量+10', '精神+8%', '技能伤害+8%', '技能CD-1(必杀除外)', '精神+12%', '技能伤害+12%', '初始能量+25', '超载：必杀伤害+25%'] },
    nerve: { name: '超维神经', desc: '速度/暴击/闪避', nodes: ['速度+5%', '暴击率+3%', '闪避+2%', '速度+8%', '暴击伤害+10%', '速度+12%', '暴击率+5%', '闪避+4%', '速度+20%', '先制：首回合速度+50%'] },
    grace: { name: '主神恩赐', desc: '挂机/掉落/经验', nodes: ['挂机+5%', '经验+5%', '掉落+5%', '挂机+8%', '经验+8%', '挂机+12%', '掉落+8%', '经验+12%', '挂机+20%', '神眷：离线效率+15%'] },
  };
  const TALENT_COSTS = [10, 20, 40, 80, 150, 300, 600, 1000, 1500, 2500];

  /* ================= 无限回廊 ================= */
  function corridorEnemy(floor) {
    let hpM, atkM, defM;
    if (floor <= 100) { hpM = Math.pow(1.045, floor - 1); atkM = Math.pow(1.035, floor - 1); defM = Math.pow(1.030, floor - 1); }
    else if (floor <= 300) { hpM = Math.pow(1.035, floor - 1); atkM = Math.pow(1.030, floor - 1); defM = Math.pow(1.025, floor - 1); }
    else { hpM = Math.pow(1.025, floor - 1); atkM = Math.pow(1.022, floor - 1); defM = Math.pow(1.020, floor - 1); }
    const isBoss = floor % 50 === 0, isElite = floor % 10 === 0;
    const mult = isBoss ? 2.4 : isElite ? 1.7 : 1;
    return {
      name: isBoss ? `回廊守望者·${floor}层` : isElite ? `回廊精英·${floor}层` : `回廊之影·${floor}层`,
      hp: Math.round(2500 * hpM * mult), atk: Math.round(320 * atkM * (isBoss ? 1.4 : 1)), def: Math.round(200 * defM * (isBoss ? 1.3 : 1)),
      isBoss, isElite,
    };
  }
  const corridorReward = floor => ({
    points: Math.round(100 * Math.pow(1.04, Math.floor(floor / 10))),
    story: 5,
    corridor: floor % 10 === 0 ? 3 : 1,
    bloodCrystal: floor % 50 === 0 ? 50 : 0,
  });

  /* ================= 掉落稀有度 ================= */
  const DROP_RARITY = {
    normal: [['N', 0.45], ['R', 0.35], ['SR', 0.16], ['SSR', 0.035], ['UR', 0.005]],
    hard:   [['N', 0.20], ['R', 0.35], ['SR', 0.30], ['SSR', 0.12], ['UR', 0.03]],
    hell:   [['N', 0.05], ['R', 0.20], ['SR', 0.35], ['SSR', 0.30], ['UR', 0.10]],
  };
  function rollRarity(diff, minRarity) {
    const table = DROP_RARITY[diff] || DROP_RARITY.normal;
    let r = Math.random(), acc = 0, result = 'N';
    for (const [rar, p] of table) { acc += p; if (r <= acc) { result = rar; break; } }
    if (minRarity && RARITIES.indexOf(result) < RARITIES.indexOf(minRarity)) result = minRarity;
    return result;
  }
  function capRarity(rar, cap) {
    if (!cap) return rar;
    return RARITIES.indexOf(rar) > RARITIES.indexOf(cap) ? cap : rar;
  }

  return {
    ATTR_NAMES, RARITIES, RARITY_COLOR, STAR_MULT, RARITY_MAXSTAR, STAR_COST, DUP_SHARDS,
    FACTIONS, FACTION_COUNTER, EXP_TABLE, LEVEL_POINTS, CURRENCIES,
    ROLE_KIND, ATK_ATTR, characters, charById,
    WORLDS, DIFFICULTY, FIRST_CLEAR,
    EQUIP_SLOTS, EQUIP_RARITY_MULT, DECOMPOSE_GAIN, ENHANCE_RATE, SETS, AFFIX_POOL, makeEquip,
    RECRUIT_SLOTS, PLAYER_SLOTS, DROP_SLOTS, PROTAGONIST,
    ITEMS, EVENTS,
    BLOODLINES, BLOODLINE_MAX, bloodlineCost, GENE_LOCKS,
    BUILDINGS, buildingCost,
    RECRUIT_POOLS, RECRUIT_TEN_COST, PITY,
    SHOPS, DAILY_TASKS, DAILY_ALL_REWARD, LOGIN_REWARDS, STARTER,
    TALENTS, TALENT_COSTS,
    corridorEnemy, corridorReward,
    DROP_RARITY, rollRarity, capRarity,
    UNLOCKS, MAIN_QUESTS, stageDropCap,
    _ri: ri,
  };
})();
