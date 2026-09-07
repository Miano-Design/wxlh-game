window.GAME_CONFIG = {
  startPoints: 1000,
  startHolyCrystal: 10, // 初始圣晶
  idleBasePerSecond: 5, // 基础挂机点数/秒
  recruitCosts: { singleCost: 1, tenCost: 9 },
  characters: [
    { id: 'C001', name: '林默', rarity: 'N', role: '战士', level:1, exp:0, muscle:68, immune:58, cell:62, nerve:52, intelligence:45, spirit:40 },
    { id: 'C007', name: '顾川', rarity: 'R', role: '狂战', level:1, exp:0, muscle:82, immune:60, cell:72, nerve:60, intelligence:40, spirit:35 }
  ],
  // 背包/装备配置
  inventoryCapacity: 40,
  startingItems: [ 'WPN_001' ]
};