// ═══════════════════════════════════════════════════════════════════
// games/stacked — 拆自 app.js（openStackedMatch）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openStackedMatch(cfg, onComplete) {
  playMusic('boss');
  const levels = cfg.levels;
  let cur = 0;
  let finished = false;
  let totalMatched = 0;
  const totalPairs = levels.reduce((sum, l) => sum + l.pairs.length, 0);
  let timeLeft = cfg.timeLimit || 120;
  let timer = null;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="mm-box">
      <div class="mm-head">
        <div>
          <div class="mm-title">🧠 ${escHtml(cfg.name)}</div>
          <div class="mm-sub" id="mmStackSub">${escHtml(levels[0].subtitle || '')}</div>
        </div>
        <div class="mm-close">✕</div>
      </div>
      <div class="mm-stats">
        <span>⏱ <b class="mm-timer">${timeLeft}</b>s</span>
        <span>层 <b id="mmStackCur">1</b>/${levels.length}</span>
        <span>配对 <b id="mmStackTotal">0</b>/${totalPairs}</span>
      </div>
      <div class="mm-timerbar"><div class="mm-timerbar-fill high" style="width:100%"></div></div>
      <div class="mm-stack" id="mmStack"></div>
      <div class="mm-foot">${escHtml(cfg.tip || '')}</div>
    </div>`;
  document.body.appendChild(overlay);

  const stack = overlay.querySelector('#mmStack');
  const subEl = overlay.querySelector('#mmStackSub');
  const curEl = overlay.querySelector('#mmStackCur');
  const totalEl = overlay.querySelector('#mmStackTotal');
  const timerEl = overlay.querySelector('.mm-timer');

  // 构建每一层牌堆
  levels.forEach((lv, li) => {
    const cards = [];
    lv.pairs.forEach((pr, i) => {
      cards.push({ pairId: i, kind: 'term', text: pr.term, emoji: pr.emoji });
      cards.push({ pairId: i, kind: 'hint', text: pr.hint, emoji: pr.emoji });
    });
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    const el = document.createElement('div');
    el.className = 'mm-stack-level' + (li === 0 ? ' active' : '');
    el.innerHTML = '<div class="mm-stack-grid"></div>';
    const grid = el.querySelector('.mm-stack-grid');
    const cols = Math.ceil(Math.sqrt(cards.length));
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';

    const st = { cards, flipped: [], lock: false, matched: 0, size: lv.pairs.length };
    cards.forEach((c, idx) => {
      const card = document.createElement('div');
      card.className = 'mm-card';
      card.dataset.idx = idx;
      card.innerHTML = '<div class="mm-inner"><div class="mm-face mm-back"><span>❔</span></div><div class="mm-face mm-front"><div class="mm-emoji">' + c.emoji + '</div><div class="mm-text">' + escHtml(c.text) + '</div></div></div>';
      card.addEventListener('click', () => {
        if (st.lock || finished) return;
        if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
        if (st.flipped.length >= 2) return;
        card.classList.add('flipped');
        playSound('click');
        st.flipped.push(card);
        if (st.flipped.length === 2) {
          st.lock = true;
          const [a, b] = st.flipped;
          const da = st.cards[+a.dataset.idx], db = st.cards[+b.dataset.idx];
          if (da.pairId === db.pairId && da.kind !== db.kind) {
            setTimeout(() => {
              a.classList.add('matched');
              b.classList.add('matched');
              st.matched++;
              totalMatched++;
              totalEl.textContent = totalMatched;
              playSound('success');
              st.flipped = [];
              st.lock = false;
              if (st.matched === st.size) {
                const ids = lv.pairs.map(pr => pr.id).filter(Boolean);
                if (ids.length) window.unlockPedia(window.currentLevelId, ids);
                setTimeout(() => nextLevel(li), 500);
              }
            }, 320);
          } else {
            setTimeout(() => {
              a.classList.add('wrong');
              b.classList.add('wrong');
              playSound('error');
              timeLeft = Math.max(0, timeLeft - 2.5);
              if (timerEl) timerEl.textContent = Math.max(Math.ceil(timeLeft), 0);
              const bar = overlay.querySelector('.mm-timerbar-fill');
              if (bar) {
                const pct = Math.max(0, Math.min(100, (timeLeft / mmTimeTotal) * 100));
                bar.style.width = pct + '%';
                bar.className = 'mm-timerbar-fill ' + (pct > 50 ? 'high' : pct > 25 ? 'mid' : 'low');
              }
              window.showToast('❌ 记错了，时间 -2.5s', 'error');
              setTimeout(() => {
                a.classList.remove('flipped', 'wrong');
                b.classList.remove('flipped', 'wrong');
                st.flipped = [];
                st.lock = false;
              }, 650);
            }, 480);
          }
        }
      });
      grid.appendChild(card);
    });
    stack.appendChild(el);
  });

  function nextLevel(li) {
    if (li + 1 >= levels.length) { finish(true); return; }
    const curEl2 = stack.children[li];
    const nextEl = stack.children[li + 1];
    curEl2.classList.remove('active');
    curEl2.classList.add('leaving');
    nextEl.classList.add('active');
    cur = li + 1;
    curEl.textContent = cur + 1;
    subEl.textContent = levels[cur].subtitle || '';
    playSound('levelup');
    setTimeout(() => { curEl2.style.display = 'none'; }, 600);
  }

  const mmTimeTotal = Math.max(timeLeft, 1);
  let mmLastTick = 99;
  timer = setInterval(() => {
    timeLeft -= 0.1;
    if (timerEl) timerEl.textContent = Math.max(Math.ceil(timeLeft), 0);
    const mmSec = Math.ceil(timeLeft);
    if (mmSec <= 5 && mmSec > 0 && mmSec !== mmLastTick) { playSound('tick'); mmLastTick = mmSec; }
    const bar = overlay.querySelector('.mm-timerbar-fill');
    if (bar) {
      const pct = Math.max(0, Math.min(100, (timeLeft / mmTimeTotal) * 100));
      bar.style.width = pct + '%';
      bar.className = 'mm-timerbar-fill ' + (pct > 50 ? 'high' : pct > 25 ? 'mid' : 'low');
    }
    if (timeLeft <= 0 && !finished) { clearInterval(timer); finish(false); }
  }, 100);

  overlay.querySelector('.mm-close').onclick = () => {
    if (finished) return;
    clearInterval(timer);
    closeOverlay();
  };
  function closeOverlay() {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .3s';
    setTimeout(() => { window.playAreaMusic(); overlay.remove(); if (onComplete) onComplete(false); }, 300);
  }
  function finish(win) {
    finished = true;
    clearInterval(timer);
    if (win) {
      playSound('fanfare');
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `
        <div class="big">🏆</div>
        <div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:6px">${escHtml(cfg.name)} 通关！</div>
        <div class="xp">+${cfg.xp || 0} XP</div>
        <div style="font-size:14px;color:var(--dim)">三层全破，${totalPairs} 对全认全</div>
        <div class="note">挑战奖励不计入排行榜，重在混个脸熟</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="mm-btn primary" data-act="done">收下奖励</button>
        </div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="done"]').onclick = () => { window.playAreaMusic(); overlay.remove(); window.recordGameWin('mm'); window.miniMarkClear(cfg.id); if (onComplete) onComplete(true); };
    } else {
      playSound('fail');
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `
        <div class="big">⏰</div>
        <div style="font-size:20px;font-weight:bold;color:var(--red);margin-top:6px">时间到，还差 ${totalPairs - totalMatched} 对</div>
        <div style="font-size:14px;color:var(--dim);margin-top:8px">混个脸熟就行，再来一次吧！</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="mm-btn primary" data-act="retry">🔁 再来一次</button>
          <button class="mm-btn" data-act="skip">先干正事</button>
        </div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="retry"]').onclick = () => { window.playAreaMusic(); overlay.remove(); openStackedMatch(cfg, onComplete); };
      overlay.querySelector('[data-act="skip"]').onclick = () => { window.playAreaMusic(); overlay.remove(); if (onComplete) onComplete(false); };
    }
  }
}
