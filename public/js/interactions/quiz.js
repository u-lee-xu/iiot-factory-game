// ═══════════════════════════════════════════════════════════════════
// interactions/quiz.js — 任务类型「quiz」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { taskXP } from '../core/utils.js';
import { playSound } from '../core/sound.js';
import { showWrongExplain } from '../core/fx.js';
import { setupKbdNav } from '../core/kbd.js';

registerInteraction('quiz', {
  render(container, task) {
    const cfg = task.config;
    let streak = 0;
    let errors = 0;
    const teachText = window.generateTeach(task);
    container.innerHTML = `
      <div class="quiz-question" id="quizQ" style="opacity:0.3;font-size:15px;color:var(--fg);padding:6px 0;font-weight:600;transition:opacity .5s"></div>
      <div class="quiz-options" id="quizOpts" style="opacity:0.3;margin-top:0;transition:opacity .5s"></div>
    `;
    document.getElementById("quizQ").textContent = cfg.question;
    const initialMood = window.getDirectorMood(task, { firstTime: true });
    window.addDirectorBox(container, teachText, () => {
      document.getElementById('quizQ').style.opacity = '1';
      document.getElementById('quizOpts').style.opacity = '1';
      setupKbdNav(document.getElementById('quizOpts'), '.quiz-opt');
    }, initialMood, { collapsed: true });
    const opts = document.getElementById('quizOpts');
    cfg.options.forEach((opt, i) => {
      const div = document.createElement('div');
      div.className = 'quiz-opt';
      div.textContent = String.fromCharCode(65 + i) + '. ' + (typeof opt === 'object' ? opt.text : opt);
      div.onclick = () => {
        opts.querySelectorAll('.quiz-opt').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        const correct = i === cfg.answer;
        document.getElementById('modalFoot').innerHTML = `
          <button class="btn" onclick="window.closeModal()">取消</button>
          <button class="btn btn-primary" onclick="submitQuiz(${i})">提交</button>
        `;
      };
      opts.appendChild(div);
    });
    window.submitQuiz = (choice) => {
      const optsEl = document.getElementById('quizOpts');
      const allOpts = optsEl.querySelectorAll('.quiz-opt');
      allOpts.forEach((el, i) => {
        el.style.pointerEvents = 'none';
        if (i === cfg.answer) el.classList.add('correct');
        if (i === choice && choice !== cfg.answer) el.classList.add('wrong');
      });
      if (choice === cfg.answer) {
        streak++;
        errors = 0;
        window.glowCorrect(allOpts[cfg.answer]);
        playSound('success');
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="window.completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
      } else {
        errors++;
        streak = 0;
        window.shakeScreen();
        playSound('error');
        document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="window.closeModal()">关闭</button>`;
        // 厂长针对所点选项解释（对象选项 explain 优先，否则 hint/通用）；点"知道了再试"留在本题重选
        const _wrongOpt = cfg.options[choice];
        const _exp = (typeof _wrongOpt === 'object' && _wrongOpt.explain) ? _wrongOpt.explain : (cfg.hint || '操作错误，再想想？');
        showWrongExplain(container, '厂长：' + _exp, () => {
          optsEl.querySelectorAll('.quiz-opt').forEach(el => {
            el.classList.remove('wrong','correct','selected');
            el.style.pointerEvents = '';
          });
          document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="window.closeModal()">取消</button>`;
        });
      }
    };
    window.resetQuiz = () => {
      const lv = window.content.levels.find(l => l.id === window.currentLevelId);
      const t = lv.tasks.find(x => x.id === window.currentTaskId);
      if (t) window.openTaskModal(window.currentLevelId, window.currentTaskId);
    };
  }
});

// =========================================================================
// 8b2. INTERACTION: CHAIN_QUIZ (linked multi-question)
// =========================================================================
