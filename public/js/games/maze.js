// ═══════════════════════════════════════════════════════════════════
// games/maze — 拆自 app.js（openMaze）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openMaze(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('maze')) {
    window.showGameTutorial('maze', '🌐 数据迷宫·包到彼岸', [
      '你是一个<b>数据包</b>，用 <b>←/→/↑/↓</b>（手机<b>滑动</b>）在车间迷宫里找到 <b>服务器</b>',
      '金色格子是<b>协议门</b>——踩上去要<b>答对题</b>才能开门通过',
      '撞墙或答错 <b>-1 命</b>；找到服务器即过关'
    ], function(){ openMaze(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('maze') || 'match');
  const COLS = cfg.cols || 11, ROWS = cfg.rows || 11;
  const pairs = (cfg.pairs || []).filter(p=>p && p.term && p.hint);
  if (!pairs.length) { window.showToast('没有知识门题库', 'error'); return; }
  const TIME = cfg.timeLimit || 90;
  let lives = cfg._hard ? 2 : 3, timeLeft = TIME, ended = false, moves = 0, resultWin = false;
  let grid = [], px = 1, py = 1, sx = COLS-2, sy = ROWS-2;
  let gateQ = null, timer = 0;

  function genMaze() {
    // 递归回溯生成「完美迷宫」：路径唯一、无死胡同死局，比随机墙更好玩
    grid = [];
    for (let r=0;r<ROWS;r++){ grid[r]=[]; for (let c=0;c<COLS;c++) grid[r][c]=1; }
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    const stack=[[px,py]]; grid[py][px]=0;
    while (stack.length) {
      const [x,y]=stack[stack.length-1];
      const opts=[];
      dirs.forEach(d=>{
        const nx=x+d[0]*2, ny=y+d[1]*2;
        if (nx<1||ny<1||nx>=COLS-1||ny>=ROWS-1) return;
        if (grid[ny][nx]===1) opts.push(d);
      });
      if (!opts.length){ stack.pop(); continue; }
      const d=opts[Math.floor(Math.random()*opts.length)];
      const nx=x+d[0]*2, ny=y+d[1]*2;
      grid[y+d[1]][x+d[0]]=0; grid[ny][nx]=0;
      stack.push([nx,ny]);
    }
    grid[sy][sx]=0; grid[py][px]=0;
    // 布知识门（挑 6 个非起终点的空地，放在通道上）
    const empties=[];
    for (let r=1;r<ROWS-1;r++) for (let c=1;c<COLS-1;c++) if (grid[r][c]===0 && !(r===py&&c===px) && !(r===sy&&c===sx)) empties.push([r,c]);
    for (let i=empties.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [empties[i],empties[j]]=[empties[j],empties[i]]; }
    empties.slice(0,6).forEach(function(p){ grid[p[1]][p[0]]=2; });
  }
  function move(dx,dy) {
    if (ended || gateQ) return;
    const nx=px+dx, ny=py+dy;
    if (nx<0||ny<0||nx>=COLS||ny>=ROWS) { playSound('error'); return; }
    if (grid[ny][nx]===1) { lives--; livesEl.textContent=lives; window.shakeScreen(); playSound('error'); if (lives<=0) endGame(false); return; }
    moves++;
    px=nx; py=ny;
    if (grid[py][px]===2) { askGate(py,px); }
    render();
    if (px===sx && py===sy) { endGame(true); }
  }
  function askGate(r,c) {
    gateQ = true;
    const q = pairs[Math.floor(Math.random()*pairs.length)];
    const opts = [q.hint].concat(pairs.filter(p=>p.term!==q.term).map(p=>p.hint).slice(0,3));
    for (let i=opts.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [opts[i],opts[j]]=[opts[j],opts[i]]; }
    const ov=document.createElement('div');
    ov.className='mm-overlay'; ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9700;display:flex;align-items:center;justify-content:center';
    ov.innerHTML='<div class="mm-box" style="width:min(460px,92vw)"><div class="mm-head"><div><div class="mm-title">🚪 协议门</div><div class="mm-sub">答对才能通过这个门</div></div></div><div class="pd-body"><div style="font-size:16px;font-weight:bold;color:var(--amber);margin-bottom:10px">「'+escHtml(q.term)+'」是什么？</div><div style="display:flex;flex-direction:column;gap:8px" id="mzOpts"></div></div></div>';
    document.body.appendChild(ov);
    const box=ov.querySelector('#mzOpts');
    opts.forEach(h => {
      const b=document.createElement('button'); b.className='mm-btn'; b.style.cssText='text-align:left;white-space:normal;height:auto;line-height:1.4;padding:10px 14px';
      b.textContent=h;
      b.onclick=()=>{ ov.remove(); gateQ=false;
        if (h===q.hint) { grid[r][c]=0; playSound('success'); window.showToast('✅ 门开了！','success'); }
        else { lives--; livesEl.textContent=lives; playSound('error'); if (lives<=0) endGame(false); }
        render();
      };
      box.appendChild(b);
    });
  }
  function render() {
    gridEl.innerHTML='';
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      const d=document.createElement('div');
      d.className='mz-cell' + (grid[r][c]===1?' mz-wall':grid[r][c]===2?' mz-gate':' mz-open');
      if (r===py&&c===px) { d.classList.add('mz-player'); d.textContent='📦'; }
      else if (r===sy&&c===sx) { d.classList.add('mz-srv'); d.textContent='🖥️'; }
      gridEl.appendChild(d);
    }
  }

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="mz-box">
      <div class="mm-head"><div><div class="mm-title">🌐 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="mz-stats"><span>❤️ <b id="mzLives">${lives}</b></span><span>👣 <b id="mzMoves">0</b></span><span>⏱ <b id="mzTime">${TIME}</b>s</span><span>🎯 找 🖥️ 服务器</span></div>
      <div class="mz-grid" id="mzGrid" style="--mzc:${COLS};grid-template-columns:repeat(${COLS},1fr)"></div>
      <div class="mz-tip">←/→/↑/↓ 或滑动移动 · 金色=协议门(答题通过) · 撞墙扣命</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const gridEl = document.getElementById('mzGrid'), livesEl = document.getElementById('mzLives');
  const movesEl = document.getElementById('mzMoves'), timeEl = document.getElementById('mzTime');
  function _k(e){
    if (ended) return;
    if (e.key==='ArrowUp'){ move(0,-1); e.preventDefault(); }
    else if (e.key==='ArrowDown'){ move(0,1); e.preventDefault(); }
    else if (e.key==='ArrowLeft'){ move(-1,0); e.preventDefault(); }
    else if (e.key==='ArrowRight'){ move(1,0); e.preventDefault(); }
    else if (e.key==='Escape') closeGame(false);
  }
  document.addEventListener('keydown', _k);
  let sw=null;
  gridEl.addEventListener('pointerdown', e=>{ sw={x:e.clientX,y:e.clientY}; });
  gridEl.addEventListener('pointermove', e=>{
    if (!sw) return; const dx=e.clientX-sw.x, dy=e.clientY-sw.y;
    if (Math.abs(dx)<16&&Math.abs(dy)<16) return;
    if (Math.abs(dx)>Math.abs(dy)) move(dx>0?1:-1,0); else move(0,dy>0?1:-1);
    sw=null;
  });
  gridEl.addEventListener('pointerup', e=>{ sw=null; });
  gridEl.addEventListener('pointercancel', e=>{ sw=null; });
  timer = setInterval(()=>{ if(!ended){ timeLeft--; timeEl.textContent=Math.max(0,timeLeft); if(timeLeft<=0) endGame(false); } },1000);

  function endGame(isWin) {
    if (ended) return;
    ended = true; resultWin = isWin;
    clearInterval(timer); document.removeEventListener('keydown', _k);
    if (isWin) { window.recordGameWin('maze'); window.miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=window.getGameStats(); _gs.mazeBest=Math.max(_gs.mazeBest||0, moves); _gs.mazeWins=(_gs.mazeWins||0)+(isWin?1:0); window.saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'数据包送达服务器！':'数据包丢了')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">步数 <b style="color:var(--amber)">'+moves+'</b> · 剩余 ❤️ '+Math.max(0,lives)+'</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.mzAgain()">🔁 再送一程</button><button class="mm-btn primary" onclick="window.mzDone()">收下奖励</button></div>';
      window.focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.mzAgain = () => { overlay.remove(); openMaze(cfg, onComplete); };
  window.mzDone = () => { overlay.remove(); window.playAreaMusic(); if (onComplete) onComplete(resultWin); };
  function closeGame(manual) {
    if (ended) return;
    ended = true; clearInterval(timer); document.removeEventListener('keydown', _k);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); window.playAreaMusic(); }
  }
  genMaze(); render();
  render();
}
