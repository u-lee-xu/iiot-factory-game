// ═══════════════════════════════════════════════════════════════════
// interactions/fill_blank.js — 任务类型「fill_blank」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { taskXP } from '../core/utils.js';
import { playSound } from '../core/sound.js';

registerInteraction('fill_blank', {
  render(container, task) {
    const cfg = task.config;
    const teachText = window.generateTeach(task);
    const question = cfg.prompt.replace(/.*?[：:]/,'').replace(/[「」""【】]/g,'');
    container.innerHTML = `
      <div class="fill-blank" id="fillBlankArea" style="margin-top:0">
        <p>${question.replace(/____/g, '<span class="highlight">____</span>')}</p>
        <div style="margin-top:12px">
          <select id="fillSelect">
            <option value="">请选择…</option>
            ${cfg.options.map((o, i) => `<option value="${i}">${o}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
    const initialMood = window.getDirectorMood(task, { firstTime: true });
    window.addDirectorBox(container, teachText, () => {
      document.getElementById('fillBlankArea').style.opacity = '1';
    }, initialMood);
    document.getElementById('fillBlankArea').style.opacity = '0.3';
    document.getElementById('fillBlankArea').style.transition = 'opacity .5s';

    document.getElementById('modalFoot').innerHTML = `
      <button class="btn" onclick="window.closeModal()">取消</button>
      <button class="btn btn-primary" id="fillSubmitBtn">提交</button>
    `;
    document.getElementById('fillSubmitBtn').onclick = () => {
      const sel = document.getElementById('fillSelect');
      const idx = parseInt(sel.value);
      if (isNaN(idx)) { window.showToast('机器等着你的答案——先选一个', 'error'); return; }
      const correct = cfg.options[idx] === cfg.answer || idx === cfg.answer;
      if (correct) {
        window.glowCorrect(document.getElementById('fillSelect'));
        playSound('success');
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="window.completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
      } else {
      window.errors++;
      window.streak = 0;
        window.shakeScreen();
        playSound('error');
        window.showToast('报警灯亮了！重新填写', 'error');
      }
    };
  }
});

// =========================================================================
// 8d. INTERACTION: PROGRESS_BAR
// =========================================================================
