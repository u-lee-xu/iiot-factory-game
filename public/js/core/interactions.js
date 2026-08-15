// ═══════════════════════════════════════════════════════════════════
// core/interactions.js — 任务类型注册表 & 迷你游戏注册表
// 从 app.js 抽出；interactions/*.js 与 app.js 都从这里 import（避免循环依赖）
// ═══════════════════════════════════════════════════════════════════
export const interactions = {};
export function registerInteraction(type, handler) { interactions[type] = handler; }
export function getInteraction(type) { return interactions[type] || interactions['default']; }

export const miniGames = {};
export function registerMiniGame(type, handler) { miniGames[type] = handler; }
