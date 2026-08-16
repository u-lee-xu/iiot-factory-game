// ═══════════════════════════════════════════════════════════════════
// interactions/ethics.js — 任务类型「ethics」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { taskXP } from '../core/utils.js';
import { playSound } from '../core/sound.js';
import { setupKbdNav } from '../core/kbd.js';

registerInteraction('ethics', {
  render(container, task) {
    const cfg = task.config;
    container.innerHTML = `
      <div class="ethics-scenario">${cfg.scenario}</div>
      <div class="ethics-choices" id="ethicsChoices"></div>
      <div class="ethics-consequence" id="ethicsCons"></div>
    `;
    const choices = document.getElementById('ethicsChoices');
    cfg.choices.forEach((text, i) => {
      const div = document.createElement('div');
      div.className = 'ethics-choice';
      div.textContent = String.fromCharCode(65 + i) + '. ' + text;
      div.onclick = () => {
        choices.querySelectorAll('.ethics-choice').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        document.getElementById('modalFoot').innerHTML = `
          <button class="btn" onclick="window.closeModal()">取消</button>
          <button class="btn btn-primary" onclick="submitEthics(${i})">提交选择</button>
        `;
      };
      choices.appendChild(div);
    });
    setupKbdNav(choices, '.ethics-choice');
    window.submitEthics = (choice) => {
      const allChoices = choices.querySelectorAll('.ethics-choice');
      allChoices.forEach((el, i) => {
        el.style.pointerEvents = 'none';
        if (i === cfg.best) el.classList.add('revealed-best');
        else el.classList.add('revealed');
      });
      const cons = document.getElementById('ethicsCons');
      cons.className = 'ethics-consequence show ' + (choice === cfg.best ? 'good' : 'ok');
      cons.textContent = '结果：' + cfg.consequences[choice];
      if (choice === cfg.best) {
        playSound('success');
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="window.completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
      } else {
      window.errors++;
      window.streak = 0;
        playSound('click');
        document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="window.closeModal()">关闭</button>`;
      }
    };
  }
});

// =========================================================================
// 8i. INTERACTION: DIAGNOSIS_TREE
// =========================================================================
