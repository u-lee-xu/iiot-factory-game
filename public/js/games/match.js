// ═══════════════════════════════════════════════════════════════════
// games/match — 拆自 app.js（openMatchGame）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openMatchGame(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (window.tutSeen('match') === false) {
    window.showGameTutorial('match', '🔗 连线配对', [
      '把左边的<b>术语</b>连到右边对应的<b>解释</b>',
      '全部配对成功即过关'
    ], function(){ openMatchGame(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('match'));
  if (cfg._hard) cfg.size = Math.min((cfg.size || 4) + 2, (cfg.pairs || []).length);   // 二周目：多加 2 组
  const pairs = (cfg.pairs || []).slice(0, cfg.size);
  const rights = pairs.map((p, i) => ({ text: p.right, pairIdx: i }));
  for (let i = rights.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rights[i], rights[j]] = [rights[j], rights[i]];
  }
  let selected = null;
  let matchedCount = 0;
  const matched = new Set();
  let finished = false;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="mm-box">
      <div class="mm-head">
        <div>
          <div class="mm-title">🔗 ${escHtml(cfg.name)}</div>
          <div class="mm-sub">${escHtml(cfg.subtitle || '')}</div>
        </div>
        <div class="mm-close">✕</div>
      </div>
      <div class="mm-stats"><span>配对 <b id="mmMatchCount">0</b>/${cfg.size}</span></div>
      <div class="match-area">
        <div class="match-col"><h4>${escHtml(cfg.leftTitle || '概念 / 场景')}</h4><div id="mmLeft"></div></div>
        <div class="match-col"><h4>${escHtml(cfg.rightTitle || '匹配项')}</h4><div id="mmRight"></div></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const leftEl = overlay.querySelector('#mmLeft');
  const rightEl = overlay.querySelector('#mmRight');
  const countEl = overlay.querySelector('#mmMatchCount');

  function render() {
    leftEl.innerHTML = '';
    rightEl.innerHTML = '';
    pairs.forEach((p, i) => {
      const div = document.createElement('div');
      div.className = 'match-item' + (matched.has(i) ? ' matched' : '') + (selected === i ? ' selected' : '');
      div.textContent = p.left;
      if (!matched.has(i)) div.onclick = () => { selected = i; render(); };
      leftEl.appendChild(div);
    });
    rights.forEach(r => {
      const div = document.createElement('div');
      div.className = 'match-item' + (matched.has(r.pairIdx) ? ' matched' : '');
      div.textContent = r.text;
      if (!matched.has(r.pairIdx) && selected !== null) {
        div.onclick = () => {
          if (selected === r.pairIdx) {
            matched.add(r.pairIdx);
            matchedCount++;
            selected = null;
            countEl.textContent = matchedCount;
            playSound('success');
            if (pairs[r.pairIdx].id) window.unlockPedia(window.currentLevelId, [pairs[r.pairIdx].id]);
            window.bumpGameStats({ mmMatched: (window.getGameStats().mmMatched || 0) + 1 });
            render();
            if (matchedCount >= cfg.size) finish(true);
          } else {
            div.classList.add('wrong');
            playSound('error');
            window.shakeScreen();
            setTimeout(() => div.classList.remove('wrong'), 300);
          }
        };
      }
      rightEl.appendChild(div);
    });
  }

  overlay.querySelector('.mm-close').onclick = () => {
    if (finished) return;
    window.playAreaMusic(); overlay.remove();
    if (onComplete) onComplete(false);
  };
  function finish(win) {
    finished = true;
    if (win) {
      playSound('fanfare');
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `<div class="big">🔗</div><div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:6px">${escHtml(cfg.name)} 完成！</div><div class="xp">+${cfg.xp || 0} XP</div><div style="font-size:14px;color:var(--dim)">${cfg.size} 组全部配对成功</div><div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" data-act="again">🔁 再玩一次</button><button class="mm-btn primary" data-act="done">收下奖励</button></div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="again"]').onclick = () => { window.playAreaMusic(); overlay.remove(); openMatchGame(cfg, onComplete); };
      overlay.querySelector('[data-act="done"]').onclick = () => { window.playAreaMusic(); overlay.remove(); window.recordGameWin('match'); window.miniMarkClear(cfg.id); if (onComplete) onComplete(true); };
    }
  }
  render();
}
