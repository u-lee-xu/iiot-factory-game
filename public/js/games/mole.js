// ═══════════════════════════════════════════════════════════════════
// games/mole — 拆自 app.js（openMole）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openMole(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('mole')) {
    window.showGameTutorial('mole', '🔨 边缘打地鼠', [
      '传感器不断<b>冒出异常数据</b>（超温/爆振/毛刺），<b>点掉</b>它们 = 边缘过滤',
      '看准了再点：冒出的是<b>正常数据</b>就别点，点错 -1 命',
      '<b>⭐ 金色包</b>是奖励，点它 +50 分、直接算 2 个异常；连点有连击加分',
      '难度会提升：同时冒出更多、消失更快；点掉 20 个异常即通关'
    ], function(){ openMole(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('mole') || 'hub');
  const metric=cfg.metric||'温度', unit=cfg.unit||'', thr=cfg.threshold||80;   // 阈值判断：读数>阈值=异常
  const W=840,H=560, COLS=4, ROWS=3;
  const hw=160, hh=150;   // 每格大小
  const ox=(W-COLS*hw)/2, oy=(H-ROWS*hh)/2;
  let lives=3, score=0, combo=0, killed=0, ended=false;
  let moles=[], spawnTimer=0.2, speed=1, particles=[];
  const overlay=document.createElement('div');
  overlay.className='mm-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML=`
    <div class="sh-box">
      <div class="mm-head"><div><div class="mm-title">🔨 边缘打地鼠</div><div class="mm-sub">${escHtml(cfg.name||'')} —— 点掉异常，别点正常</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="sh-stats"><span>❤️ <b id="moLives">3</b></span><span>🌡️ 正常 ≤<b id="moThr">${thr}</b>${unit}</span><span>🎯 <b id="moScore">0</b></span><span>🔨 <b id="moKill">0</b>/20</span><span>🔥 <b id="moCombo" style="color:#ff7a00"></b></span></div>
      <div class="canvas-wrap" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#0a0f16;cursor:pointer;touch-action:none"><canvas id="moCanvas" width="${W}" height="${H}" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;touch-action:none"></canvas></div>
      <div class="sh-tip">读数 <b>超过阈值</b>(${thr}${unit})就点掉 · 范围内别点 · ⭐金包必点 · 越冒越快</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick=()=>closeGame(false);
  const cv=document.getElementById('moCanvas'), ctx=cv.getContext('2d');
  const cw=cv.clientWidth||W; const sf=Math.max(0.6,cw/W);
  const livesEl=document.getElementById('moLives'), scoreEl=document.getElementById('moScore'), killEl=document.getElementById('moKill'), comboEl=document.getElementById('moCombo');
  function centerOf(i){ return { x: ox + hw*(i%COLS) + hw/2, y: oy + hh*Math.floor(i/COLS) + hh/2 }; }
  function freeSpot(i){ return !moles.some(m=>m.i===i); }
  function spawn(){
    // 难度：越往后同时冒得越多（2~3 个），消失更快
    const maxSim = speed >= 2.4 ? 3 : speed >= 1.6 ? 2 : 1;
    if (moles.length >= maxSim) return;
    let tries=0, i=Math.floor(Math.random()*(COLS*ROWS));
    while (!freeSpot(i) && tries<20){ i=Math.floor(Math.random()*(COLS*ROWS)); tries++; }
    if (!freeSpot(i)) return;
    const c=centerOf(i);
    const isGold = Math.random() < 0.10;                      // ⭐ 金色奖励包
    let isGood=false, val=0;
    if (!isGold) { val = 5 + Math.floor(Math.random()*(thr*1.5)); isGood = val <= thr; }
    moles.push({ i, x:c.x, y:c.y, isGood, isGold, val, t:0, dur: Math.max(0.6, 1.5 - speed*0.16), label: isGold ? '⭐ 奖励' : (metric+' '+val+unit) });
  }
  function addParticles(x,y,c){ for(let k=0;k<12;k++)particles.push({x,y,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*220-60,t:0,color:c}); }
  cv.addEventListener('pointerdown', e=>{
    if(ended)return;
    const r=cv.getBoundingClientRect(); const x=(e.clientX-r.left)/sf, y=(e.clientY-r.top)/sf;
    let hitMole=null;
    for (const m of moles) if (Math.abs(x-m.x)<46 && Math.abs(y-m.y)<46){ hitMole=m; break; }
    if (!hitMole) return;
    if (hitMole.isGold) {
      combo++; score+=50; killed+=2;
      scoreEl.textContent=score; killEl.textContent=killed; comboEl.textContent=combo>=2?'x'+combo:'';
      playSound('fanfare'); addParticles(hitMole.x,hitMole.y,'#ffd700');
      moles = moles.filter(m=>m!==hitMole);
      if (killed>=20){ endGame(true); return; }
      return;
    }
    if(hitMole.isGood){ lives--; livesEl.textContent=lives; playSound('error'); addParticles(hitMole.x,hitMole.y,'#ff5252'); if(lives<=0){endGame(false);return;} }
    else { combo++; score+=10+(combo>=5?5:combo>=3?3:0); killed++; scoreEl.textContent=score; killEl.textContent=killed; comboEl.textContent=combo>=2?'x'+combo:''; playSound('success'); addParticles(hitMole.x,hitMole.y,'#ffb000'); if(killed>=20){endGame(true);return;} }
    moles = moles.filter(m=>m!==hitMole);
  });
  function update(dt){
    if(ended)return;
    spawnTimer-=dt;
    if(spawnTimer<=0){ spawn(); spawnTimer = Math.max(0.28, 0.6 - speed*0.06); }
    moles.forEach(m=>{ m.t+=dt; });
    const before=moles.length;
    moles = moles.filter(m=>m.t<m.dur);
    if (moles.length < before) { combo=0; if(comboEl)comboEl.textContent=''; }   // 消失=漏掉，断连击
    speed = 1 + (killed*0.07);
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='rgba(0,188,212,.06)';
    for(let i=0;i<COLS*ROWS;i++){ const c=centerOf(i); ctx.beginPath(); ctx.arc(c.x,c.y,46,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='rgba(0,188,212,.25)'; ctx.stroke(); }
    moles.forEach(active=>{
      const a = Math.sin(active.t*10)*0.12+0.9;
      ctx.globalAlpha=a;
      ctx.fillStyle = active.isGold ? 'rgba(255,193,7,.5)' : 'rgba(255,152,0,.5)';
      ctx.strokeStyle = active.isGold ? 'rgba(255,215,0,.9)' : active.isGood ? 'rgba(0,200,83,.6)' : 'rgba(255,82,82,.7)';
      ctx.lineWidth=3; ctx.shadowBlur=12;
      ctx.beginPath(); ctx.arc(active.x, active.y, 42, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.shadowBlur=0;
      ctx.fillStyle='#fff'; ctx.font='bold '+Math.round(16/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(active.label, active.x, active.y-4);
      ctx.fillStyle= active.isGold ? '#ffd700' : '#ffd27d'; ctx.font='bold '+Math.round(10/sf)+'px sans-serif';
      ctx.fillText(active.isGold ? '+50 算2个' : (active.isGood ? '正常' : '异常?'), active.x, active.y+16);
      ctx.globalAlpha=1;
    });
    particles.forEach(p=>{ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; ctx.globalAlpha=Math.max(0,1-p.t/0.5); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,5,5); });
    ctx.globalAlpha=1; particles=particles.filter(p=>p.t<0.5);
  }
  function endGame(isWin){
    if(ended)return; ended=true; cancelAnimationFrame(raf);
    if(isWin){ window.recordGameWin('mole'); window.miniMarkClear(cfg.id); playSound('fanfare'); }
    setTimeout(()=>{ const res=document.createElement('div'); res.className='ty-result';
      window.focusResultPrimary(overlay);
      res.innerHTML='<div style="font-size:46px;line-height:1">🔨</div><div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'边缘过滤完成！':'被正常数据骗了')+'</div><div style="font-size:15px;color:var(--dim);margin-top:6px">点掉异常 <b style="color:var(--amber)">'+killed+'</b> 个 · 得分 <b style="color:var(--amber)">'+score+'</b></div><div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.moAgain()">🔁 再来</button><button class="mm-btn primary" onclick="window.moDone()">收下奖励</button></div>';
      overlay.innerHTML=''; overlay.appendChild(res); },300);
  }
  function teardown(){ cancelAnimationFrame(raf); }
  window.moAgain=()=>{ teardown(); overlay.remove(); openMole(cfg,onComplete); };
  window.moDone=()=>{ teardown(); if(onComplete)onComplete(killed>=20); overlay.remove(); window.playAreaMusic(); };
  function closeGame(manual){ if(ended)return; ended=true; cancelAnimationFrame(raf); teardown(); overlay.remove(); if(manual){if(onComplete)onComplete(false);window.playAreaMusic();} }
  let last=performance.now(), dt=0;
  function loop(now){ dt=Math.min(0.05,(now-last)/1000); last=now; update(dt); draw(); raf=requestAnimationFrame(loop); }
  let raf; raf=requestAnimationFrame(loop);
}
