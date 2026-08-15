// ═══════════════════════════════════════════════════════════════════
// interactions/progress_bar.js — 任务类型「progress_bar」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { taskXP } from '../core/utils.js';
import { playSound } from '../core/sound.js';

registerInteraction('progress_bar', {
  render(container, task) {
    const cfg = task.config;
    let step = 0;
    // 兼容两种结构：steps 数组，或 steps 数字 + labels 数组
    const steps = Array.isArray(cfg.steps) ? cfg.steps : (cfg.labels || []);
    container.innerHTML = `
      <div class="progress-steps" id="progSteps">
        ${steps.map((s, i) => `<div class="prog-step" data-idx="${i}"><span class="step-num">${i + 1}</span>${s}</div>`).join('')}
      </div>
      <div class="prog-bar-bg"><div class="prog-bar-fill" id="progBarFill"></div></div>
      <div style="text-align:center;font-size: 14px;color:var(--dim)" id="progStatus">点击开始</div>
    `;
    document.getElementById('modalFoot').innerHTML = `
      <button class="btn" onclick="window.closeModal()">取消</button>
      <button class="btn btn-primary" id="progBtn">▶ 开始安装</button>
    `;

    const barFill = document.getElementById('progBarFill');
    const status = document.getElementById('progStatus');

    document.getElementById('progBtn').onclick = () => {
      const btn = document.getElementById('progBtn');
      btn.disabled = true;
      btn.textContent = '安装中…';
      doStep();
    };

    function doStep() {
      if (step >= steps.length) {
        playSound('success');
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="window.completeTask('${task.id}', ${taskXP(task)})">✓ 完成</button>`;
        document.getElementById('progStatus').textContent = '✅ 安装完成！';
        return;
      }
      if (step === 0) playSound('click');
      const all = document.querySelectorAll('.prog-step');
      all.forEach((el, i) => {
        el.classList.toggle('done', i < step);
        el.classList.toggle('active', i === step);
      });
      barFill.style.width = (step / steps.length * 100) + '%';
      document.getElementById('progStatus').textContent = steps[step] + '…';
      setTimeout(() => { step++; doStep(); }, 800);
    }
  }
});

// =========================================================================

// 8d2. INTERACTION: INSTALL_WIZARD (interactive setup wizard)
// =========================================================================
