// ═══════════════════════════════════════════════════════════════════
// games/m3 — 拆自 app.js（openMatch3）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openMatch3(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('m3')) {
    window.showGameTutorial('m3', '🍬 消消乐·三连车间', [
      '<b>点击两个相邻的同类</b>（或点一个再点相邻），<b>三连</b>就消除',
      '消除后上方会掉下新块，<b>连锁消除</b>分数更高',
      '每波达到目标分即过关；步数用完就失败'
    ], function(){ openMatch3(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('m3') || 'match');
  const cats = (cfg.categories || []).map(c => ({ name: String(c.name||''), emoji: c.emoji||'🍬' }));
  if (cats.length < 3) { window.showToast('分类种类太少', 'error'); return; }
  const COLS = cfg.cols || 8, ROWS = cfg.rows || 6;
  const COLORS = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#c07bd6','#ff9f43'];
  const WAVES = cfg.waves || 3;
  let wave = 1, score = 0, moves = 0, ended = false;
  let board = [], sel = null, resolving = false;
  let waveTarget = 0, waveMoves = 0;

  function newWave() {
    const targets = [28, 40, 52];
    const movesLim = [16, 18, 20];
    waveTarget = targets[Math.min(wave-1, targets.length-1)];
    waveMoves = movesLim[Math.min(wave-1, movesLim.length-1)];
    moves = 0;
    waveEl.textContent = wave + '/' + WAVES;
    tgtEl.textContent = waveTarget;
    movesEl.textContent = waveMoves;
    // 生成无初始三连的板
    do { genBoard(); } while (findMatches().length);
    render();
  }
  function genBoard() {
    board = [];
    for (let r=0;r<ROWS;r++) { board[r]=[]; for (let c=0;c<COLS;c++) {
      let col; do { col = Math.floor(Math.random()*cats.length); } while (r>=2 && board[r-1][c]===col && board[r-2][c]===col || c>=2 && board[r][c-1]===col && board[r][c-2]===col);
      board[r][c] = col;
    }}
  }
  function findMatches() {
    const matched = new Set();
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      // 横向
      if (c+2<COLS && board[r][c]===board[r][c+1] && board[r][c]===board[r][c+2]) {
        let e=c; while (e<COLS && board[r][e]===board[r][c]) { matched.add(r*COLS+e); e++; }
      }
      // 纵向
      if (r+2<ROWS && board[r][c]===board[r+1][c] && board[r][c]===board[r+2][c]) {
        let e=r; while (e<ROWS && board[e][c]===board[r][c]) { matched.add(e*COLS+c); e++; }
      }
    }
    return [...matched];
  }
  function removeAndCascade() {
    resolving = true;
    let matched = findMatches();
    let gained = 0, combo = 0;
    if (!matched.length) { resolving = false; return; }
    function stepM() {
      if (!matched.length) {
        // 重力 + 补新
        for (let c=0;c<COLS;c++) {
          let write = ROWS-1;
          for (let r=ROWS-1;r>=0;r--) if (!(matchedSet.has(r*COLS+c))) { board[write--][c] = board[r][c]; }
          for (let r=write;r>=0;r--) board[r][c] = Math.floor(Math.random()*cats.length);
        }
        matchedSet = null;
        render();
        const next = findMatches();
        if (next.length) { matched = next; matchedSet = new Set(next); combo++; setTimeout(stepM, 350); }
        else { resolving = false; if (score>=waveTarget) onWaveClear(); }
        return;
      }
      matchedSet = new Set(matched);
      gained += matched.length;
      combo++;
      score += matched.length * 10 * combo;
      scoreEl.textContent = score;
      comboEl.textContent = combo>=2 ? '连消 x'+combo : '';
      matched.forEach(idx => { board[Math.floor(idx/COLS)][idx%COLS] = -1; });
      matched = [];   // 清空，避免 stepM 无限循环重复加分
      playSound('success');
      setTimeout(stepM, 250);
    }
    let matchedSet = new Set(matched);
    stepM();
  }
  function swap(r1,c1,r2,c2) {
    if (resolving || ended) return;
    [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];
    if (findMatches().length) {
      moves++; movesEl.textContent = Math.max(0, waveMoves - moves);
      playSound('click');
      render();
      removeAndCascade();
      if (moves >= waveMoves && !ended && score < waveTarget) endGame(false);
    } else {
      [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];   // 换回
      playSound('error');
      render();
    }
  }
  function onWaveClear() {
    if (ended) return;
    if (wave >= WAVES) { endGame(true); return; }
    wave++; newWave();
    window.showToast('🌊 第 '+wave+' 波！目标更高', 'success');
  }
  function render() {
    gridEl.innerHTML = '';
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      const d = document.createElement('div');
      const col = board[r][c];
      d.className = 'm3-tile' + (sel && sel.r===r && sel.c===c ? ' sel' : '');
      if (col >= 0) { d.style.background = COLORS[col]; d.textContent = cats[col].emoji; }
      else { d.style.background = 'transparent'; }
      d.onclick = () => {
        if (resolving || ended) return;
        if (!sel) { sel = {r:r,c:c}; render(); return; }
        if (sel.r===r && sel.c===c) { sel=null; render(); return; }
        const dr=Math.abs(sel.r-r), dc=Math.abs(sel.c-c);
        if (dr+dc === 1) { swap(sel.r, sel.c, r, c); sel=null; }
        else { sel = {r:r,c:c}; render(); }
      };
      gridEl.appendChild(d);
    }
  }

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="m3-box">
      <div class="mm-head"><div><div class="mm-title">🍬 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="m3-stats">
        <span>🌊 第 <b id="m3Wave">1</b>/${WAVES} 波</span>
        <span>🎯 目标 <b id="m3Tgt">28</b> 分</span>
        <span>🎯 <b id="m3Score">0</b></span>
        <span>👣 步数 <b id="m3Moves">16</b></span>
        <span>🔥 <b id="m3Combo" style="color:#ff7a00"></b></span>
      </div>
      <div class="m3-grid" id="m3Grid"></div>
      <div class="m3-legend">${cats.map((c,i)=>'<span><i style="background:'+COLORS[i]+'"></i>'+escHtml(c.name)+'</span>').join('')}</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const gridEl = document.getElementById('m3Grid');
  const waveEl = document.getElementById('m3Wave'), tgtEl = document.getElementById('m3Tgt');
  const scoreEl = document.getElementById('m3Score'), movesEl = document.getElementById('m3Moves'), comboEl = document.getElementById('m3Combo');
  gridEl.style.gridTemplateColumns = 'repeat(' + COLS + ', 52px)';
  gridEl.style.gridTemplateRows = 'repeat(' + ROWS + ', 52px)';

  function endGame(isWin) {
    if (ended) return;
    ended = true;
    if (isWin) { window.recordGameWin('m3'); window.miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=window.getGameStats(); _gs.m3Best=Math.max(_gs.m3Best||0, score); _gs.m3Wins=(_gs.m3Wins||0)+(isWin?1:0); window.saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'三连清场，车间转起来了！':'步数用完')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">得分 <b style="color:var(--amber)">'+score+'</b> · 到第 '+Math.min(wave,WAVES)+'/'+WAVES+' 波</div>'+
        '<div style="display:flex;gap:10px;justify-window.content:center;margin-top:16px"><button class="mm-btn" onclick="window.m3Again()">🔁 再来一局</button><button class="mm-btn primary" onclick="window.m3Done()">收下奖励</button></div>';
      window.focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.m3Again = () => { overlay.remove(); openMatch3(cfg, onComplete); };
  window.m3Done = () => { overlay.remove(); window.playAreaMusic(); if (onComplete) onComplete(ended && score>=waveTarget); };
  function closeGame(manual) {
    if (ended) return;
    ended = true;
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); window.playAreaMusic(); }
  }
  newWave();
}
