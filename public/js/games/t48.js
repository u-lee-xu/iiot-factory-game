// ═══════════════════════════════════════════════════════════════════
// games/t48 — 拆自 app.js（openTile2048）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openTile2048(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('t48')) {
    window.showGameTutorial('t48', '🔢 2048·数据融合', [
      '<b>←/→/↑/↓</b>（手机<b>滑动</b>）让整排数据滑动，<b>相同单位相撞就合成更大的</b>',
      'bit→Byte→KB→MB→GB→TB，<b>合成出目标单位即过关</b>',
      '每次滑动会生成新的小数据，铺满且无相邻相同就失败'
    ], function(){ openTile2048(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('t48') || 'match');
  const units = (cfg.units || ['bit','Byte','KB','MB','GB','TB']).map(String);
  const TARGET = cfg.target || 'TB';
  const TARGET_LV = units.indexOf(TARGET);
  const COLS = cfg.cols || 4, ROWS = cfg.rows || 4;
  let grid = Array.from({length:ROWS},()=>Array(COLS).fill(-1));
  let score = 0, moves = 0, ended = false, resultWin = false;

  function spawn() {
    const empty = [];
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) if (grid[r][c]<0) empty.push([r,c]);
    if (!empty.length) return;
    const [r,c] = empty[Math.floor(Math.random()*empty.length)];
    grid[r][c] = Math.random() < 0.8 ? 0 : 1;   // 多半是 bit，偶尔 Byte
  }
  function slideLine(line) {   // 返回 {new, moved, gained}
    const arr = line.filter(v => v>=0);
    let gained = 0, changed = false;
    const out = [];
    for (let i=0;i<arr.length;i++) {
      if (i+1 < arr.length && arr[i]===arr[i+1]) {
        out.push(arr[i]+1); gained += (arr[i]+1); i++;
        if (arr[i] >= TARGET_LV) { /* 达标 */ }
      } else out.push(arr[i]);
    }
    while (out.length < line.length) out.push(-1);
    for (let i=0;i<line.length;i++) if (out[i] !== line[i]) changed = true;
    return { out, moved: changed, gained };
  }
  function slide(dir) {
    let moved = false, gained = 0;
    for (let i=0;i<COLS;i++) {
      const line = [];
      for (let j=0;j<ROWS;j++) line.push(dir===0 || dir===1 ? grid[j][i] : grid[i][j]);
      const rev = (dir===1 || dir===3);   // 下/右：从尾部合并
      const src = rev ? line.slice().reverse() : line;
      const res = slideLine(src);
      const out = rev ? res.out.slice().reverse() : res.out;
      for (let j=0;j<ROWS;j++) { if (dir===0 || dir===1) grid[j][i]=out[j]; else grid[i][j]=out[j]; }
      if (res.moved) moved = true;
      gained += res.gained;
    }
    if (moved) { score += gained*10; moves++; spawn(); render(); checkEnd(); }
    return moved;
  }
  function checkEnd() {
    // 达标
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) if (grid[r][c] >= TARGET_LV) { endGame(true); return; }
    // 无空位且无相邻相同 → 失败
    let empty = false, mergeable = false;
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      if (grid[r][c]<0) { empty=true; continue; }
      if (r+1<ROWS && grid[r][c]===grid[r+1][c]) mergeable=true;
      if (c+1<COLS && grid[r][c]===grid[r][c+1]) mergeable=true;
    }
    if (!empty && !mergeable) endGame(false);
  }
  function render() {
    gridEl.innerHTML='';
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      const d=document.createElement('div');
      d.className='t48-cell' + (grid[r][c]>=0 ? ' t48-'+Math.min(grid[r][c],7) : '');
      d.textContent = grid[r][c]>=0 ? units[Math.min(grid[r][c], units.length-1)] : '';
      gridEl.appendChild(d);
    }
    scoreEl.textContent = score; movesEl.textContent = moves;
  }

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="t48-box">
      <div class="mm-head"><div><div class="mm-title">🔢 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="t48-stats"><span>🎯 目标 <b>${escHtml(TARGET)}</b></span><span>🎯 <b id="t48Score">0</b></span><span>👣 <b id="t48Moves">0</b></span></div>
      <div class="t48-grid" id="t48Grid" style="grid-template-columns:repeat(${COLS},70px);grid-template-rows:repeat(${ROWS},70px)"></div>
      <div class="t48-tip">←/→/↑/↓ 或滑动 · ${units.join(' → ')}</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const gridEl = document.getElementById('t48Grid'), scoreEl = document.getElementById('t48Score'), movesEl = document.getElementById('t48Moves');
  // 键盘
  function _k(e){
    if (ended) return;
    if (e.key==='ArrowLeft'){ slide(2); e.preventDefault(); }
    else if (e.key==='ArrowRight'){ slide(3); e.preventDefault(); }
    else if (e.key==='ArrowUp'){ slide(0); e.preventDefault(); }
    else if (e.key==='ArrowDown'){ slide(1); e.preventDefault(); }
    else if (e.key==='Escape') closeGame(false);
  }
  document.addEventListener('keydown', _k);
  // 滑动（pointermove 立即判定，快速滑动也不会丢）
  let st=null;
  gridEl.addEventListener('pointerdown', e=>{ st={x:e.clientX,y:e.clientY}; });
  gridEl.addEventListener('pointermove', e=>{
    if (!st) return; const dx=e.clientX-st.x, dy=e.clientY-st.y;
    if (Math.abs(dx)<20 && Math.abs(dy)<20) return;
    if (Math.abs(dx)>Math.abs(dy)) slide(dx>0?3:2); else slide(dy>0?1:0);
    st=null;
  });
  gridEl.addEventListener('pointerup', e=>{ st=null; });
  gridEl.addEventListener('pointercancel', e=>{ st=null; });

  function endGame(isWin) {
    if (ended) return;
    ended = true;
    resultWin = isWin;
    document.removeEventListener('keydown', _k);
    if (isWin) { window.recordGameWin('t48'); window.miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=window.getGameStats(); _gs.t48Best=Math.max(_gs.t48Best||0, score); _gs.t48Wins=(_gs.t48Wins||0)+(isWin?1:0); window.saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'合成出 '+escHtml(TARGET)+'！':'格子满了')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">得分 <b style="color:var(--amber)">'+score+'</b> · 步数 <b style="color:var(--amber)">'+moves+'</b></div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.t48Again()">🔁 再来一局</button><button class="mm-btn primary" onclick="window.t48Done()">收下奖励</button></div>';
      window.focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.t48Again = () => { overlay.remove(); openTile2048(cfg, onComplete); };
  window.t48Done = () => { overlay.remove(); window.playAreaMusic(); if (onComplete) onComplete(resultWin); };
  function closeGame(manual) {
    if (ended) return;
    ended = true;
    document.removeEventListener('keydown', _k);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); window.playAreaMusic(); }
  }
  spawn(); spawn(); render();
}
