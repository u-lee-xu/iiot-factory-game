// ═══════════════════════════════════════════════════════════════════
// interactions/sort.js — 任务类型「sort」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { escHtml, taskXP } from '../core/utils.js';
import { playSound } from '../core/sound.js';
import { showWrongExplain } from '../core/fx.js';
import { kbdCleanup } from '../core/kbd.js';

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

    shuffled.forEach(text => {
      const div = document.createElement('div');
      div.className = 'sort-item';
      div.textContent = text;
      area.appendChild(div);
    });
    // 移动端(Pointer Events)拖放排序：兼容 iOS Safari / 微信 WebView。长按→吸附高亮→拖动→放置；桌面鼠标同样适用
    makeSortable(area);

    function makeSortable(area) {
      const items = () => [...area.querySelectorAll('.sort-item')];
      let dragEl = null, startX = 0, startY = 0, timer = null, dragging = false;
      const LONG = 200, THRESH = 8;
      function endDrag(place) {
        clearTimeout(timer);
        if (!dragEl) return;
        if (dragging && place) {
          const rect = dragEl.getBoundingClientRect();
          const cy = rect.top + rect.height / 2;
          const list = items().filter(it => it !== dragEl);
          let inserted = false;
          for (const it of list) {
            const r = it.getBoundingClientRect();
            if (cy < r.top + r.height / 2) { area.insertBefore(dragEl, it); inserted = true; break; }
          }
          if (!inserted) area.appendChild(dragEl);
          list.forEach(it => it.classList.remove('drag-over'));
        }
        if (dragEl) { dragEl.classList.remove('dragging'); dragEl.style.transform = ''; dragEl.style.zIndex = ''; }
        dragEl = null; dragging = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      }
      function onMove(e) {
        if (!dragEl) return;
        if (!dragging) {
          if (Math.hypot(e.clientX - startX, e.clientY - startY) > THRESH) clearTimeout(timer);
          return;
        }
        e.preventDefault();
        dragEl.style.transform = 'translate(' + (e.clientX - startX) + 'px,' + (e.clientY - startY) + 'px)';
        const rect = dragEl.getBoundingClientRect();
        const cy = rect.top + rect.height / 2;
        const list = items().filter(it => it !== dragEl);
        let target = null;
        for (const it of list) {
          const r = it.getBoundingClientRect();
          if (cy < r.top + r.height / 2) { target = it; break; }
        }
        list.forEach(it => it.classList.remove('drag-over'));
        if (target) target.classList.add('drag-over');
      }
      function onDown(e) {
        const el = e.target.closest('.sort-item');
        if (!el) return;
        e.preventDefault();
        dragEl = el; startX = e.clientX; startY = e.clientY; dragging = false;
        timer = setTimeout(() => { dragging = true; el.classList.add('dragging'); el.style.zIndex = '50'; }, LONG);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      }
      function onUp() { endDrag(true); }
      items().forEach(el => el.addEventListener('pointerdown', onDown));
    }
    // 键盘重排：空格拿起/放下，↑/↓ 移动（无选中时移动光标）
    function setupSortKbd(area){
      kbdCleanup();
      const items=()=>[...area.querySelectorAll('.sort-item')];
      let idx=-1, picked=null;
      function focus(i, show){
        idx=i;
        const list=items();
        list.forEach(el=>el.classList.remove('kbd-focus'));
        if(show && list[i]) list[i].classList.add('kbd-focus');   // 键盘导航才显示光圈
      }
      function move(dir){
        const list=items();
        if(!list.length) return;
        if(picked===null){ focus((idx+dir+list.length)%list.length, true); }
        else{
          const cur=list.indexOf(picked);
          const to=cur+dir;
          if(to>=0&&to<list.length){
            const ref=list[to];
            if(to<cur) area.insertBefore(picked, ref);
            else area.insertBefore(picked, ref.nextSibling);
            focus(list.indexOf(picked));
          }
        }
      }
      function togglePick(){
        const list=items();
        if(idx<0||!list[idx]) return;
        if(picked===list[idx]){ picked=null; list[idx].classList.remove('picked'); }
        else{ picked=list[idx]; list.forEach(el=>el.classList.remove('picked')); list[idx].classList.add('picked'); }
      }
      function onKey(e){
        const list=items();
        if(!list.length) return;
        if(e.key==='ArrowDown'||e.key==='ArrowRight'){ e.preventDefault(); move(1); }
        else if(e.key==='ArrowUp'||e.key==='ArrowLeft'){ e.preventDefault(); move(-1); }
        else if(e.key===' '){ e.preventDefault(); togglePick(); }
        // 回车交给全局回车（检查顺序）
      }
      window.addEventListener('keydown', onKey);
      if(items().length) focus(0, false);   // 初始不显示光圈
      window.__kbdCleanup=function(){ window.removeEventListener('keydown', onKey); };
    }
    setupSortKbd(area);

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
