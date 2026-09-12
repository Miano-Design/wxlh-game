/* 《无限轮回》入口：启动、主循环 */
(function () {
  const Core = window.Core, UI = window.UI;

  function boot() {
    const hasSave = Core.load();
    if (!hasSave) {
      Core.newGame();
      UI.init();
      UI.showTutorial();
    } else {
      Core.ensureDaily();
      UI.init();
      if (!Core.S.player.name) UI.showCharCreate();
      // 离线收益结算
      const gains = Core.settleOffline();
      if (gains && (gains.cheat || gains.seconds >= 300)) UI.showOfflineGains(gains);
      // 每日登录奖励
      setTimeout(() => {
        const lr = Core.loginReward();
        if (lr) UI.showLoginReward(lr);
        UI.refresh();
      }, 600);
    }
    startLoop();
  }

  let lastTick = Date.now();
  let saveCounter = 0;
  function startLoop() {
    setInterval(() => {
      const now = Date.now();
      const dt = Math.min(10, (now - lastTick) / 1000); // 单帧最多计10秒，防卡顿跳变
      lastTick = now;
      Core.onlineTick(dt);
      saveCounter += dt;
      if (saveCounter >= 15) {
        saveCounter = 0;
        Core.save();
        UI.refresh();
      }
      // 主界面挂机区实时刷新（不重渲染整页）
      UI.tickIdle();
    }, 1000);
    // 页面隐藏时立即保存
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { Core.save(); return; }
      // 回到前台：把切后台期间被浏览器节流掉的时间补进挂机池（按离线规则封顶）
      const now = Date.now();
      const gap = (now - lastTick) / 1000;
      lastTick = now;
      if (gap > 10) {
        const cap = Core.offlineCapHours() * 3600;
        Core.onlineTick(Math.min(gap, cap) * Core.offlineEfficiency());
      }
    });
    window.addEventListener('beforeunload', () => Core.save());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
