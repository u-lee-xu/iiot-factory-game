// ═══════════════════════════════════════════════════════════════════
// interactions/sort.js — 任务类型「sort」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { escHtml, taskXP } from '../core/utils.js';
import { playSound } from '../core/sound.js';
import { showWrongExplain } from '../core/fx.js';

registerInteraction('sort', {
  render(container, task) {
    const cfg = task.config;
    const items = [...cfg.items];
    // shuffle
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    container.innerHTML = `
      <div class="wizard-narrative" id="sortTeach" style="margin-bottom:10px"></div>
      <div style="font-size: 14px;color:var(--dim);margin-bottom:10px">拖拽排序：将下列项目按正确顺序排列</div>
      <div class="sort-area" id="sortArea"></div>
    `;
    // 题面上方内嵌教学（sort 本身不带讲解，这里补上）
    try{
      const _teach = window.generateTeach(task);
      if (_teach) document.getElementById('sortTeach').innerHTML = '<span class="wiz-narr-label">厂长：</span>' + escHtml(_teach);
    }catch(e){}

    const area = document.getElementById('sortArea');
    let dragSrc = null;

    shuffled.forEach(text => {
      const div = document.createElement('div');
      div.className = 'sort-item';
      div.textContent = text;
      div.draggable = true;

      div.addEventListener('dragstart', e => {
        dragSrc = div;
        div.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      div.addEventListener('dragend', () => {
        div.classList.remove('dragging');
        dragSrc = null;
      });

      div.addEventListener('dragover', e => {
        e.preventDefault();
        div.classList.add('drag-over');
      });

      div.addEventListener('dragleave', () => {
        div.classList.remove('drag-over');
      });

      div.addEventListener('drop', e => {
        e.preventDefault();
        div.classList.remove('drag-over');
        if (dragSrc && dragSrc !== div) {
          const parent = area;
          const idx1 = Array.from(parent.children).indexOf(dragSrc);
          const idx2 = Array.from(parent.children).indexOf(div);
          if (idx1 < idx2) {
            parent.insertBefore(dragSrc, div.nextSibling);
          } else {
      window.errors++;
      window.streak = 0;
            parent.insertBefore(dragSrc, div);
          }
        }
      });

      area.appendChild(div);
    });

    document.getElementById('modalFoot').innerHTML = `
      <button class="btn" onclick="window.closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitSort()">检查顺序</button>
    `;

    window.submitSort = () => {
      const children = area.querySelectorAll('.sort-item');
      const order = Array.from(children).map(el => el.textContent);
      const correct = cfg.answer.every((targetIdx, pos) => order[pos] === cfg.items[targetIdx]);
      if (correct) {
        window.glowCorrect(area);
        playSound('success');
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="window.completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
      } else {
      window.errors++;
      window.streak = 0;
        window.shakeScreen();
        playSound('error');
        // 厂长提示正确顺序
        var _right = cfg.answer.map(function(idx){ return cfg.items[idx]; }).join(' → ');
        showWrongExplain(container, '厂长：正确顺序是「' + _right + '」，再排一次？', null);
      }
    };
  }
});

// =========================================================================
// 8g. INTERACTION: CODE_REVIEW
// =========================================================================
