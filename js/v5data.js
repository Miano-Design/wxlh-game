// V5 数据片段：经验、装备模板、事件与副本示例
window.V5 = (function(){
  // 1..99 的升级所需 EXP（来源：V5.0 表格，索引从1开始，100为顶级）
  const expTable = [
    0,
    100,293,549,857,1212,1607,2041,2511,3014,3548,
    4113,4707,5329,5977,6652,7352,8076,8824,9596,10390,
    11206,12044,12903,13782,14683,15603,16543,17502,18481,19478,
    20493,21527,22579,23648,24735,25839,26960,28097,29252,30422,
    31609,32812,34031,35266,36516,37781,39062,40357,41668,42994,
    44334,45688,47057,48441,49838,51250,52675,54114,55567,57034,
    58514,60008,61515,63035,64568,66114,67673,69245,70830,72427,
    74037,75660,77295,78942,80602,82274,83958,85654,87362,89082,
    90814,92557,94313,96080,97859,99649,101451,103264,105088,106924,
    108771,110630,112499,114379,116271,118174,120087,122011,123947
  ];

  const equipments = [
    { id:'WPN_001', name:'生化短刃', rarity:'R', slot:'weapon', atk:12, crit:2 },
    { id:'ARM_001', name:'防护背心', rarity:'R', slot:'armor', hp:100 },
    { id:'WPN_002', name:'旧时代左轮', rarity:'N', slot:'weapon', atk:6, crit:1 },
    { id:'WPN_003', name:'高能狙击', rarity:'SR', slot:'weapon', atk:28, crit:6 },
    { id:'WPN_004', name:'量子匕首', rarity:'SSR', slot:'weapon', atk:40, crit:10 },
    { id:'ARM_002', name:'轻型护甲', rarity:'N', slot:'armor', hp:30 },
    { id:'ARM_003', name:'强化胸甲', rarity:'SR', slot:'armor', hp:220 },
    { id:'ACC_001', name:'古老徽记', rarity:'R', slot:'accessory', hp:50, atk:3 },
    { id:'ACC_002', name:'精神结晶', rarity:'SR', slot:'accessory', spirit:10 }
  ];

  const equipmentDrops = {
    normal: { N:0.45, R:0.35, SR:0.16, SSR:0.035, UR:0.005 },
    hard:   { N:0.20, R:0.35, SR:0.30, SSR:0.12, UR:0.03 },
    hell:   { N:0.05, R:0.20, SR:0.35, SSR:0.30, UR:0.10 }
  };

  const events = [
    { id:'E01', title:'发现废弃实验室', desc:'你发现一间废弃实验室，地上有箱子。', choices:[
      { id:'c1', text:'搜索箱子', result:'获得材料', gain:{points:200, item:'WPN_001'} },
      { id:'c2', text:'离开', result:'安全离开', gain:{} },
      { id:'c3', text:'深入调查', result:'触发遭遇', gain:{points:-50} }
    ]},
    { id:'E02', title:'遇到流浪者', desc:'一个流浪者求助', choices:[
      { id:'c1', text:'帮助他', result:'获得碎片', gain:{points:50} },
      { id:'c2', text:'忽略', result:'失去信任', gain:{} }
    ]}
  ];

  const dungeons = [
    { id:'D01', name:'生化世界', nodes: 6, difficulty:1, eventPool:['E01','E02'] }
  ];

  // 部分角色数据导入（示例，来自 V5.0 文档）；其余为占位，可按需替换为正式数据
  const characters = [
    { id: 'C001', name: '林默', faction: '先锋', bloodline: '科技', role: '战士', rarity: 'N', muscle:68, immune:58, cell:62, nerve:52, intelligence:45, spirit:40 },
    { id: 'C002', name: '周野', faction: '先锋', bloodline: '狼人', role: '坦克', rarity: 'N', muscle:72, immune:65, cell:70, nerve:45, intelligence:38, spirit:35 },
    { id: 'C003', name: '唐宁', faction: '策略', bloodline: '魔法', role: '法师', rarity: 'N', muscle:38, immune:42, cell:45, nerve:55, intelligence:75, spirit:70 },
    { id: 'C004', name: '叶青', faction: '支援', bloodline: '修真', role: '治疗', rarity: 'N', muscle:42, immune:50, cell:65, nerve:52, intelligence:58, spirit:72 },
    { id: 'C005', name: '韩森', faction: '科技', bloodline: '科技', role: '射手', rarity: 'N', muscle:58, immune:48, cell:50, nerve:70, intelligence:62, spirit:40 },
    { id: 'C006', name: '苏琪', faction: '异能', bloodline: '念动力', role: '控制', rarity: 'N', muscle:35, immune:40, cell:48, nerve:65, intelligence:70, spirit:78 },

    { id: 'C007', name: '顾川', faction: '先锋', bloodline: '狼人', role: '狂战', rarity: 'R', muscle:82, immune:60, cell:72, nerve:60, intelligence:40, spirit:35 },
    { id: 'C008', name: '沈岳', faction: '先锋', bloodline: '科技', role: '重装', rarity: 'R', muscle:78, immune:80, cell:75, nerve:38, intelligence:35, spirit:30 },
    { id: 'C009', name: '白屿', faction: '策略', bloodline: '修真', role: '剑士', rarity: 'R', muscle:70, immune:55, cell:60, nerve:72, intelligence:58, spirit:55 },
    { id: 'C010', name: '苏黎', faction: '策略', bloodline: '魔法', role: '法师', rarity: 'R', muscle:35, immune:45, cell:48, nerve:62, intelligence:82, spirit:78 },
    { id: 'C011', name: '江寒', faction: '异能', bloodline: '念动力', role: '控制', rarity: 'R', muscle:40, immune:45, cell:55, nerve:75, intelligence:70, spirit:85 },
    { id: 'C012', name: '陆沉', faction: '科技', bloodline: '科技', role: '射手', rarity: 'R', muscle:65, immune:52, cell:58, nerve:80, intelligence:68, spirit:40 },
    { id: 'C013', name: '宁雪', faction: '支援', bloodline: '血族', role: '吸血', rarity: 'R', muscle:60, immune:48, cell:70, nerve:68, intelligence:55, spirit:60 },
    { id: 'C014', name: '韩墨', faction: '先锋', bloodline: '狼人', role: '坦克', rarity: 'R', muscle:85, immune:72, cell:80, nerve:42, intelligence:38, spirit:32 },
    { id: 'C015', name: '林晚', faction: '支援', bloodline: '魔法', role: '治疗', rarity: 'R', muscle:38, immune:50, cell:72, nerve:58, intelligence:70, spirit:88 },
    { id: 'C016', name: '赵恒', faction: '科技', bloodline: '科技', role: '辅助', rarity: 'R', muscle:50, immune:65, cell:62, nerve:55, intelligence:75, spirit:58 },
    { id: 'C017', name: '陈锋', faction: '先锋', bloodline: '科技', role: '战士', rarity: 'R', muscle:75, immune:60, cell:65, nerve:62, intelligence:48, spirit:38 },
    { id: 'C018', name: '苏曼', faction: '异能', bloodline: '念动力', role: '控制', rarity: 'R', muscle:38, immune:45, cell:52, nerve:70, intelligence:75, spirit:82 },
    { id: 'C019', name: '方哲', faction: '策略', bloodline: '修真', role: '法剑', rarity: 'R', muscle:62, immune:52, cell:55, nerve:65, intelligence:72, spirit:68 },
    { id: 'C020', name: '唐岳', faction: '先锋', bloodline: '血族', role: '战士', rarity: 'R', muscle:78, immune:58, cell:70, nerve:68, intelligence:45, spirit:55 },

    { id: 'C021', name: '叶沉舟', faction: '先锋', bloodline: '狼人', role: '狂战', rarity: 'SR', muscle:0, immune:0, cell:0, nerve:0, intelligence:0, spirit:0 },
    { id: 'C022', name: '洛辰', faction: '先锋', bloodline: '修真', role: '剑修', rarity: 'SR', muscle:0, immune:0, cell:0, nerve:0, intelligence:0, spirit:0 },
    { id: 'C023', name: '沈昭', faction: '策略', bloodline: '魔法', role: '爆发法师', rarity: 'SR', muscle:0, immune:0, cell:0, nerve:0, intelligence:0, spirit:0 },
    { id: 'C024', name: '林霜', faction: '支援', bloodline: '血族', role: '吸血辅助', rarity: 'SR', muscle:0, immune:0, cell:0, nerve:0, intelligence:0, spirit:0 },
    { id: 'C025', name: '顾言', faction: '科技', bloodline: '科技', role: '狙击', rarity: 'SR', muscle:0, immune:0, cell:0, nerve:0, intelligence:0, spirit:0 },
    { id: 'C026', name: '白璃', faction: '异能', bloodline: '念动力', role: '控制', rarity: 'SR', muscle:0, immune:0, cell:0, nerve:0, intelligence:0, spirit:0 },
    { id: 'C027', name: '周启', faction: '先锋', bloodline: '科技', role: '重装', rarity: 'SR', muscle:0, immune:0, cell:0, nerve:0, intelligence:0, spirit:0 },
    { id: 'C028', name: '宁川', faction: '策略', bloodline: '修真', role: '法阵', rarity: 'SR', muscle:0, immune:0, cell:0, nerve:0, intelligence:0, spirit:0 },
    { id: 'C029', name: '苏瑾', faction: '支援', bloodline: '魔法', role: '群体治疗', rarity: 'SR', muscle:0, immune:0, cell:0, nerve:0, intelligence:0, spirit:0 },
    { id: 'C030', name: '唐若', faction: '异能', bloodline: '念动力', role: '精神爆发', rarity: 'SR', muscle:0, immune:0, cell:0, nerve:0, intelligence:0, spirit:0 },
    { id: 'C031', name: '霍青', faction: '先锋', bloodline: '狼人', role: '反击坦克', rarity: 'SR', muscle:0, immune:0, cell:0, nerve:0, intelligence:0, spirit:0 },
    { id: 'C032', name: '江黎', faction: '科技', bloodline: '科技', role: '无人机', rarity: 'SR', muscle:0, immune:0, cell:0, nerve:0, intelligence:0, spirit:0 },
    { id: 'C033', name: '司空夜', faction: '异能', bloodline: '血族', role: '刺客', rarity: 'SR', muscle:0, immune:0, cell:0, nerve:0, intelligence:0, spirit:0 },
    { id: 'C034', name: '云深', faction: '策略', bloodline: '修真', role: '增益', rarity: 'SR', muscle:0, immune:0, cell:0, nerve:0, intelligence:0, spirit:0 },
    // 占位角色（C035-C060），后续可替换为具体条目
    { id: 'C035', name: '角色35', faction: '未知', bloodline: '未知', role: '战士', rarity: 'SR', muscle:75, immune:60, cell:70, nerve:60, intelligence:50, spirit:45 },
    { id: 'C036', name: '角色36', faction: '未知', bloodline: '未知', role: '法师', rarity: 'SR', muscle:40, immune:45, cell:50, nerve:60, intelligence:88, spirit:70 },
    { id: 'C037', name: '角色37', faction: '未知', bloodline: '未知', role: '治疗', rarity: 'R', muscle:38, immune:52, cell:80, nerve:50, intelligence:65, spirit:85 },
    { id: 'C038', name: '角色38', faction: '未知', bloodline: '未知', role: '坦克', rarity: 'R', muscle:90, immune:80, cell:100, nerve:40, intelligence:30, spirit:30 },
    { id: 'C039', name: '角色39', faction: '未知', bloodline: '未知', role: '射手', rarity: 'R', muscle:65, immune:50, cell:55, nerve:85, intelligence:70, spirit:45 },
    { id: 'C040', name: '角色40', faction: '未知', bloodline: '未知', role: '控制', rarity: 'SR', muscle:45, immune:50, cell:60, nerve:70, intelligence:80, spirit:78 },
    { id: 'C041', name: '角色41', faction: '未知', bloodline: '未知', role: '输出', rarity: 'SSR', muscle:110, immune:70, cell:90, nerve:95, intelligence:60, spirit:50 },
    { id: 'C042', name: '角色42', faction: '未知', bloodline: '未知', role: '辅助', rarity: 'SR', muscle:48, immune:60, cell:70, nerve:60, intelligence:72, spirit:80 },
    { id: 'C043', name: '角色43', faction: '未知', bloodline: '未知', role: '刺客', rarity: 'SR', muscle:95, immune:55, cell:60, nerve:110, intelligence:60, spirit:45 },
    { id: 'C044', name: '角色44', faction: '未知', bloodline: '未知', role: '术士', rarity: 'SR', muscle:50, immune:48, cell:60, nerve:65, intelligence:90, spirit:88 },
    { id: 'C045', name: '角色45', faction: '未知', bloodline: '未知', role: '反击', rarity: 'SR', muscle:88, immune:78, cell:80, nerve:60, intelligence:55, spirit:50 },
    { id: 'C046', name: '角色46', faction: '未知', bloodline: '未知', role: '技师', rarity: 'R', muscle:60, immune:55, cell:60, nerve:70, intelligence:80, spirit:50 },
    { id: 'C047', name: '角色47', faction: '未知', bloodline: '未知', role: '先锋', rarity: 'R', muscle:72, immune:62, cell:70, nerve:60, intelligence:48, spirit:40 },
    { id: 'C048', name: '角色48', faction: '未知', bloodline: '未知', role: '法剑', rarity: 'SR', muscle:68, immune:60, cell:65, nerve:75, intelligence:78, spirit:72 },
    { id: 'C049', name: '角色49', faction: '未知', bloodline: '未知', role: '召唤', rarity: 'SR', muscle:45, immune:55, cell:60, nerve:60, intelligence:85, spirit:80 },
    { id: 'C050', name: '角色50', faction: '未知', bloodline: '未知', role: '治疗', rarity: 'SSR', muscle:40, immune:70, cell:120, nerve:50, intelligence:95, spirit:110 },
    { id: 'C051', name: '角色51', faction: '未知', bloodline: '未知', role: '援护', rarity: 'R', muscle:55, immune:60, cell:65, nerve:60, intelligence:62, spirit:70 },
    { id: 'C052', name: '角色52', faction: '未知', bloodline: '未知', role: '狙击', rarity: 'SSR', muscle:72, immune:60, cell:60, nerve:100, intelligence:85, spirit:50 },
    { id: 'C053', name: '角色53', faction: '未知', bloodline: '未知', role: '破甲', rarity: 'SR', muscle:90, immune:65, cell:80, nerve:70, intelligence:60, spirit:45 },
    { id: 'C054', name: '角色54', faction: '未知', bloodline: '未知', role: '元素', rarity: 'SR', muscle:50, immune:50, cell:60, nerve:70, intelligence:88, spirit:85 },
    { id: 'C055', name: '角色55', faction: '未知', bloodline: '未知', role: '坦射', rarity: 'R', muscle:68, immune:58, cell:70, nerve:78, intelligence:60, spirit:45 },
    { id: 'C056', name: '角色56', faction: '未知', bloodline: '未知', role: '守护', rarity: 'R', muscle:82, immune:80, cell:90, nerve:45, intelligence:40, spirit:38 },
    { id: 'C057', name: '角色57', faction: '未知', bloodline: '未知', role: '狂暴', rarity: 'SR', muscle:100, immune:70, cell:85, nerve:80, intelligence:50, spirit:45 },
    { id: 'C058', name: '角色58', faction: '未知', bloodline: '未知', role: '幻术', rarity: 'SR', muscle:42, immune:48, cell:58, nerve:68, intelligence:92, spirit:88 },
    { id: 'C059', name: '角色59', faction: '未知', bloodline: '未知', role: '先锋', rarity: 'R', muscle:74, immune:66, cell:72, nerve:60, intelligence:50, spirit:48 },
    { id: 'C060', name: '角色60', faction: '未知', bloodline: '未知', role: '终极', rarity: 'UR', muscle:140, immune:110, cell:150, nerve:120, intelligence:100, spirit:100 }
  ];

  const recruitRates = {
    single: { N:0.60, R:0.30, SR:0.08, SSR:0.015, UR:0.005 },
    ten:    { N:0.50, R:0.32, SR:0.14, SSR:0.035, UR:0.005 }
  };

  return { expTable, equipments, equipmentDrops, events, dungeons, characters, recruitRates };
})();