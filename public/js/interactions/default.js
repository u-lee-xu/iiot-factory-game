// ═══════════════════════════════════════════════════════════════════
// interactions/default.js — 任务类型「default」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { taskXP } from '../core/utils.js';

registerInteraction('default', {
  render(container, task) {
    container.innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--dim)">
        <div style="font-size:32px;margin-bottom:12px">📋</div>
        <div style="font-size: 15px;margin-bottom:8px">${task.title}</div>
        <div style="font-size: 14px">在教材中完成此任务后，点击下方按钮确认</div>
      </div>
    `;
    document.getElementById('modalFoot').innerHTML = `
      <button class="btn" onclick="window.closeModal()">取消</button>
      <button class="btn btn-success" onclick="window.completeTask('${task.id}', ${taskXP(task)})">✓ 确认完成</button>
    `;
  }
});

// =========================================================================
// 9. HEADER
// =========================================================================
