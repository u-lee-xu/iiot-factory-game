// ═══════════════════════════════════════════════════════════════════
// interactions/diagnosis_tree.js — 任务类型「diagnosis_tree」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { taskXP } from '../core/utils.js';
import { playSound } from '../core/sound.js';
import { showWrongExplain } from '../core/fx.js';
import { setupKbdNav } from '../core/kbd.js';
import { cmdAnnotateBox } from '../core/cmd-annotate.js';

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
      // —— 命令实操步骤：终端输入排障命令 ——
      if (s.type === 'command') { renderCmdStep(s); return; }
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
            // 厂长提示：先给"功能/思路"提示（不是直接答案）
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
      setupKbdNav(opts, '.diag-opt');
      document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="window.closeModal()">取消</button>`;
    }

    // 命令实操步骤：模拟终端，输入排障命令，正确则输出解读并进入下一步
    function renderCmdStep(s) {
      let errCount = 0;
      container.innerHTML = `
        <div style="margin-bottom:6px;font-size: 14px;color:var(--dim)">场景：${cfg.scenario}</div>
        <div class="diag-progress">步骤 ${stepIdx + 1} / ${steps.length}</div>
        <div class="diag-question">${s.question}</div>
        ${cmdAnnotateBox(s.command)}
        <div class="term-root" style="margin-top:8px">
          <div class="term-header"><span class="term-dots"><span class="term-dot red"></span><span class="term-dot yellow"></span><span class="term-dot green"></span></span><span>锐智终端 · 排障</span></div>
          <div class="term-body" id="diagTermOut" style="padding:8px;font-size:14px;color:var(--dim);max-height:190px;overflow-y:auto;min-height:64px;background:#0a0a10">
            ${s.prompt ? '<div style="color:var(--amber);margin-bottom:4px">▶ ' + s.prompt + '</div>' : ''}
          </div>
          <div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:#0a0a10;border-top:1px solid #1a1a24">
            <span style="color:var(--green)">root@锐智:~$</span>
            <input id="diagCmd" type="text" style="flex:1;background:transparent;border:none;color:var(--green);outline:none;font:inherit;font-size:14px" autocomplete="off" spellcheck="false" placeholder="输入命令…">
          </div>
        </div>
      `;
      const out = document.getElementById('diagTermOut');
      const input = document.getElementById('diagCmd');
      document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="window.closeModal()">取消</button>`;

      function check() {
        const v = input.value.trim();
        if (!v) return;
        const norm = v.toLowerCase().replace(/\s+/g, ' ');
        const cmds = [s.command].concat(s.aliases || []).map(c => String(c).toLowerCase().replace(/\s+/g, ' '));
        const ok = cmds.some(c => norm === c || norm.startsWith(c));
        if (ok) {
          playSound('success');
          input.disabled = true;
          const lines = [{ text: '$ ' + v, color: 'cyan', delay: 120 }].concat(s.outputLines || [{ text: '命令执行成功', color: '' }]);
          let i = 0;
          function next() {
            if (i < lines.length) {
              const ln = document.createElement('div');
              ln.textContent = lines[i].text;
              if (lines[i].color) ln.style.color = lines[i].color;
              out.appendChild(ln); out.scrollTop = out.scrollHeight;
              i++; setTimeout(next, lines[i - 1].delay || 80);
            } else {
              if (s.explain) {
                const ex = document.createElement('div');
                ex.style.cssText = 'color:var(--amber);margin-top:6px;font-weight:bold';
                ex.textContent = '厂长解读：' + s.explain;
                out.appendChild(ex);
              }
              if (s.successText) {
                const okD = document.createElement('div');
                okD.style.cssText = 'color:var(--green);margin-top:6px';
                okD.textContent = s.successText;
                out.appendChild(okD);
              }
              out.scrollTop = out.scrollHeight;
              // 不自动跳转：让玩家看清厂长解读后，按回车（或点「继续」）进入下一步
              document.getElementById('modalFoot').innerHTML =
                '<button class="btn" onclick="window.closeModal()">取消</button>' +
                '<button class="btn btn-primary" id="diagNextBtn">▶ 按回车继续</button>';
              document.getElementById('diagNextBtn').onclick = function(){ stepIdx++; renderStep(); };
            }
          }
          next();
        } else {
          window.errors++; window.streak = 0;
          window.shakeScreen(); playSound('error');
          errCount++;
          const errD = document.createElement('div');
          errD.style.cssText = 'color:var(--red);margin-top:6px';
          errD.textContent = 'bash: ' + v.split(' ')[0] + ': 命令未找到，或参数不正确';
          out.appendChild(errD);
          const hintD = document.createElement('div');
          hintD.style.cssText = 'color:var(--amber);margin-top:4px';
          // 提示分级：第一次给功能提示，第二次给答案
          hintD.textContent = errCount >= 2 ? (s.hint2 || ('答案：' + s.command)) : (s.hint1 || ('提示：' + s.command));
          out.appendChild(hintD);
          out.scrollTop = out.scrollHeight;
          input.value = ''; input.focus();
        }
      }
      input.addEventListener('keydown', function(e){ if (e.key === 'Enter') check(); });
      setTimeout(function(){ input.focus(); }, 120);
    }
    renderStep();
  }
});

// =========================================================================
// 8j. INTERACTION: DRAG_CLASSIFY
// =========================================================================
