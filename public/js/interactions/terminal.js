// ═══════════════════════════════════════════════════════════════════
// interactions/terminal.js — 任务类型「terminal」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';

registerInteraction('terminal', {
  render(container, task) {
    const cfg = task.config;
    window.renderTypeTerminal(container, task, cfg);
  }
});

