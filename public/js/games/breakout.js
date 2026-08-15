// ═══════════════════════════════════════════════════════════════════
// games/breakout — 拆自 app.js（openBreakout）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openBreakout(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('breakout')) {
    window.showGameTutorial('breakout', '🧱 AI 打砖块', [
      '下面的<b>板 = 你的 AI 决策</b>，<b>←/→</b> 或 <b>拖动</b> 移动，接住弹球',
      '球反弹消掉<b>设备故障砖</b>（模型漂移/数据偏差…）',
      '球漏到底 -1 命；消光砖块过关，下一关更快更硬',
      '吃 ⭐ 掉落可加命/加速'
    ], function(){ openBreakout(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('breakout') || 'hub');
  const fault=(cfg.fault||['设备故障','模型漂移']).map(String);
  const normal=(cfg.normal||['正常样本','冗余备份']).map(String);
  const W=840,H=560;
  let lives=3, score=0, level=1, ended=false;
  let px=W/2, pw=90, ball={x:W/2,y:H-60,vx:150,vy:-200}, onPaddle=true;
  let bricks=[], speed=1, particles=[];
  const colors=['#ff5252','#ff7043','#ffb300','#7ee8fa','#ab6cff'];
  const overlay=document.createElement('div');
  overlay.className='mm-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML=`
    <div class="sh-box">
      <div class="mm-head"><div><div class="mm-title">🧱 AI 打砖块</div><div class="mm-sub">${escHtml(cfg.name||'')} —— 板=你的 AI 决策，消掉故障砖</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="sh-stats"><span>❤️ <b id="brLives">3</b></span><span>🎯 <b id="brScore">0</b></span><span>🏆 第 <b id="brLevel">1</b> 关</span></div>
      <div class="canvas-wrap" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#04060c;cursor:none;touch-action:none"><canvas id="brCanvas" width="${W}" height="${H}" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;touch-action:none"></canvas></div>
      <div class="sh-tip">←/→ 或 拖动 移动板 · 接球消砖 · 漏球 -1 命</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick=()=>closeGame(false);
  const cv=document.getElementById('brCanvas'), ctx=cv.getContext('2d');
  const cw=cv.clientWidth||W; const sf=Math.max(0.6,cw/W);
  const livesEl=document.getElementById('brLives'), scoreEl=document.getElementById('brScore'), levelEl=document.getElementById('brLevel');
  function build(){
    bricks=[]; const rows=4+Math.min(level,3), cols=8;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const isFault = Math.random() < 0.62;   // 62% 是故障（该打），其余是正常（不该打）
      const label = isFault ? fault[Math.floor(Math.random()*fault.length)] : normal[Math.floor(Math.random()*normal.length)];
      bricks.push({ x: c*104+20, y: r*34+40, w:96, h:26, col: isFault ? colors[(r+level)%colors.length] : '#546e7a', label, fault: isFault, flash:0 });
    }
    ball={x:W/2,y:H-60,vx:(Math.random()<.5?1:-1)*150,vy:-200}; onPaddle=true; px=W/2;
  }
  build();
  function addParticles(x,y,c){ for(let i=0;i<14;i++)particles.push({x,y,vx:(Math.random()-.5)*260,vy:(Math.random()-.5)*260,t:0,color:c}); }
  document.addEventListener('keydown', e=>{ if(e.key==='ArrowLeft'||e.key==='a'){px-=28;} else if(e.key==='ArrowRight'||e.key==='d'){px+=28;} else if(e.key==='Escape')closeGame(false); });
  cv.addEventListener('pointermove', e=>{ const r=cv.getBoundingClientRect(); px=Math.max(pw/2,Math.min(W-pw/2,(e.clientX-r.left)/sf)); });
  cv.addEventListener('pointerdown', e=>{ if(onPaddle){ onPaddle=false; } });
  function update(dt){
    if(ended)return;
    // 板
    px=Math.max(pw/2,Math.min(W-pw/2,px));
    if(onPaddle){ ball.x=px; ball.y=H-58; }
    else {
      ball.x+=ball.vx*speed*dt; ball.y+=ball.vy*speed*dt;
      if(ball.x<8||ball.x>W-8) ball.vx*=-1;
      if(ball.y<8) ball.vy*=-1;
      if(ball.y>H+10){ lives--; livesEl.textContent=lives; playSound('error'); if(lives<=0){endGame(false);return;} onPaddle=true; ball.x=px; ball.y=H-58; }
      // 板碰撞
      if(ball.vy>0 && ball.y>H-70 && ball.y<H-50 && Math.abs(ball.x-px)<pw/2+6){ ball.vy=-Math.abs(ball.vy); ball.vx+=(ball.x-px)*0.6; playSound('type'); }
      // 砖碰撞
      bricks.forEach(b=>{ if(!b.hit && ball.x>b.x-8&&ball.x<b.x+b.w+8&&ball.y>b.y-8&&ball.y<b.y+b.h+8){ ball.vy*=-1;
        if(b.fault){ b.hit=true; score+=10; scoreEl.textContent=score; addParticles(b.x+b.w/2,b.y+b.h/2,b.col); playSound('success'); }
        else { score=Math.max(0,score-5); scoreEl.textContent=score; b.flash=0.3; playSound('error'); }
      } });
      bricks.forEach(b=>{ if(b.flash>0)b.flash-=dt; });
      bricks=bricks.filter(b=>!b.hit);
      // 过关：所有故障砖清完即可（正常砖是干扰，不用打）
      if(!bricks.some(b=>b.fault)){ level++; levelEl.textContent=level; score+=level*50; speed=Math.min(2,1+level*0.15); playSound('fanfare'); build(); }
    }
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    // 砖
    bricks.forEach(b=>{ ctx.fillStyle=b.col; ctx.shadowColor=b.fault?b.col:'transparent'; ctx.shadowBlur=8; ctx.fillRect(b.x,b.y,b.w,b.h); ctx.shadowBlur=0;
      if(b.flash>0){ ctx.globalAlpha=Math.min(1,b.flash/0.3)*0.6; ctx.fillStyle='#fff'; ctx.fillRect(b.x,b.y,b.w,b.h); ctx.globalAlpha=1; }
      ctx.fillStyle='#061018'; ctx.font='bold '+Math.round(10/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(b.label.length>4?b.label.slice(0,4):b.label, b.x+b.w/2, b.y+b.h/2); });
    // 板（AI 决策）
    ctx.fillStyle='#7ee8fa'; ctx.shadowColor='#7ee8fa'; ctx.shadowBlur=12; ctx.fillRect(px-pw/2, H-44, pw, 10); ctx.shadowBlur=0;
    // 球
    ctx.fillStyle='#fff'; ctx.shadowColor='#fff'; ctx.shadowBlur=10; ctx.beginPath(); ctx.arc(ball.x,ball.y,7,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    // 粒子
    particles.forEach(p=>{ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; ctx.globalAlpha=Math.max(0,1-p.t/0.5); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,5,5); });
    ctx.globalAlpha=1; particles=particles.filter(p=>p.t<0.5);
  }
  function endGame(isWin){ if(ended)return; ended=true; if(isWin){window.recordGameWin('breakout');window.miniMarkClear(cfg.id);playSound('fanfare');}
    setTimeout(()=>{ const res=document.createElement('div'); res.className='ty-result';
      window.focusResultPrimary(overlay);
      res.innerHTML='<div style="font-size:46px;line-height:1">🧱</div><div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:8px">'+(isWin?'故障全消！':'AI 决策失误，球漏了')+'</div><div style="font-size:15px;color:var(--dim);margin-top:6px">得分 <b style="color:var(--amber)">'+score+'</b> · 到第 <b style="color:var(--amber)">'+level+'</b> 关</div><div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.brAgain()">🔁 再来</button><button class="mm-btn primary" onclick="window.brDone()">收下奖励</button></div>';
      overlay.innerHTML=''; overlay.appendChild(res); },300); }
  window.brAgain=()=>{ overlay.remove(); openBreakout(cfg,onComplete); };
  window.brDone=()=>{ if(onComplete)onComplete(score>=50); overlay.remove(); window.playAreaMusic(); };
  function closeGame(manual){ if(ended)return; ended=true; cancelAnimationFrame(raf); overlay.remove(); if(manual){if(onComplete)onComplete(false);window.playAreaMusic();} }
  let last=performance.now(), dt=0;
  function loop(now){ dt=Math.min(0.05,(now-last)/1000); last=now; update(dt); draw(); raf=requestAnimationFrame(loop); }
  let raf; raf=requestAnimationFrame(loop);
}
