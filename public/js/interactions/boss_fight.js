// ═══════════════════════════════════════════════════════════════════
// interactions/boss_fight.js — 任务类型「boss_fight」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { taskXP } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

registerInteraction('boss_fight', {
  render(container, task) {
    const cfg = task.config;
    playMusic('boss');
    let phase = 0;
    let qIdx = 0;
    let bossHP = 100;
    let playerHP = 3;
    const maxBossHP = 100;
    let bossDefeated = false;

    function renderBoss() {
      if (bossDefeated) {
        container.innerHTML = `<div style="text-align:center;padding:30px">
          <div style="font-size:64px;animation:levelUpAnim .5s ease-out">🏆</div>
          <div style="color:var(--green);font-size:18px;font-weight:bold;margin:12px 0">${cfg.bossName} 已被击败！</div>
          <div style="font-size: 14px;color:var(--dim)">厂长拍了拍你：「干得漂亮！」</div>
        </div>`;
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="window.completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
        playSound('levelup');
        return;
      }
      if (playerHP <= 0) {
        container.innerHTML = `<div style="text-align:center;padding:30px">
          <div style="font-size:48px">💀</div>
          <div style="color:var(--red);font-size:16px;margin:12px 0">Boss 太强了，重整旗鼓再战！</div>
        </div>`;
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-primary" onclick="resetBattle()">🔄 重新挑战</button>`;
        return;
      }

      const p = cfg.phases[phase];
      if (!p) { bossDefeated = true; renderBoss(); return; }
      const q = p.questions[qIdx];
      if (!q) { bossDefeated = true; renderBoss(); return; }

      container.innerHTML = `
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size: 14px">
            <span>${cfg.bossEmoji || '👾'} <strong>${cfg.bossName}</strong></span>
            <span>${'❤️'.repeat(playerHP)}${'🖤'.repeat(Math.max(0,3-playerHP))}</span>
          </div>
          <div class="boss-hp-bg">
            <div class="boss-hp-fill" id="bossHPFill" style="width:${Math.round(bossHP/maxBossHP*100)}%"></div>
            <span class="boss-hp-label">${cfg.bossName} HP ${bossHP}/${maxBossHP}</span>
          </div>
          <div style="font-size: 14px;color:var(--dim);margin-top:4px;display:flex;justify-content:space-between">
            <span>阶段 ${phase+1}/${cfg.phases.length}: ${p.name}</span>
            <span>${qIdx+1}/${p.questions.length}</span>
          </div>
        </div>
        <div style="font-size: 15px;margin:12px 0;color:var(--amber)">⚔️ ${q.question}</div>
        <div class="quiz-options" id="bossOpts"></div>
      `;

      const opts = document.getElementById('bossOpts');
      q.options.forEach((opt, i) => {
        const div = document.createElement('div');
        div.className = 'quiz-opt';
        div.textContent = String.fromCharCode(65 + i) + '. ' + opt;
        div.onclick = () => {
          opts.querySelectorAll('.quiz-opt').forEach(el => el.style.pointerEvents = 'none');
          if (i === q.answer) {
            div.classList.add('correct');
            window.glowCorrect(div);
            playSound('success');
            const damage = Math.ceil(maxBossHP / (p.questions.length * cfg.phases.length));
            bossHP = Math.max(0, bossHP - damage);
            document.getElementById('bossHPFill').style.width = Math.round(bossHP/maxBossHP*100) + '%';
            qIdx++;
            if (qIdx >= p.questions.length) {
              qIdx = 0;
              phase++;
              if (phase >= cfg.phases.length) bossDefeated = true;
            }
            setTimeout(renderBoss, 600);
          } else {
      window.errors++;
      window.streak = 0;
            div.classList.add('wrong');
            window.shakeScreen();
            playSound('error');
            playerHP--;
            setTimeout(renderBoss, 800);
          }
        };
        opts.appendChild(div);
      });

      document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="window.closeModal()">取消</button>`;
    }

    window.resetBattle = () => {
      phase = 0; qIdx = 0; bossHP = cfg.phases[0].bossHP; playerHP = 3; bossDefeated = false;
      renderBoss();
    };

    renderBoss();
  }
});

// =========================================================================
// 8z. DEFAULT INTERACTION
// =========================================================================

// =========================================================================
// NEW: config_debug - 给破损配置文件，学生修复后运行验证
// =========================================================================
