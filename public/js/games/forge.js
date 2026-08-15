// ═══════════════════════════════════════════════════════════════════
// games/forge — 拆自 app.js（openForge）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openForge(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('forge')) {
    window.showGameTutorial('forge', '🔥 数据熔炉', [
      '从顶部<b>落下一个数据单元</b>（bit→Byte→KB→MB→GB…），同类相撞就<b>合成更大的</b>',
      '目标：合成出 <b>'+escHtml(cfg.target||'TB')+'</b> 即过关；堆到顶部溢出就失败',
      '<b>连续合成</b>有连击加分，合出越高档分数越多'
    ], function(){ openForge(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('forge') || 'match');
  const units = (cfg.units || ['bit','Byte','KB','MB','GB','TB','PB']).map((u,i)=>({ name: String(u), lv: i }));
  const TARGET_LV = units.length - 1;
  const DROPS = cfg.drops || 22;
  const W = 500, H = 620;
  const G = 1300, DAMP = 0.999, REST = 0.3;
  const colors = ['#8e9bb5','#7ee8fa','#4dd0e1','#66bb6a','#ffb300','#ff7043','#ec407a'];

  let score = 0, combo = 0, drops = 0, ended = false, win = false;
  let balls = [], raf = 0, last = 0, hoverX = W/2, holding = true;
  let dropLv = 0;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="fg-box">
      <div class="mm-head"><div><div class="mm-title">🔥 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="fg-stats">
        <span>🎯 目标 <b id="fgTarget">${escHtml(cfg.target||units[TARGET_LV].name)}</b></span>
        <span>⏳ 投放 <b id="fgDrops">0</b>/${DROPS}</span>
        <span>🎯 <b id="fgScore">0</b></span>
        <span>🔥 <b id="fgCombo" style="color:#ff7a00"></b></span>
        <span>⬇️ 下一个 <b id="fgNext" class="fg-next">…</b></span>
      </div>
      <canvas id="fgCanvas" width="${W}" height="${H}"></canvas>
      <div class="fg-tip">点击/点按顶部位置投放数据单元 · 同类相撞合成更大</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const cv = document.getElementById('fgCanvas'), ctx = cv.getContext('2d');
  const scoreEl = document.getElementById('fgScore'), comboEl = document.getElementById('fgCombo');
  const dropsEl = document.getElementById('fgDrops'), nextEl = document.getElementById('fgNext'), targetEl = document.getElementById('fgTarget');

  function radius(lv) { return 16 + lv*9; }
  function color(lv) { return colors[lv % colors.length]; }
  function pickLv() {
    // 低档位为主、中档可出，保证目标(MB)可达；高档稀有
    const r = Math.random();
    if (r < 0.35) return 0;   // bit
    if (r < 0.6) return 1;    // Byte
    if (r < 0.8) return 2;    // KB
    if (r < 0.92) return 3;   // MB
    return 4;                 // GB
  }
  function spawnDrop() {
    dropLv = pickLv();
    nextEl.textContent = units[dropLv].name;
  }
  function addBall(lv, x, y, vx, vy) {
    balls.push({ lv: lv, x: x, y: y, r: radius(lv), vx: vx||0, vy: vy||0, born: performance.now() });
  }
  function doDrop() {
    if (ended || !holding) return;
    holding = false;
    drops++; dropsEl.textContent = drops;
    addBall(dropLv, hoverX, 26, (Math.random()-0.5)*40, 30);
    spawnDrop();
    holding = true;   // 准备投放下一个（否则只能投 1 个球）
    if (drops >= DROPS) { // 投放用完还没合出目标 → 失败
      endGame(false);
    }
  }
  function merge(a, b) {
    const lv = a.lv;
    const nx = (a.x+b.x)/2, ny = Math.min(a.y,b.y) - 10;
    balls = balls.filter(x => x !== a && x !== b);   // 安全移除（避免 splice 索引错位）
    if (lv+1 > TARGET_LV) { // 已到最高档，再合 → 直接清掉+分
      score += (lv+1)*30; combo++; updateUI(); playSound('success'); popAt(nx,ny,'🔥 '+units[lv].name+'!'); return;
    }
    const nl = lv + 1;
    addBall(nl, nx, ny, 0, -60);
    combo++; score += (nl+1)*15 * (1 + Math.floor(combo/5));
    updateUI(); playSound('success');
    popAt(nx, ny, units[nl].name);
    if (nl === TARGET_LV) { win = true; setTimeout(()=>endGame(true), 500); }
  }
  const pops = [];
  function popAt(x,y,txt){ pops.push({x:x,y:y,txt:txt,t:0}); }
  function drawPops(dt) {
    pops.forEach(p => { p.t += dt; ctx.globalAlpha = Math.max(0,1-p.t/0.8); ctx.fillStyle='#ffd27d'; ctx.font='bold 14px sans-serif'; ctx.textAlign='center'; ctx.fillText(p.txt, p.x, p.y - p.t*36); });
    ctx.globalAlpha = 1;
    for (let i = pops.length-1; i>=0; i--) if (pops[i].t >= 0.8) pops.splice(i,1);
  }
  function updateUI() { scoreEl.textContent = score; comboEl.textContent = combo>=2?'x'+combo:''; }

  // 物理更新
  function step(dt) {
    balls.forEach(b => {
      b.vy += G * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      // 墙
      if (b.x - b.r < 4) { b.x = b.r + 4; b.vx = -b.vx * REST; }
      if (b.x + b.r > W-4) { b.x = W - b.r - 4; b.vx = -b.vx * REST; }
      // 底
      if (b.y + b.r > H-4) { b.y = H - b.r - 4; if (b.vy > 0) b.vy = -b.vy * REST; }
      // 顶（溢出判定）：刚投下的球给 0.8s 缓冲落进堆里，避免一生成就误判溢出
      if (b.y - b.r < 20 && performance.now() - b.born > 800) { endGame(false); return; }
      b.vx *= DAMP; b.vy *= DAMP;
      if (Math.abs(b.vx) < 0.6) b.vx = 0;
      if (Math.abs(b.vy) < 0.6 && b.y + b.r >= H-5) b.vy = 0;
    });
    // 两两碰撞 + 合并（同等级接触即合成；用重启循环避免索引错位）
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < balls.length; i++) {
        for (let j = i+1; j < balls.length; j++) {
          const a = balls[i], b = balls[j];
          const dx = b.x-a.x, dy = b.y-a.y;
          const d2 = dx*dx + dy*dy; const min = a.r + b.r;
          if (d2 < min*min && d2 > 0.0001) {
            if (a.lv === b.lv) { merge(a,b); merged = true; break; }
            const d = Math.sqrt(d2), nx = dx/d, ny = dy/d, overlap = min - d;
            a.x -= nx*overlap/2; a.y -= ny*overlap/2;
            b.x += nx*overlap/2; b.y += ny*overlap/2;
          }
        }
        if (merged) break;
      }
    }
    if (ended) return;
    raf = requestAnimationFrame(frame);
  }
  function draw() {
    ctx.clearRect(0,0,W,H);
    // 顶线（溢出线）
    ctx.strokeStyle = 'rgba(255,85,85,.35)'; ctx.setLineDash([6,6]); ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0,20); ctx.lineTo(W,20); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(255,85,85,.5)'; ctx.font='11px sans-serif'; ctx.fillText('溢出线', 8, 14);
    // 当前待投放
    if (holding && !ended) {
      const lv = dropLv;
      ctx.beginPath(); ctx.arc(hoverX, 26, radius(lv), 0, Math.PI*2);
      ctx.fillStyle = color(lv); ctx.globalAlpha=.55; ctx.fill(); ctx.globalAlpha=1;
      ctx.strokeStyle = '#fff'; ctx.lineWidth=2; ctx.stroke();
      ctx.fillStyle='#fff'; ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.fillText(units[lv].name, hoverX, 30);
    }
    // 球
    balls.forEach(b => {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fillStyle = color(b.lv); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle='#0a0d14'; ctx.font='bold '+Math.max(10, 13-b.lv)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(units[b.lv].name, b.x, b.y);
    });
    drawPops(0.016);
  }
  function frame(now) {
    const dt = Math.min(0.033, (now-last)/1000); last = now;
    if (!ended) { step(dt); if (!ended) draw(); }
  }
  // 指针控制
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect();
    hoverX = Math.max(radius(dropLv)+2, Math.min(W - radius(dropLv)-2, (e.clientX - r.left) * (W/r.width)));
  });
  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect();
    hoverX = Math.max(radius(dropLv)+2, Math.min(W - radius(dropLv)-2, (e.clientX - r.left) * (W/r.width)));
    doDrop();
  });

  function endGame(isWin) {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    win = isWin;
    if (win) { window.recordGameWin('forge'); window.miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs = window.getGameStats(); _gs.forgeBest = Math.max(_gs.forgeBest||0, score); _gs.forgeCombo = Math.max(_gs.forgeCombo||0, combo); window.saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(win?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(win?'var(--green)':'var(--red)')+';margin-top:8px">'+(win?'合成出 '+escHtml(cfg.target||units[TARGET_LV].name)+'！':'熔炉溢出了')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">得分 <b style="color:var(--amber)">'+score+'</b> · 最高连击 <b style="color:var(--amber)">'+combo+'</b></div>'+
        '<div style="display:flex;gap:10px;justify-window.content:center;margin-top:16px"><button class="mm-btn" onclick="window.fgAgain()">🔁 再来一炉</button><button class="mm-btn primary" onclick="window.fgDone()">收下奖励</button></div>';
      window.focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.fgAgain = () => { overlay.remove(); openForge(cfg, onComplete); };
  window.fgDone = () => { overlay.remove(); window.playAreaMusic(); if (onComplete) onComplete(win); };
  function closeGame(manual) {
    if (ended) return;
    ended = true; cancelAnimationFrame(raf);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); window.playAreaMusic(); }
  }
  spawnDrop();
  raf = requestAnimationFrame(frame);
}
