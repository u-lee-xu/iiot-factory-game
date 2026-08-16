// ═══════════════════════════════════════════════════════════════════
// interactions/chain_quiz.js — 任务类型「chain_quiz」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { escHtml, taskXP } from '../core/utils.js';
import { playSound } from '../core/sound.js';
import { showWrongExplain } from '../core/fx.js';
import { setupKbdNav } from '../core/kbd.js';

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
    window.addDirectorBox(container, teachText, () => showQ(), initialMood, { collapsed: true });

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
      // 每题：轻提示(hint)默认显示，完整讲解(teach)默认收起可展开（忘了可查看，符合A方案）
      const hintHtml = q.hint ? '<div style="background:rgba(255,179,64,.06);border-left:3px solid var(--amber);padding:8px 12px;border-radius:4px;margin:8px 0 10px;font-size:13px;line-height:1.6;color:var(--text)"><span style="color:var(--amber);font-weight:bold">💡 厂长提示：</span>' + escHtml(q.hint) + '</div>' : '';
      const teachHtml = q.teach ? '<div class="chain-teach-wrap" style="margin:6px 0"><div class="chain-teach-toggle" style="cursor:pointer;color:var(--dim);font-size:12px;user-select:none">📖 厂长讲解 ▾（忘了点开）</div><div class="chain-teach-body" style="display:none;background:rgba(0,188,212,.08);border-left:3px solid var(--cyan);padding:8px 12px;border-radius:4px;margin-top:6px;font-size:13px;line-height:1.7;color:var(--text)"><span style="color:var(--cyan);font-weight:bold">🤔 厂长：</span>' + escHtml(q.teach) + '</div></div>' : '';
      area.innerHTML = hintHtml + teachHtml + `
        <div style="font-size:15px;font-weight:bold;color:var(--text);margin:6px 0 4px">第 ${currentQ + 1}/${questions.length} 题</div>
        <div style="font-size:14px;color:var(--text);margin:0 0 10px;line-height:1.7">${escHtml(q.question)}</div>
        <div class="quiz-options" id="chainOpts" style="opacity:0.3;transition:opacity .5s"></div>
      `;
      container.appendChild(area);
      // 绑定"厂长讲解"展开/收起
      const _tg = area.querySelector('.chain-teach-toggle');
      if (_tg) {
        const _tb = area.querySelector('.chain-teach-body');
        _tg.onclick = function(){
          const hidden = _tb.style.display === 'none';
          _tb.style.display = hidden ? '' : 'none';
          _tg.textContent = hidden ? '📖 厂长讲解 ▴（收起）' : '📖 厂长讲解 ▾（忘了点开）';
          _tg.style.color = hidden ? 'var(--cyan)' : 'var(--dim)';
        };
      }
      setTimeout(() => { document.getElementById('chainOpts').style.opacity = '1'; }, 100);
      const opts = document.getElementById('chainOpts');
      q.options.forEach((opt, i) => {
        const div = document.createElement('div');
        div.className = 'quiz-opt';
        div.textContent = String.fromCharCode(65 + i) + '. ' + (typeof opt === 'object' ? opt.text : opt);
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
      setupKbdNav(document.getElementById('chainOpts'), '.quiz-opt');
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
        document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="window.closeModal()">关闭</button>`;
        // 厂长针对所点选项解释（对象选项 explain 优先，否则整体 hint）；点"知道了再试"回到本题重选
        const _wrongOpt = q.options[choice];
        const _exp = (typeof _wrongOpt === 'object' && _wrongOpt.explain) ? _wrongOpt.explain : (q.hint || '想岔了，再想想？');
        showWrongExplain(container, '厂长：' + _exp, () => { showQ(); });
      }
    };
    window.retryChain = () => { window.openTaskModal(window.currentLevelId, window.currentTaskId); };

    showQ();
  }
});

// =========================================================================
// 8c. INTERACTION: FILL_BLANK
// =========================================================================
