// ═══════════════════════════════════════════════════════════════════
// interactions/log_forensics.js — 任务类型「log_forensics」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { taskXP } from '../core/utils.js';
import { playSound } from '../core/sound.js';

registerInteraction('log_forensics', {
  render(container, task) {
    const cfg = task.config;
    const logs = cfg.logs || ['日志加载失败'];
    const options = cfg.options || []; // [{id, text, correct, explanation}]
    const allowMulti = cfg.multiSelect !== false;
    let selected = new Set();

    container.innerHTML = `
      <div style="margin-bottom:10px">
        <div style="font-size: 15px;margin-bottom:8px;color:var(--text)">${cfg.scenario || '分析以下日志，定位故障根因'}</div>
        <div class="term-root" style="max-height:200px;overflow:auto;margin-bottom:12px;border:1px solid var(--border);background:#0a0a10">
          <div class="term-header" style="position:sticky;top:0;background:#0a0a10;z-index:1">
            <span class="term-dots"><span class="term-dot red"></span><span class="term-dot yellow"></span><span class="term-dot green"></span></span>
            <span>📋 系统日志</span>
          </div>
          <pre id="forensicsLog" style="padding:10px;margin:0;font-family:inherit;font-size: 14px;line-height:1.5;color:var(--dim);white-space:pre-wrap"></pre>
        </div>
      </div>
      <div style="font-size: 14px;color:var(--dim);margin-bottom:8px">
        ${allowMulti ? '可多选，点击选项切换' : '单选，点击选择答案'}
      </div>
      <div id="forensicsOptions" style="display:flex;flex-direction:column;gap:6px"></div>
      <div id="forensicsExplanation" style="margin-top:12px;padding:10px;background:#1a1a24;border:1px solid var(--border);display:none"></div>
    `;

    document.getElementById('forensicsLog').textContent = logs.join('\n');

    const optContainer = document.getElementById('forensicsOptions');
    options.forEach((opt, i) => {
      const el = document.createElement('div');
      el.className = 'forensics-opt';
      el.style.cssText = 'padding:10px 12px;background:#12121a;border:2px solid var(--border);border-radius:4px;cursor:pointer;transition:all .2s;font-size: 14px';
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
          <span class="opt-mark" style="width:18px;height:18px;border:2px solid var(--border);border-radius:${allowMulti ? '2px' : '50%'};display:flex;align-items:center;justify-window.content:center;font-size: 14px;color:var(--green)"></span>
          <span>${opt.text}</span>
        </div>
      `;
      el.onclick = () => {
        if (allowMulti) {
          if (selected.has(opt.id)) selected.delete(opt.id);
          else selected.add(opt.id);
        } else {
      window.errors++;
      window.streak = 0;
          selected.clear();
          selected.add(opt.id);
        }
        renderOptions();
      };
      optContainer.appendChild(el);
    });

    function renderOptions() {
      document.querySelectorAll('.forensics-opt').forEach((el, i) => {
        const opt = options[i];
        const mark = el.querySelector('.opt-mark');
        const isSel = selected.has(opt.id);
        if (isSel) {
          el.style.borderColor = 'var(--green)';
          el.style.background = 'rgba(0,230,118,.1)';
          mark.textContent = allowMulti ? '✓' : '●';
          mark.style.borderColor = 'var(--green)';
          mark.style.background = 'var(--green)';
          mark.style.color = '#000';
        } else {
      window.errors++;
      window.streak = 0;
          el.style.borderColor = 'var(--border)';
          el.style.background = '#12121a';
          mark.textContent = '';
          mark.style.borderColor = 'var(--border)';
          mark.style.background = 'transparent';
        }
      });
    }

    document.getElementById('modalFoot').innerHTML = `
      <button class="btn" onclick="window.closeModal()">取消</button>
      <button class="btn btn-primary" id="forensicsSubmit" disabled>✓ 提交分析</button>
    `;

    // Enable submit when at least one selected
    const obs = new MutationObserver(() => {
      document.getElementById('forensicsSubmit').disabled = selected.size === 0;
    });
    obs.observe(optContainer, { childList: true, subtree: true, attributes: true });

    document.getElementById('forensicsSubmit').onclick = () => {
      const correctIds = options.filter(o => o.correct).map(o => o.id);
      const isCorrect = allowMulti
        ? selected.size === correctIds.length && [...selected].every(id => correctIds.includes(id))
        : correctIds.includes([...selected][0]);

      const expl = document.getElementById('forensicsExplanation');
      expl.style.display = 'block';
      
      if (isCorrect) {
        expl.innerHTML = `<div style="color:var(--green)">✅ 分析正确！</div>${options.filter(o => correctIds.includes(o.id)).map(o => `<div style="margin-top:6px;color:var(--text)"><strong>${o.text}</strong>: ${o.explanation || ''}</div>`).join('')}`;
        playSound('success');
        setTimeout(() => window.completeTask(task.id, taskXP(task)), 800);
      } else {
      window.errors++;
      window.streak = 0;
        expl.innerHTML = `<div style="color:var(--red)">❌ 分析有误，请重新排查</div>${options.filter(o => selected.has(o.id) && !o.correct).map(o => `<div style="margin-top:6px;color:var(--amber)">⚠ ${o.text}: ${o.explanation || '这不是根因'}</div>`).join('')}`;
        playSound('error');
      }
      document.getElementById('forensicsSubmit').disabled = true;
      document.getElementById('forensicsSubmit').textContent = isCorrect ? '✅ 完成' : '🔄 重新分析';
      if (!isCorrect) {
        setTimeout(() => {
          document.getElementById('forensicsSubmit').disabled = false;
          document.getElementById('forensicsSubmit').textContent = '✓ 提交分析';
          expl.style.display = 'none';
        }, 1500);
      }
    };
  }
});


