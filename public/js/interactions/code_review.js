// ═══════════════════════════════════════════════════════════════════
// interactions/code_review.js — 任务类型「code_review」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { taskXP } from '../core/utils.js';
import { playSound } from '../core/sound.js';
import { showWrongExplain } from '../core/fx.js';

registerInteraction('code_review', {
  render(container, task) {
    const cfg = task.config;
    const codeLines = (cfg.code || '').replace(/\\n/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
    const codeHtml = codeLines.map((l, i) =>
      '<div class="code-line"><span class="code-no">' + (i + 1) + '</span><span class="code-text">' + l + '</span></div>'
    ).join('');
    container.innerHTML = `
      <div style="font-size: 14px;color:var(--dim);margin-bottom:6px">阅读以下代码（每条一行）：</div>
      <div class="code-block">${codeHtml}</div>
      <div style="font-size: 14px;margin-bottom:10px;color:var(--amber)">${cfg.hint || '找出问题：'}</div>
      <div style="font-size: 15px;margin-bottom:10px">${cfg.question}</div>
      <div class="quiz-options" id="codeOpts"></div>
    `;
    const opts = document.getElementById('codeOpts');
    cfg.options.forEach((opt, i) => {
      const div = document.createElement('div');
      div.className = 'quiz-opt';
      div.textContent = String.fromCharCode(65 + i) + '. ' + opt;
      div.onclick = () => {
        opts.querySelectorAll('.quiz-opt').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        document.getElementById('modalFoot').innerHTML = `
          <button class="btn" onclick="window.closeModal()">取消</button>
          <button class="btn btn-primary" onclick="submitCodeReview(${i}, ${cfg.answer})">提交</button>
        `;
      };
      opts.appendChild(div);
    });
    window.submitCodeReview = (choice, answer) => {
      const els = document.getElementById('codeOpts').querySelectorAll('.quiz-opt');
      els.forEach((el, i) => {
        el.style.pointerEvents = 'none';
        if (i === answer) el.classList.add('correct');
        if (i === choice && choice !== answer) el.classList.add('wrong');
      });
      if (choice === answer) {
        window.glowCorrect(els[answer]);
        playSound('success');
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="window.completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
      } else {
      window.errors++;
      window.streak = 0;
        window.shakeScreen();
        playSound('error');
        window.resetQuiz = () => {
          const lv = window.content.levels.find(l => l.id === window.currentLevelId);
          const t = lv.tasks.find(x => x.id === window.currentTaskId);
          if (t) window.openTaskModal(window.currentLevelId, window.currentTaskId);
        };
        document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="window.closeModal()">关闭</button> <button class="btn btn-primary" onclick="resetQuiz()">重试</button>`;
        // 厂长解释（cfg.hint 或正确答案）
        showWrongExplain(container, '厂长：' + (cfg.hint || ('正确答案是「' + (cfg.options[answer] || '') + '」')), null);
      }
    };
  }
});

// =========================================================================
// 8h. INTERACTION: ETHICS
// =========================================================================
