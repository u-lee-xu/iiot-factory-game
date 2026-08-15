// ═══════════════════════════════════════════════════════════════════
// interactions/chain_quiz.js — 任务类型「chain_quiz」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { escHtml, taskXP } from '../core/utils.js';
import { playSound } from '../core/sound.js';

registerInteraction('chain_quiz', {
  render(container, task) {
    const cfg = task.config;
    const questions = cfg.questions || [];
    let currentQ = 0;
    let streak = 0;
    let errors = 0;
    const teachText = window.generateTeach(task);

    container.innerHTML = '';
    const initialMood = window.getDirectorMood(task, { firstTime: true });
    window.addDirectorBox(container, teachText, () => showQ(), initialMood);

    function showQ() {
      if (currentQ >= questions.length) {
        const old = container.querySelector('#chainArea');
        if (old) old.remove();
        const done = document.createElement('div');
        done.id = 'chainArea';
        done.style.cssText = 'text-align:center;padding:20px;color:var(--green)';
        done.textContent = '✅ 全部答对！';
        container.appendChild(done);
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="window.completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
        return;
      }
      const q = questions[currentQ];
      const old = container.querySelector('#chainArea');
      if (old) old.remove();
      const area = document.createElement('div');
      area.id = 'chainArea';
      area.innerHTML = `
        ${q.teach ? '<div style="background:rgba(0,188,212,.08);border-left:3px solid var(--cyan);padding:10px 12px;border-radius:4px;margin:8px 0 10px;font-size:14px;line-height:1.7;color:var(--text)"><span style="color:var(--cyan);font-weight:bold">🤔 厂长：</span>' + escHtml(q.teach) + '</div>' : ''}
        <div style="font-size:15px;font-weight:bold;color:var(--text);margin:6px 0 4px">第 ${currentQ + 1}/${questions.length} 题</div>
        <div style="font-size:14px;color:var(--text);margin:0 0 10px;line-height:1.7">${escHtml(q.question)}</div>
        <div class="quiz-options" id="chainOpts" style="opacity:0.3;transition:opacity .5s"></div>
      `;
      container.appendChild(area);
      setTimeout(() => { document.getElementById('chainOpts').style.opacity = '1'; }, 100);
      const opts = document.getElementById('chainOpts');
      q.options.forEach((opt, i) => {
        const div = document.createElement('div');
        div.className = 'quiz-opt';
        div.textContent = String.fromCharCode(65 + i) + '. ' + opt;
        div.onclick = () => {
          opts.querySelectorAll('.quiz-opt').forEach(el => el.classList.remove('selected'));
          div.classList.add('selected');
          document.getElementById('modalFoot').innerHTML = `
            <button class="btn" onclick="window.closeModal()">取消</button>
            <button class="btn btn-primary" onclick="submitChain(${i})">提交</button>
          `;
        };
        opts.appendChild(div);
      });
      document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="window.closeModal()">取消</button>`;
    }

    window.submitChain = (choice) => {
      const q = questions[currentQ];
      const allOpts = document.getElementById('chainOpts').querySelectorAll('.quiz-opt');
      allOpts.forEach((el, i) => {
        el.style.pointerEvents = 'none';
        if (i === q.answer) el.classList.add('correct');
        if (i === choice && choice !== q.answer) el.classList.add('wrong');
      });
      if (choice === q.answer) {
        window.glowCorrect(allOpts[q.answer]);
        playSound('success');
        currentQ++;
        setTimeout(showQ, 600);
      } else {
      errors++;
      streak = 0;
        window.shakeScreen();
        playSound('error');
        document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="window.closeModal()">关闭</button> <button class="btn btn-primary" onclick="retryChain()">重试</button>`;
        window.showToast(q.hint || '设备报警了——再试', 'error');
      }
    };
    window.retryChain = () => { window.openTaskModal(window.currentLevelId, window.currentTaskId); };

    showQ();
  }
});

// =========================================================================
// 8c. INTERACTION: FILL_BLANK
// =========================================================================
