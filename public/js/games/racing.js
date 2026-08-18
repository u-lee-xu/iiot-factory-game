// ═══════════════════════════════════════════════════════════════════
// games/racing — 拆自 app.js（openDataRacing）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openDataRacing(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('racing')) {
    window.showGameTutorial('racing', '🏎️ 数据狂飙', [
      '你的<b>数据车</b>在监控管道里狂飙，用 <b>←/→</b>（手机<b>点屏幕两侧</b>）切换车道',
      '<b>躲开</b>红色异常块（超温🔥/爆振⚡/超压💢）——撞上 -1 命',
      '<b>吃</b>绿色正常数据 +10 分，连吃有连击加成；金色 🎁 是随机道具',
      '越跑越快，直到跟不上为止；坚持越久分越高'
    ], function(){ openDataRacing(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('racing') || 'boss');
  const metric=cfg.metric||'温度', unit=cfg.unit||'', mx=cfg.max||80;   // 数值判断：读数>上限=异常
  const LANES = cfg.lanes || 4;
  const LIVES = (cfg.lives || 3) + ((window.shooterBuff && window.shooterBuff.lives) || 0);   // 商城护盾 +1 命
  const W = 840, H = 560;
  const baseSpeed = (cfg._hard ? 250 : 185);
  const accel = cfg._hard ? 6.5 : 4.5;

  let lives = LIVES, score = 0, combo = 0, ended = false, survived = 0, clearedMarked = false;
  let speed = baseSpeed, elapsed = 0, bgScroll = 0;
  let lane = Math.floor(LANES / 2), carX = 0, invuln = 0, shield = false;
  let items = [], spawnTimer = 0, particles = [], trail = [];
  let keys = { left:false, right:false };
  const laneW = W / LANES;
  carX = laneW*lane + laneW/2;   // 初始车在中间道

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div class="sh-box">
      <div class="mm-head">
        <div><div class="mm-title">🏎️ 数据狂飙</div><div class="mm-sub">${escHtml(cfg.name||'')} —— 躲异常、吃正常、越跑越快</div></div>
        <div class="mm-close" title="关闭">✕</div>
      </div>
      <div class="sh-stats">
        <span>❤️ <b id="rrLives">${LIVES}</b></span>
        <span>🌡️ 正常 ≤<b id="rrMax">${mx}</b>${unit}</span>
        <span>⚡ <b id="rrSpeed" style="color:#7ee8fa">0</b></span>
        <span>🎯 <b id="rrScore">0</b></span>
        <span>🔥 <b id="rrCombo" style="color:#ff7a00"></b></span>
      </div>
      <div class="canvas-wrap" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(ellipse at 50% 10%, #0a1428, #04060c);cursor:pointer;touch-action:none"><canvas id="rrCanvas" width="${W}" height="${H}" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;touch-action:none"></canvas></div>
      <div class="sh-tip">←/→ 或 点屏幕两侧切换车道 · 读数 ≤${mx}${unit} 才吃 · 超限躲开</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const cv = document.getElementById('rrCanvas');
  const ctx = cv.getContext('2d');
  const cw = cv.clientWidth || W, ch = cv.clientHeight || H;
  const sfx = cw / W;
  const livesEl=document.getElementById('rrLives'), scoreEl=document.getElementById('rrScore'), comboEl=document.getElementById('rrCombo'), speedEl=document.getElementById('rrSpeed');

  function goLane(d){ lane = Math.max(0, Math.min(LANES-1, lane + d)); playSound('click'); }
  document.addEventListener('keydown', kd);
  document.addEventListener('keyup', ku);
  function kd(e){
    if (e.key==='ArrowLeft'||e.key==='a') keys.left=true;
    else if (e.key==='ArrowRight'||e.key==='d') keys.right=true;
    else if (e.key==='Escape') closeGame(false);
  }
  function ku(e){ if(e.key==='ArrowLeft'||e.key==='a')keys.left=false; else if(e.key==='ArrowRight'||e.key==='d')keys.right=false; }
  cv.addEventListener('pointerdown', e => {
    const r=cv.getBoundingClientRect(); const x=e.clientX-r.left;
    goLane(x < r.width/2 ? -1 : 1);
  });

  function addParticles(x,y,c){ for(let i=0;i<12;i++)particles.push({x,y,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*220-40,t:0,color:c}); }
  function spawnItem(){
    const l = Math.floor(Math.random()*LANES);
    const x = laneW*l + laneW/2;
    const rr = Math.random();
    let type='good';
    if (rr < 0.46) type='bad';
    else if (rr < 0.53) type='drop';
    const val = 15 + Math.floor(Math.random()*(mx*1.5));
    let label = metric+' '+val+unit;
    if (type==='drop') label='🎁';
    else type = (val <= mx) ? 'good' : 'bad';   // 读数判断：超上限=异常
    items.push({ x, y:-30, type, label, vy: speed, val });   // vy 仅作初始值，下落统一按当前 speed
  }

  function update(dt){
    if (ended) return;
    elapsed += dt; survived += dt;
    if (!clearedMarked && survived >= 45) { clearedMarked = true; window.miniMarkClear(cfg.id); window.showToast('🏆 坚持 45 秒，达成通关！','success'); }
    speed = Math.min(950, baseSpeed + elapsed*accel);
    speedEl.textContent = Math.round(speed);
    if (invuln>0) invuln-=dt;
    if (keys.left) goLane(-1);
    if (keys.right) goLane(1);
    spawnTimer -= dt;
    if (spawnTimer <= 0){ spawnItem(); spawnTimer = Math.max(0.25, 0.85 - elapsed*0.004); }
    items.forEach(it => { it.y += speed*dt; });           // 障碍随当前车速下落（与速度读数一致）
    items = items.filter(it => it.y < H+40);
    const targetX = laneW*lane + laneW/2;
    carX += (targetX - carX) * Math.min(1, dt*9);          // 平滑变道
    const px = carX, py = H-70;
    items.forEach(it => {
      if (it.hit) return;
      if (Math.abs(it.x-px) < 36 && Math.abs(it.y-py) < 36) {
        it.hit = true;
        if (it.type==='good') {
          combo++; score += 10 + (combo>=5?5:combo>=3?3:0);
          scoreEl.textContent=score; comboEl.textContent = combo>=2?'x'+combo:'';
          addParticles(it.x, it.y, '#00e676'); playSound('success');
        } else if (it.type==='bad') {
          combo=0; if(comboEl)comboEl.textContent='';
          if (shield){ shield=false; addParticles(it.x,it.y,'#7ee8fa'); window.showToast('🛡 护盾挡下一次撞击！','info'); }
          else if (invuln<=0){ lives--; livesEl.textContent=lives; invuln=1.2; addParticles(it.x,it.y,'#ff5252'); playSound('error'); if(lives<=0){ endGame(false); return; } }
        } else {
          const roll=Math.random();
          if (roll<0.5){ if(invuln<=0){ shield=true; window.showToast('🛡 护盾就绪','info'); } else { score+=20; scoreEl.textContent=score; } }
          else if (roll<0.8){ lives=Math.min(LIVES+2, lives+1); livesEl.textContent=lives; window.showToast('❤ +1 命','info'); }
          else { score+=50; scoreEl.textContent=score; playSound('fanfare'); }
          playSound('pickup');
        }
      }
    });
    items = items.filter(it => !it.hit);
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    const sf = Math.max(0.6, cw/W);
    ctx.strokeStyle='rgba(0,188,212,.15)'; ctx.lineWidth=1;
    for(let i=1;i<LANES;i++){ ctx.beginPath(); ctx.moveTo(i*laneW,0); ctx.lineTo(i*laneW,H); ctx.stroke(); }
    ctx.fillStyle='rgba(0,188,212,.07)';
    bgScroll += speed*dt;                                 // 路面随车速滚动
    for(let j=0;j<14;j++){ const yy=((j*60 + bgScroll*0.9)%H); ctx.fillRect(0,yy,W,2); }
    const px = carX, py = H-70;
    if (invuln<=0 || Math.floor(invuln*8)%2===0) {
      ctx.fillStyle='#00e676';
      ctx.fillRect(px-22, py-16, 44, 30);
      ctx.fillStyle='#aaffcc'; ctx.fillRect(px-5, py-22, 10, 8);
      ctx.fillStyle='#00e676'; ctx.beginPath(); ctx.moveTo(px-28,py+14); ctx.lineTo(px,py+28); ctx.lineTo(px+28,py+14); ctx.fill();
    }
    if (shield){ ctx.strokeStyle='#7ee8fa'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(px, py, 34, 0, Math.PI*2); ctx.stroke(); }
    // 车尾焰
    trail.push({x:px,y:py+26,t:0}); trail.forEach(tr=>tr.t+=dt*2);
    trail=trail.filter(tr=>tr.t<1);
    trail.forEach(tr=>{ ctx.globalAlpha=Math.max(0,1-tr.t); ctx.fillStyle='#7ee8fa'; ctx.fillRect(tr.x-3, tr.y+(tr.t*20), 6, 8); });
    ctx.globalAlpha=1;
    items.forEach(it => {
      ctx.save();
      if (it.type==='good'){ ctx.fillStyle='#00c853'; ctx.strokeStyle='#b2ffce'; }
      else if (it.type==='bad'){ ctx.fillStyle='#ff5252'; ctx.strokeStyle='#ffd0d0'; }
      else { ctx.fillStyle='#ffb300'; ctx.strokeStyle='#ffe9a8'; }
      ctx.lineWidth=2;
      const r = it.type==='drop'?20:28;
      ctx.beginPath(); ctx.arc(it.x, it.y, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#061018';
      ctx.font='bold ' + Math.round(12/sf) + 'px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      const t = it.label.length>6 ? it.label.slice(0,6)+'…' : it.label;
      ctx.fillText(t, it.x, it.y);
      ctx.restore();
    });
    // 粒子
    particles.forEach(p=>{ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; ctx.globalAlpha=Math.max(0,1-p.t/0.5); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,5,5); });
    ctx.globalAlpha=1; particles=particles.filter(p=>p.t<0.5);
  }

  function endGame(isWin){
    if (ended) return;
    ended = true; cancelAnimationFrame(raf);
    if (isWin) { window.recordGameWin('racing'); window.miniMarkClear(cfg.id); playSound('fanfare'); }
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML =
        '<div style="font-size:46px;line-height:1">🏁</div>'+
        '<div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:8px">数据狂飙结束</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">坚持 <b style="color:var(--amber)">'+Math.floor(survived)+'</b> 秒 · 得分 <b style="color:var(--amber)">'+score+'</b> · 最高连击 <b style="color:var(--amber)">'+combo+'</b></div>'+
        '<div style="font-size:13px;color:var(--dim);margin-top:4px">'+(survived>=45?'🏆 已通关，下次挑战二周目/无限战！':'坚持 45 秒即可通关')+'</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px">'+
          '<button class="mm-btn" onclick="window.rrAgain()">🔁 再飙一次</button>'+
          '<button class="mm-btn primary" onclick="window.rrDone()">收下奖励</button>'+
        '</div>';
      window.focusResultPrimary(overlay);
      overlay.innerHTML='';
      overlay.appendChild(res);
    }, 300);
  }
  function teardown(){ cancelAnimationFrame(raf); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); }
  window.rrAgain = () => { teardown(); overlay.remove(); openDataRacing(cfg, onComplete); };
  window.rrDone = () => { teardown(); if (onComplete) onComplete(ended && survived>=45 ? true : false); overlay.remove(); window.playAreaMusic(); };
  function closeGame(manual){
    if (ended) return;
    ended=true; cancelAnimationFrame(raf); teardown();
    overlay.remove();
    if (manual){ if(onComplete) onComplete(false); window.playAreaMusic(); }
  }
  let last=performance.now(), dt=0;
  function loop(now){ dt=Math.min(0.05,(now-last)/1000); last=now; update(dt); draw(); raf=requestAnimationFrame(loop); }
  let raf; raf=requestAnimationFrame(loop);
}
