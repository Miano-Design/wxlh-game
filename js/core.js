window.GameCore = (function(){
  const KEY='wxlh_save_v1';
  let state = {
    points: 0,
    party: [],
    inBattle: false
  };

  function init(){
    state.points = window.GAME_CONFIG.startPoints || 0;
    state.party = window.GAME_CONFIG.characters.slice(0,1);
    save();
  }

  function getState(){ return state }

  function save(){ localStorage.setItem(KEY, JSON.stringify(state)) }
  function load(){ const s=localStorage.getItem(KEY); if(s){ state=JSON.parse(s); return true } return false }

  function startBattle(){ if(state.inBattle) return false; state.inBattle=true; save(); return true }
  function endBattle(){ state.inBattle=false; save() }

  function battleRound(){
    // 极简示意战斗：随机伤害与胜负判定
    const dmg = Math.floor(Math.random()*200 + 50);
    const win = Math.random() < 0.6; // 60% 胜率示意
    const log = win ? `队伍造成 ${dmg} 伤害，胜利，获得点数 ${Math.floor(dmg/2)}` : `队伍受到 ${dmg} 伤害，失败，损失点数 ${Math.floor(dmg/3)}`;
    if(win) state.points += Math.floor(dmg/2); else state.points = Math.max(0, state.points - Math.floor(dmg/3));
    save();
    return {log, state: JSON.parse(JSON.stringify(state)), win}
  }

  return { init, getState, save, load, startBattle, endBattle, battleRound }
})();