// ═══════════════════════════════════════════════════════════════════
// interactions/scenario_match.js — 任务类型「scenario_match」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { taskXP } from '../core/utils.js';
import { playSound } from '../core/sound.js';
import { showWrongExplain } from '../core/fx.js';

registerInteraction('scenario_match', {
  render(container, task) {
    const cfg = task.config;
    const pairs = cfg.pairs || [];
    const items = pairs.map((p, i) => ({ text: p.item, pairIdx: i, side: 'left' }));
    const matches = pairs.map((p, i) => ({ text: p.match, pairIdx: i, side: 'right' }));
    // shuffle
    for (let i = matches.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [matches[i], matches[j]] = [matches[j], matches[i]];
    }

    let selectedItem = null;
    let matchedCount = 0;
    const matched = new Set();

    container.innerHTML = `
      <div style="font-size: 14px;color:var(--dim);margin-bottom:10px">点击左侧条目，再点击对应的右侧条目进行匹配：</div>
      <div class="match-area">
        <div class="match-col"><h4>概念 / 场景</h4><div id="matchLeft"></div></div>
        <div class="match-col"><h4>匹配项</h4><div id="matchRight"></div></div>
      </div>
    `;

    const leftEl = document.getElementById('matchLeft');
    const rightEl = document.getElementById('matchRight');

    function renderItems() {
      leftEl.innerHTML = '';
      rightEl.innerHTML = '';
      items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'match-item' + (matched.has(item.pairIdx) ? ' matched' : '') + (selectedItem === item ? ' selected' : '');
        div.textContent = item.text;
        if (!matched.has(item.pairIdx)) {
          div.onclick = () => { selectedItem = item; renderItems(); };
        }
        leftEl.appendChild(div);
      });
      matches.forEach(item => {
        const div = document.createElement('div');
        div.className = 'match-item' + (matched.has(item.pairIdx) ? ' matched' : '');
        div.textContent = item.text;
        if (!matched.has(item.pairIdx) && selectedItem) {
          div.onclick = () => {
              if (selectedItem.pairIdx === item.pairIdx) {
                matched.add(item.pairIdx);
                matchedCount++;
                selectedItem = null;
                renderItems();
                if (matchedCount >= pairs.length) {
                  playSound('success');
                  window.glowCorrect(document.getElementById('matchRight'));
                  document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="window.completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
                }
              } else {
      window.errors++;
      window.streak = 0;
                div.classList.add('wrong');
                window.shakeScreen();
                playSound('error');
                // 厂长提示正确配对（pairs 有 explain 则用，否则给正确匹配）
                var _pr = pairs[selectedItem.pairIdx];
                var _txt = (_pr && _pr.explain) ? _pr.explain : ('「' + _pr.item + '」对应的匹配是「' + _pr.match + '」，再想想？');
                showWrongExplain(container, '厂长：' + _txt, null);
                setTimeout(() => div.classList.remove('wrong'), 300);
              }
          };
        }
        rightEl.appendChild(div);
      });
    }
    renderItems();

    document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="window.closeModal()">取消</button>`;
  }
});

// =========================================================================
// 8f. INTERACTION: SORT
// =========================================================================
