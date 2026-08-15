// ═══════════════════════════════════════════════════════════════════
// games/ll — 拆自 app.js（openLianLian）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openLianLian(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('ll')) {
    window.showGameTutorial('ll', '🔗 连连看·对对碰', [
      '点一个<b>术语</b>，再点它的<b>解释</b>——若两者能用<b>不超过 2 个拐弯</b>的空路径连通，就消除',
      '路径只能走空白格；<b>全部消除</b>即过关',
      '卡住了点「重新洗牌」'
    ], function(){ openLianLian(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('ll') || 'match');
  const pairs = (cfg.pairs || []).slice(0, cfg.size || (cfg.pairs||[]).length);
  if (!pairs.length) { window.showToast('没有可配对的术语', 'error'); return; }
  const N = 2 * pairs.length;
  let cols = Math.ceil(Math.sqrt(N));
  while (cols > 2 && N % cols !== 0) cols--;
  const rows = N / cols;
  const TIME = cfg.timeLimit || 150;
  const R = rows + 2, C = cols + 2;
  let cells = Array.from({length: R}, () => Array(C).fill(null));
  let score = 0, cleared = 0, timeLeft = TIME, ended = false;
  let sel = null, timer = 0, resultWin = false;

  // 生成并打乱
  const tiles = [];
  pairs.forEach((p, i) => { tiles.push({ pair: i, text: p.term, kind:'t' }); tiles.push({ pair: i, text: p.hint, kind:'d' }); });
  for (let i = tiles.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [tiles[i],tiles[j]]=[tiles[j],tiles[i]]; }
  let k = 0;
  for (let r = 1; r <= rows; r++) for (let c = 1; c <= cols; c++) cells[r][c] = tiles[k++];

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="ll-box">
      <div class="mm-head"><div><div class="mm-title">🔗 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="ll-stats">
        <span>⏱ <b id="llTime">${TIME}</b>s</span>
        <span>✅ <b id="llDone">0</b>/${pairs.length}</span>
        <span>🎯 <b id="llScore">0</b></span>
        <button class="ll-btn" id="llShuffle">🔀 洗牌</button>
      </div>
      <div class="ll-grid" id="llGrid"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const gridEl = document.getElementById('llGrid'), timeEl = document.getElementById('llTime');
  const doneEl = document.getElementById('llDone'), scoreEl = document.getElementById('llScore');
  gridEl.style.gridTemplateColumns = 'repeat(' + cols + ', 74px)';
  gridEl.style.gridTemplateRows = 'repeat(' + rows + ', 54px)';
  document.getElementById('llShuffle').onclick = shuffleRemaining;
  // 保证初始盘面至少有一对可消除（否则重排）
  for (let t=0;t<30;t++) { if (findAnyPair()) break; shuffleRemaining(); }

  function passable(r, c) { return r < 0 || r >= R || c < 0 || c >= C || cells[r][c] === null; }
  // 连通判定：允许走外圈空环，最多 2 个拐弯（经典连连看规则）
  function canConnect(a, b) {
    if (a.pair !== b.pair) return false;
    if (a.r===b.r && a.c===b.c) return false;
    const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
    const stack = [], seen = {};
    for (let d=0;d<4;d++){ const key=a.r+','+a.c+','+d+',0'; if(!seen[key]){ seen[key]=1; stack.push({r:a.r,c:a.c,d:d,t:0}); } }
    while (stack.length) {
      const cur = stack.pop();
      const dr=dirs[cur.d][0], dc=dirs[cur.d][1];
      let nr=cur.r+dr, nc=cur.c+dc;
      while (true) {
        if (nr===b.r && nc===b.c) return true;
        if (nr < -1 || nr > R || nc < -1 || nc > C) break;           // 外圈只到 1 格，再远无意义
        const inB = nr>=0 && nr<R && nc>=0 && nc<C;
        if (inB && cells[nr][nc]!==null) break;                       // 被其它牌挡住
        if (cur.t < 2) {
          for (let nd=0;nd<4;nd++){
            if (nd===cur.d) continue;
            const key=nr+','+nc+','+nd+','+(cur.t+1);
            if(!seen[key]){ seen[key]=1; stack.push({r:nr,c:nc,d:nd,t:cur.t+1}); }
          }
        }
        nr+=dr; nc+=dc;
      }
    }
    return false;
  }
  // 找一对当前可消除的牌（用于保证盘面始终有解）
  function findAnyPair() {
    const pos=[];
    for (let r=1;r<=rows;r++) for (let c=1;c<=cols;c++) if (cells[r][c]) pos.push({r:r,c:c,pair:cells[r][c].pair});
    for (let i=0;i<pos.length;i++) for (let j=i+1;j<pos.length;j++) {
      if (pos[i].pair===pos[j].pair && canConnect(pos[i],pos[j])) return [pos[i],pos[j]];
    }
    return null;
  }
  function ensureSolvable() {   // 若无解则洗牌，最多尝试 30 次
    for (let t=0;t<30 && !findAnyPair();t++) shuffleRemaining();
  }
  function render() {
    gridEl.innerHTML = '';
    for (let r=1;r<=rows;r++) for (let c=1;c<=cols;c++) {
      const cell = cells[r][c];
      if (!cell) { gridEl.appendChild(document.createElement('div')); continue; }
      const div = document.createElement('div');
      div.className = 'll-tile' + (sel && sel.pair===cell.pair && sel.r===r && sel.c===c ? ' sel' : '');
      div.dataset.r = r; div.dataset.c = c;
      div.textContent = cell.text;
      div.title = cell.text;   // 悬停查看完整文字
      const _len = cell.text.length;   // 长文字自适应字号
      div.style.fontSize = (_len > 12 ? 10 : _len > 7 ? 11 : _len > 5 ? 12 : 13) + 'px';
      div.onclick = () => pick(r, c, div);
      gridEl.appendChild(div);
    }
  }
  function pick(r, c, div) {
    if (ended) return;
    const cell = cells[r][c];
    if (!cell) return;
    if (!sel) { sel = {r:r,c:c,pair:cell.pair}; render(); playSound('click'); return; }
    if (sel.r===r && sel.c===c) { sel=null; render(); return; }
    if (sel.pair === cell.pair) {
      if (canConnect(sel, {r:r,c:c})) {
        cleared++; doneEl.textContent = cleared;
        score += 50 + Math.max(0, timeLeft) ;
        scoreEl.textContent = score;
        // —— 消除特效：连线闪光 + 粒子 + 加分飘字 ——
        try {
          const gb = gridEl.getBoundingClientRect();
          const t1 = gridEl.children[(sel.r-1)*cols+(sel.c-1)], t2 = gridEl.children[(r-1)*cols+(c-1)];
          const b1 = t1.getBoundingClientRect(), b2 = t2.getBoundingClientRect();
          const x1 = b1.left+b1.width/2-gb.left, y1 = b1.top+b1.height/2-gb.top;
          const x2 = b2.left+b2.width/2-gb.left, y2 = b2.top+b2.height/2-gb.top;
          // 连线
          const line = document.createElement('div');
          line.className = 'll-line';
          const lx=(x1+x2)/2, ly=(y1+y2)/2, len=Math.hypot(x2-x1,y2-y1), ang=Math.atan2(y2-y1,x2-x1);
          line.style.cssText = 'left:'+lx+'px;top:'+ly+'px;width:'+len+'px;transform:rotate('+ang+'rad)';
          gridEl.appendChild(line);
          setTimeout(()=>{ try{line.remove();}catch(e){} }, 500);
          // 粒子（两端各 8 个）
          [[x1,y1],[x2,y2]].forEach(function(pt){
            for(let k=0;k<8;k++){
              const p2=document.createElement('span');
              p2.className='mm-burst';
              p2.style.cssText='left:'+pt[0]+'px;top:'+pt[1]+'px;--mx:'+((Math.random()*100-50))+'px;--my:'+((Math.random()*-90-10))+'px;background:'+['#00e676','#ffd700','#7ee8fa','#b388ff'][k%4];
              gridEl.appendChild(p2);
              setTimeout(()=>{ try{p2.remove();}catch(e){} }, 550);
            }
          });
          // 加分飘字
          const fl=document.createElement('div');
          fl.className='ll-float';
          fl.textContent = '+'+(50 + Math.max(0, timeLeft));
          fl.style.cssText='left:'+((x1+x2)/2)+'px;top:'+((y1+y2)/2-20)+'px';
          gridEl.appendChild(fl);
          setTimeout(()=>{ try{fl.remove();}catch(e){} }, 800);
        } catch(e){}
        cells[sel.r][sel.c] = null; cells[r][c] = null;
        sel = null; playSound('success');
        render();
        if (cleared >= pairs.length) { endGame(true); return; }
        if (!findAnyPair()) { shuffleRemaining(); window.showToast('🔀 无路可走，已自动洗牌', 'info'); }
      } else {
        sel = null; render(); playSound('error'); window.shakeScreen();
        if (!findAnyPair()) { shuffleRemaining(); window.showToast('🔀 无路可走，已自动洗牌', 'info'); }
      }
    } else {
      sel = null; render(); playSound('click');
    }
  }
  function shuffleRemaining() {
    const rest = [];
    for (let r=1;r<=rows;r++) for (let c=1;c<=cols;c++) if (cells[r][c]) { rest.push(cells[r][c]); cells[r][c]=null; }
    for (let i=rest.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [rest[i],rest[j]]=[rest[j],rest[i]]; }
    let k=0;
    for (let r=1;r<=rows;r++) for (let c=1;c<=cols;c++) if (!cells[r][c] && k<rest.length) cells[r][c] = rest[k++];
    render(); playSound('click');
  }
  function tick() {
    if (ended) return;
    timeLeft -= 1; timeEl.textContent = Math.max(0, timeLeft);
    if (timeLeft <= 0) { endGame(false); return; }
  }
  timer = setInterval(tick, 1000);

  function endGame(isWin) {
    if (ended) return;
    ended = true; clearInterval(timer);
    resultWin = isWin;
    if (isWin) { window.recordGameWin('ll'); window.miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=window.getGameStats(); _gs.llBest=Math.max(_gs.llBest||0, score); _gs.llWins=(_gs.llWins||0)+ (isWin?1:0); window.saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'⏰')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'全部配对消除！':'时间到')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">得分 <b style="color:var(--amber)">'+score+'</b> · 配对 '+cleared+'/'+pairs.length+' 对</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.llAgain()">🔁 再来一局</button><button class="mm-btn primary" onclick="window.llDone()">收下奖励</button></div>';
      window.focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.llAgain = () => { overlay.remove(); openLianLian(cfg, onComplete); };
  window.llDone = () => { overlay.remove(); window.playAreaMusic(); if (onComplete) onComplete(resultWin); };
  function closeGame(manual) {
    if (ended) return;
    ended = true; clearInterval(timer);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); window.playAreaMusic(); }
  }
  render();
}
