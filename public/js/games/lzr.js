// ═══════════════════════════════════════════════════════════════════
// games/lzr — 拆自 app.js（openLaser）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openLaser(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('lzr')) {
    window.showGameTutorial('lzr', '🔦 激光反射·数据路由', [
      '<b>点击空格放镜子</b>（再点切 /、\ ），把数据光束从 💡 反射到 📡',
      '点镜子可循环：空 → / → \ → 空',
      '光束到达目标即过关'
    ], function(){ openLaser(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('lzr') || 'match');
  const COLS = cfg.cols || 7, ROWS = cfg.rows || 7;
  const src = { x:0, y:Math.floor(ROWS/2) }, dst = { x:COLS-1, y:0 };
  let mirrors = {}, moves = 0, ended = false, resultWin = false;

  function reflect(dir, m) {
    if (m==='/') { if (dir[0]===1) return [0,-1]; if (dir[0]===-1) return [0,1]; if (dir[1]===-1) return [1,0]; return [-1,0]; }
    else { if (dir[0]===1) return [0,1]; if (dir[0]===-1) return [0,-1]; if (dir[1]===-1) return [-1,0]; return [1,0]; }
  }
  function trace() {
    let x=src.x, y=src.y, dir=[1,0]; const seen=new Set(); const path=[[x,y]];
    while (true) {
      x+=dir[0]; y+=dir[1];
      if (x<0||y<0||x>=COLS||y>=ROWS) break;
      if (x===dst.x && y===dst.y) { path.push([x,y]); return {win:true, path}; }
      const k=x+','+y;
      if (seen.has(k)) break;
      seen.add(k); path.push([x,y]);
      if (mirrors[k]) dir = reflect(dir, mirrors[k]);
    }
    return {win:false, path};
  }
  function render() {
    const tr = trace();
    gridEl.innerHTML='';
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      const d=document.createElement('div');
      d.className='lzr-cell'; const k=c+','+r;
      if (mirrors[k]) { d.classList.add('mir'); d.textContent=mirrors[k]; }
      if (tr.path.some(p=>p[0]===c&&p[1]===r)) d.classList.add('beam');
      if (c===src.x&&r===src.y){ d.textContent='💡'; }
      if (c===dst.x&&r===dst.y){ d.textContent='📡'; }
      d.onclick=()=>cycleMirror(k);
      gridEl.appendChild(d);
    }
    movesEl.textContent = moves;
    return tr.win;
  }
  function cycleMirror(k) {
    if (ended) return;
    moves++;
    const cur=mirrors[k];
    if (!cur) mirrors[k]='/';
    else if (cur==='/') mirrors[k]='\\';
    else delete mirrors[k];
    playSound('click');
    const win = render();
    if (win) endGame(true);
  }

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="lzr-box">
      <div class="mm-head"><div><div class="mm-title">🔦 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="lzr-stats"><span>👣 镜子 <b id="lzrMoves">0</b></span><span>🎯 让 💡 → 📡 连通</span></div>
      <div class="lzr-grid" id="lzrGrid" style="grid-template-columns:repeat(${COLS},42px)"></div>
      <div class="lzr-tip">点空格放 / 或 \ 镜子，把数据光束反射到 📡</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const gridEl = document.getElementById('lzrGrid'), movesEl = document.getElementById('lzrMoves');

  function endGame(isWin) {
    if (ended) return;
    ended = true; resultWin = isWin;
    if (isWin) { window.recordGameWin('lzr'); window.miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=window.getGameStats(); _gs.lzrBest=Math.max(_gs.lzrBest||0, moves); _gs.lzrWins=(_gs.lzrWins||0)+(isWin?1:0); window.saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'数据光束连通目标！':'还没连通')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">用了 <b style="color:var(--amber)">'+moves+'</b> 面镜子</div>'+
        '<div style="display:flex;gap:10px;justify-window.content:center;margin-top:16px"><button class="mm-btn" onclick="window.lzrAgain()">🔁 再布一局</button><button class="mm-btn primary" onclick="window.lzrDone()">收下奖励</button></div>';
      window.focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.lzrAgain = () => { overlay.remove(); openLaser(cfg, onComplete); };
  window.lzrDone = () => { overlay.remove(); window.playAreaMusic(); if (onComplete) onComplete(resultWin); };
  function closeGame(manual) {
    if (ended) return;
    ended = true;
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); window.playAreaMusic(); }
  }
  render();
}
