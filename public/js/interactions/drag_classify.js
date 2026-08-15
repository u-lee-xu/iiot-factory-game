// ═══════════════════════════════════════════════════════════════════
// interactions/drag_classify.js — 任务类型「drag_classify」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { taskXP } from '../core/utils.js';
import { playSound } from '../core/sound.js';

registerInteraction('drag_classify', {
  render(container, task) {
    const cfg = task.config;
    const items = [...cfg.items];
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const placed = {};  // itemName -> categoryName
    let streak = 0;
    let errors = 0;
    const teachText = window.generateTeach(task);

    container.innerHTML = `
      <div id="dragClassifyArea" style="opacity:0.3;transition:opacity .5s">
        <div style="font-size: 14px;color:var(--dim);margin-bottom:10px">将设备/概念拖到对应的分类中：</div>
        <div class="classify-area">
          <div class="classify-pool"><h4>待分类</h4><div id="classifyPool"></div></div>
          <div class="classify-cats"><h4>分类</h4><div id="classifyCats"></div></div>
        </div>
      </div>
    `;

    const initialMood = window.getDirectorMood(task, { firstTime: true });
    window.addDirectorBox(container, teachText, () => {
      document.getElementById('dragClassifyArea').style.opacity = '1';
    }, initialMood);

    const pool = document.getElementById('classifyPool');
    const cats = document.getElementById('classifyCats');

    // 待分类区支持拖回：已放置的项可拖回此处取消放置，重新分类
    pool.addEventListener('dragover', e => e.preventDefault());
    pool.addEventListener('drop', e => {
      e.preventDefault();
      const name = e.dataTransfer.getData('text/plain');
      if (name && placed[name]) {
        delete placed[name];
        renderClassify();
      }
    });

    cfg.categories.forEach(catName => {
      const catDiv = document.createElement('div');
      catDiv.className = 'classify-cat';
      catDiv.dataset.cat = catName;
      catDiv.innerHTML = `<span class="cat-label">${catName}</span>`;
      catDiv.addEventListener('dragover', e => e.preventDefault());
      catDiv.addEventListener('drop', e => {
        e.preventDefault();
        const name = e.dataTransfer.getData('text/plain');
        if (!name) return;
        placed[name] = catName;
        renderClassify();
      });
      cats.appendChild(catDiv);
    });

    function renderClassify() {
      pool.innerHTML = '';
      shuffled.forEach(name => {
        if (placed[name]) return;
        const div = document.createElement('div');
        div.className = 'classify-item';
        div.textContent = name;
        div.draggable = true;
        div.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', name);
          e.dataTransfer.effectAllowed = 'move';
        });
        pool.appendChild(div);
      });

      cats.querySelectorAll('.classify-cat').forEach(catDiv => {
        const catName = catDiv.dataset.cat;
        // remove old placed items
        catDiv.querySelectorAll('.placed-item').forEach(el => el.remove());
        Object.entries(placed).forEach(([name, cat]) => {
          if (cat === catName) {
            const span = document.createElement('span');
            span.className = 'placed-item';
            span.textContent = name;
            span.draggable = true;
            span.addEventListener('dragstart', e => {
              e.dataTransfer.setData('text/plain', name);
              e.dataTransfer.effectAllowed = 'move';
              span.style.opacity = '0.4';
            });
            span.addEventListener('dragend', () => { span.style.opacity = ''; });
            catDiv.appendChild(span);
          }
        });
      });

      const allPlaced = shuffled.every(name => placed[name]);
      if (allPlaced) {
        document.getElementById('modalFoot').innerHTML = `
          <button class="btn" onclick="window.closeModal()">取消</button>
          <button class="btn btn-primary" onclick="submitClassify()">确认分类</button>
        `;
      }
    }

    window.submitClassify = () => {
      const answers = cfg.answer || [];
      let correct = true;
      shuffled.forEach((name) => {
        const origIdx = cfg.items.indexOf(name);
        const expectedCatIdx = parseInt(answers[origIdx]);
        const expectedCat = cfg.categories[expectedCatIdx];
        if (placed[name] !== expectedCat) correct = false;
      });
      if (correct) {
        window.glowCorrect(document.getElementById('classifyCats'));
        playSound('success');
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="window.completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
      } else {
      errors++;
      streak = 0;
        window.shakeScreen();
        playSound('error');
        window.showToast('分类错误——设备重新报警了！再分类', 'error');
      }
    };

    renderClassify();
    document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="window.closeModal()">取消</button>`;
  }
});

// =========================================================================
// 8k. INTERACTION: BOSS_FIGHT (epic boss battle with HP system)
// =========================================================================
