// ═══════════════════════════════════════════════════════════════════
// games/pipe — 拆自 app.js（openPipe）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openPipe(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('pipe')) {
    window.showGameTutorial('pipe', '🔧 管道工·数据通路', [
      '每根管道都要<b>接通邻居</b>：开口朝邻居，邻居也得朝它开口',
      '<b>点击管道旋转</b>，让整张图每条管道都严丝合缝、没有断头',
      '全部接通即过关——数据就能从发布端流到 Broker 再到订阅端'
    ], function(){ openPipe(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('pipe') || 'match');
  const COLS = cfg.cols || 4, ROWS = cfg.rows || 4;
  // 开口表：u/r/d/l 各边是否有开口
  function opens(shape, rot) {
    if (shape === 0) return rot === 0 ? {l:1,r:1,u:0,d:0} : {l:0,r:0,u:1,d:1};   // 直管
    return [{u:1,r:1,d:0,l:0},{u:0,r:1,d:1,l:0},{u:0,r:0,d:1,l:1},{u:1,r:0,d:0,l:1}][rot]; // 弯管
  }
  // 贪心生成一致解
  const shapes = Array.from({length:ROWS},()=>Array(COLS).fill(0));
  const target = Array.from({length:ROWS},()=>Array(COLS).fill(0));
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    const needL = c>0 && opens(shapes[r][c-1], target[r][c-1]).r === 1;
    const needU = r>0 && opens(shapes[r-1][c], target[r-1][c]).d === 1;
    // 需求 L、U 都有或都没有 → 弯管；只有一个 → 直管（保证内部开口一致）
    if (needL === needU) { shapes[r][c] = 1; target[r][c] = needL ? 3 : 1; }
    else { shapes[r][c] = 0; target[r][c] = needL ? 0 : 1; }
  }
  // 初始错位
  const cur = Array.from({length:ROWS},()=>Array(COLS).fill(0));
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) cur[r][c] = Math.floor(Math.random() * (shapes[r][c]===0?2:4));
  let moves = 0, ended = false;

  function checkConsistent() {
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      const o = opens(shapes[r][c], cur[r][c]);
      // 边界开口视为端点（数据从边缘进出），只校验内部邻居
      if (o.u && r>0 && !opens(shapes[r-1][c],cur[r-1][c]).d) return false;
      if (!o.u && r>0 && opens(shapes[r-1][c],cur[r-1][c]).d) return false;
      if (o.d && r<ROWS-1 && !opens(shapes[r+1][c],cur[r+1][c]).u) return false;
      if (!o.d && r<ROWS-1 && opens(shapes[r+1][c],cur[r+1][c]).u) return false;
      if (o.l && c>0 && !opens(shapes[r][c-1],cur[r][c-1]).r) return false;
      if (!o.l && c>0 && opens(shapes[r][c-1],cur[r][c-1]).r) return false;
      if (o.r && c<COLS-1 && !opens(shapes[r][c+1],cur[r][c+1]).l) return false;
      if (!o.r && c<COLS-1 && opens(shapes[r][c+1],cur[r][c+1]).l) return false;
    }
    return true;
  }
  function svgOf(shape, rot) {
    const o = opens(shape, rot); let p = '';
    if (o.l) p += '<line x1="2" y1="30" x2="30" y2="30"/>';
    if (o.r) p += '<line x1="30" y1="30" x2="58" y2="30"/>';
    if (o.u) p += '<line x1="30" y1="2" x2="30" y2="30"/>';
    if (o.d) p += '<line x1="30" y1="30" x2="30" y2="58"/>';
    p += '<circle cx="30" cy="30" r="9"/>';
    return '<svg viewBox="0 0 60 60" fill="#7ee8fa">' + p + '</svg>';
  }
  function render() {
    const grid = document.getElementById('pipeGrid');
    grid.innerHTML = '';
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      const d = document.createElement('div');
      d.className = 'pipe-tile';
      d.innerHTML = svgOf(shapes[r][c], cur[r][c]);
      d.onclick = () => {
        if (ended) return;
        moves++;
        const maxRot = shapes[r][c]===0?2:4;
        cur[r][c] = (cur[r][c]+1)%maxRot;
        d.innerHTML = svgOf(shapes[r][c], cur[r][c]);
        playSound('click');
        if (checkConsistent()) { endGame(true); return; }
        // 标记明显断头
        const o = opens(shapes[r][c], cur[r][c]);
        const bad = (o.u && (r===0 || !opens(shapes[r-1][c],cur[r-1][c]).d)) || (o.d && (r===ROWS-1 || !opens(shapes[r+1][c],cur[r+1][c]).u));
        d.classList.toggle('wrong', !!bad);
      };
      grid.appendChild(d);
    }
  }

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="pipe-box">
      <div class="mm-head"><div><div class="mm-title">🔧 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="pipe-stats">
        <span>👣 旋转 <b id="pipeMoves">0</b> 次</span>
        <span>⏱ <b id="pipeTime">0</b>s</span>
      </div>
      <div style="text-align:center;font-size:12px;color:var(--dim)">发布端 → 🧩 数据通路 → Broker → 仪表盘</div>
      <div class="pipe-grid" id="pipeGrid"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const movesEl = document.getElementById('pipeMoves'), timeEl = document.getElementById('pipeTime');
  const gridEl = document.getElementById('pipeGrid');
  gridEl.style.gridTemplateColumns = 'repeat(' + COLS + ', 60px)';
  gridEl.style.gridTemplateRows = 'repeat(' + ROWS + ', 60px)';
  let elapsed = 0;
  const timer = setInterval(() => { if (!ended) { elapsed++; timeEl.textContent = elapsed; } }, 1000);

  function endGame(isWin) {
    if (ended) return;
    ended = true; clearInterval(timer);
    if (isWin) { window.recordGameWin('pipe'); window.miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=window.getGameStats(); _gs.pipeBest=Math.max(_gs.pipeBest||0, 2000 - moves*20 - elapsed*5); _gs.pipeWins=(_gs.pipeWins||0)+(isWin?1:0); window.saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'⏰')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'数据通路全部接通！':'还没接完')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">旋转 <b style="color:var(--amber)">'+moves+'</b> 次 · 用时 <b style="color:var(--amber)">'+elapsed+'</b>s</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.piAgain()">🔁 再接一程</button><button class="mm-btn primary" onclick="window.piDone()">收下奖励</button></div>';
      window.focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.piAgain = () => { overlay.remove(); openPipe(cfg, onComplete); };
  window.piDone = () => { overlay.remove(); window.playAreaMusic(); if (onComplete) onComplete(ended && checkConsistent()); };
  function closeGame(manual) {
    if (ended) return;
    ended = true; clearInterval(timer);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); window.playAreaMusic(); }
  }
  render();
}
