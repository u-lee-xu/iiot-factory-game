// ═══════════════════════════════════════════════════════════════════
// interactions/diagnosis_tree.js — 任务类型「diagnosis_tree」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { taskXP } from '../core/utils.js';
import { playSound } from '../core/sound.js';
import { showWrongExplain } from '../core/fx.js';

registerInteraction('diagnosis_tree', {
  render(container, task) {
    const cfg = task.config;
    let stepIdx = 0;
    const steps = cfg.steps || [];

    function renderStep() {
      if (stepIdx >= steps.length) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--green)">✅ 故障排除成功！</div>';
        playSound('success');
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="window.completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
        return;
      }
      const s = steps[stepIdx];
      container.innerHTML = `
        <div style="margin-bottom:6px;font-size: 14px;color:var(--dim)">场景：${cfg.scenario}</div>
        <div class="diag-progress">步骤 ${stepIdx + 1} / ${steps.length}</div>
        <div class="diag-question">${s.question}</div>
        <div class="diag-options" id="diagOpts"></div>
      `;
      const opts = document.getElementById('diagOpts');
      s.options.forEach((opt, i) => {
        const div = document.createElement('div');
        div.className = 'diag-opt';
        div.textContent = String.fromCharCode(65 + i) + '. ' + opt;
        div.onclick = () => {
          opts.querySelectorAll('.diag-opt').forEach(el => el.style.pointerEvents = 'none');
          if (i === s.correct) {
            div.classList.add('correct');
            playSound('click');
            stepIdx++;
            setTimeout(renderStep, 800);
          } else {
      window.errors++;
      window.streak = 0;
            div.classList.add('wrong');
            window.shakeScreen();
            playSound('error');
            // 厂长提示正确答案
            showWrongExplain(container, '厂长：' + (s.hint || ('这一步正确答案是「' + s.options[s.correct] + '」')), null);
            setTimeout(() => {
              opts.querySelectorAll('.diag-opt').forEach(el => {
                el.style.pointerEvents = 'auto';
                el.classList.remove('wrong');
              });
            }, 800);
          }
        };
        opts.appendChild(div);
      });
      document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="window.closeModal()">取消</button>`;
    }
    renderStep();
  }
});

// =========================================================================
// 8j. INTERACTION: DRAG_CLASSIFY
// =========================================================================
