// ═══════════════════════════════════════════════════════════════════
// interactions/drag_classify.js — 任务类型「drag_classify」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { taskXP } from '../core/utils.js';
import { playSound } from '../core/sound.js';
import { showWrongExplain } from '../core/fx.js';
import { setupKbdNav } from '../core/kbd.js';

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
    let kbdPicked = null; // 键盘选中的待分类项
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
    }, initialMood, { collapsed: true });

    const pool = document.getElementById('classifyPool');
    const cats = document.getElementById('classifyCats');



    cfg.categories.forEach(catName => {
      const catDiv = document.createElement('div');
      catDiv.className = 'classify-cat';
      catDiv.dataset.cat = catName;
      catDiv.innerHTML = `<span class="cat-label">${catName}</span>`;
      catDiv.onclick = () => { if (kbdPicked) { placed[kbdPicked] = catName; kbdPicked = null; renderClassify(); } };
      cats.appendChild(catDiv);
    });

    // 移动端(Pointer Events)拖放：兼容 iOS/微信。长按→拖动跟随→放置(hit-test 落到分类/待分类池)
    let dItem = null, dName = null, dStartX = 0, dStartY = 0, dTimer = null, dDragging = false, dGhost = null, dLastX = 0, dLastY = 0;
    function attachDrag(el, name) {
      el.style.touchAction = 'none';
      el.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        dItem = el; dName = name; dStartX = e.clientX; dStartY = e.clientY; dDragging = false; dLastX = e.clientX; dLastY = e.clientY;
        dTimer = setTimeout(function () {
          dDragging = true;
          dGhost = el.cloneNode(true);
          dGhost.style.position = 'fixed'; dGhost.style.pointerEvents = 'none'; dGhost.style.zIndex = '9999';
          dGhost.style.margin = '0'; dGhost.style.background = '#1a1a26';
          document.body.appendChild(dGhost);
          moveGhost(e.clientX, e.clientY);
        }, 200);
        window.addEventListener('pointermove', onDragMove);
        window.addEventListener('pointerup', onDragUp);
        window.addEventListener('pointercancel', onDragUp);
      });
    }
    function moveGhost(x, y) {
      if (dGhost && dItem) { const r = dItem.getBoundingClientRect(); dGhost.style.left = (x - r.width / 2) + 'px'; dGhost.style.top = (y - r.height / 2) + 'px'; }
      highlightTarget(x, y);
    }
    function highlightTarget(x, y) {
      cats.querySelectorAll('.classify-cat').forEach(function (c) { c.classList.remove('drag-over'); });
      pool.classList.remove('drag-over');
      const el = document.elementFromPoint(x, y);
      const cat = el && el.closest('.classify-cat');
      if (cat) cat.classList.add('drag-over');
      else if (el && el.closest('#classifyPool')) pool.classList.add('drag-over');
    }
    function onDragMove(e) {
      if (!dItem) return;
      if (!dDragging) { if (Math.hypot(e.clientX - dStartX, e.clientY - dStartY) > 8) clearTimeout(dTimer); return; }
      e.preventDefault();
      dLastX = e.clientX; dLastY = e.clientY;
      moveGhost(e.clientX, e.clientY);
    }
    function onDragUp() {
      clearTimeout(dTimer);
      if (dGhost && dGhost.parentNode) dGhost.parentNode.removeChild(dGhost);
      dGhost = null;
      cats.querySelectorAll('.classify-cat').forEach(function (c) { c.classList.remove('drag-over'); });
      pool.classList.remove('drag-over');
      if (dDragging && dName) {
        const el = document.elementFromPoint(dLastX, dLastY);
        const cat = el && el.closest('.classify-cat');
        const inPool = el && el.closest('#classifyPool');
        if (cat) { placed[dName] = cat.dataset.cat; renderClassify(); }
        else if (inPool) { delete placed[dName]; renderClassify(); }
      }
      dItem = null; dDragging = false; dName = null;
      window.removeEventListener('pointermove', onDragMove);
      window.removeEventListener('pointerup', onDragUp);
      window.removeEventListener('pointercancel', onDragUp);
    }
    function renderClassify() {
      pool.innerHTML = '';
      shuffled.forEach(name => {
        if (placed[name]) return;
        const div = document.createElement('div');
        div.className = 'classify-item' + (kbdPicked === name ? ' picked' : '');
        div.textContent = name;
        attachDrag(div, name);
        div.onclick = () => { kbdPicked = (kbdPicked === name) ? null : name; renderClassify(); };
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
            attachDrag(span, name);
            span.onclick = () => { delete placed[name]; renderClassify(); };
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
      setupKbdNav(container, '.classify-item, .classify-cat, .placed-item');   // 键盘：空格选中/放置/取消，回车提交
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
        // 厂长提示：找到第一个分错的项，应归哪类
        var _hint = '分类还没完全对，再想想？';
        for (var _i2=0;_i2<shuffled.length;_i2++) {
          var _n2 = shuffled[_i2];
          var _o2 = cfg.items.indexOf(_n2);
          var _ec2 = cfg.categories[parseInt(answers[_o2])];
          if (placed[_n2] !== _ec2) { _hint = '「' + _n2 + '」应该归入「' + _ec2 + '」类'; break; }
        }
        showWrongExplain(container, '厂长：' + _hint, null);
      }
    };

    renderClassify();
    document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="window.closeModal()">取消</button>`;
  }
});

// =========================================================================
// 8k. INTERACTION: BOSS_FIGHT (epic boss battle with HP system)
// =========================================================================
