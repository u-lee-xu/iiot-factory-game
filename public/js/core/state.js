// ═══════════════════════════════════════════════════════════════════
// core/state.js — state 模块（拆自 app.js）
// import core/*；其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { taskKey, taskXP } from '../core/utils.js';

export function getLevelTasks(levelId) {
  const lv = window.content.levels.find(l => l.id === levelId);
  return lv ? lv.tasks : [];
}

export function isTaskDone(taskId) {
  return !!window.gameState.check[taskKey(taskId)];
}

export function calcTotalXP() {
  if (!window.content) return 0;
  let xp = 0;
  window.content.levels.forEach(lv => {
    lv.tasks.forEach(t => {
      const c = window.gameState.check[taskKey(t.id)];
      if (c) xp += (c && c.half) ? Math.floor(taskXP(t) / 2) : taskXP(t);
    });
  });
  return xp;
}

export function getRank(xp) {
  let r = window.RANKS[0];
  for (let i = window.RANKS.length - 1; i >= 0; i--) {
    if (xp >= window.RANKS[i].min) { r = window.RANKS[i]; break; }
  }
  return r;
}

export function levelProgress(lvId) {
  const tasks = getLevelTasks(lvId);
  let done = 0, total = 0;
  tasks.forEach(t => {
    if (t.auto) return;
    total++;
    if (isTaskDone(t.id)) done++;
  });
  return { done, total, pct: total ? Math.round(done / total * 100) : 0, completed: done >= total && total > 0 };
}

export function areaStars(lvId) {
  const s = window.gameState.stars[lvId];
  if (!s) return 0;
  return Math.round((s.self * 0.3 + s.peer * 0.3 + s.teacher * 0.4) * 10) / 10;
}
