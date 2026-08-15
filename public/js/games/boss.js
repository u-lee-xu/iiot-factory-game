// ═══════════════════════════════════════════════════════════════════
// games/boss — 拆自 app.js（openBoss）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openBoss(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('boss')) {
    window.showGameTutorial('boss', '🎯 愤怒的厂长·弹射排障', [
      '对面的<b>故障塔</b>里藏着一块<b>红色故障</b>，把它砸掉就过关',
      '在弹弓上<b>按住向后拖</b>再松手发射命令弹（ping/ss/curl 重量不同）',
      '只有 <b>N 发</b>，砸中故障块即赢'
    ], function(){ openBoss(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('boss') || 'boss');
  const W=600,H=360, GR=430;
  const BALLS=[{name:'ping',emoji:'⚪',mass:1,color:'#9fa8da'},{name:'ss',emoji:'🔵',mass:0.75,color:'#4d96ff'},{name:'curl',emoji:'🟠',mass:1.4,color:'#ff9f43'}];
  const SHOTS = cfg.shots || 5;
  let selBall=0, used=0, ended=false, resultWin=false;
  let blocks=[], proj=null, drag=null, raf=0, last=0;
  const SX=55, SY=H-60;

  function build(){
    blocks=[]; const bx=W-130;
    for(let i=0;i<4;i++) blocks.push({x:bx, y:H-28-(i+1)*34, w:82, h:32, fault:(i===1)});
  }
  function launch(px,py){
    if(proj||ended) return;
    used++; shotsEl.textContent=Math.max(0,SHOTS-used);
    const dx=SX-px, dy=SY-py, p=Math.min(540, Math.hypot(dx,dy)*2.6), ang=Math.atan2(dy,dx);
    const b=BALLS[selBall];
    proj={x:SX,y:SY, vx:Math.cos(ang)*p/b.mass, vy:Math.sin(ang)*p/b.mass, color:b.color, emoji:b.emoji};
    playSound('click');
  }
  function update(dt){
    if(proj){
      proj.vy+=GR*dt; proj.x+=proj.vx*dt; proj.y+=proj.vy*dt;
      if(proj.y>H-12||proj.x<0||proj.x>W){ proj=null; nextShot(); return; }
      for(let i=blocks.length-1;i>=0;i--){
        const b=blocks[i];
        if(proj.x>b.x&&proj.x<b.x+b.w&&proj.y>b.y&&proj.y<b.y+b.h){
          const wasFault=b.fault; blocks.splice(i,1); playSound('success');
          if(wasFault){ endGame(true); return; }
          proj=null; nextShot(); return;
        }
      }
    }
  }
  function nextShot(){ if(!ended && used>=SHOTS && !proj) endGame(false); }
  function draw(){
    ctx.clearRect(0,0,W,H);
    // 地面
    ctx.fillStyle='#11141c'; ctx.fillRect(0,H-8,W,8);
    // 弹弓
    ctx.strokeStyle='#8a5a2b'; ctx.lineWidth=5;
    ctx.beginPath(); ctx.moveTo(SX-14,H); ctx.lineTo(SX-8,SY); ctx.moveTo(SX+14,H); ctx.lineTo(SX+8,SY); ctx.stroke();
    // 瞄准线（拖拽时）
    if(drag){
      const r=cv.getBoundingClientRect();
      const px=(drag.x-r.left)*(W/r.width), py=(drag.y-r.top)*(H/r.height);
      ctx.strokeStyle='rgba(255,176,0,.4)'; ctx.lineWidth=2; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(SX,SY); ctx.lineTo(px,py); ctx.stroke(); ctx.setLineDash([]);
    }
    // 块
    blocks.forEach(b=>{
      ctx.fillStyle = b.fault ? '#ff5252' : '#3a4458';
      ctx.strokeStyle='#0a0d14'; ctx.lineWidth=2;
      ctx.fillRect(b.x,b.y,b.w,b.h); ctx.strokeRect(b.x,b.y,b.w,b.h);
      if(b.fault){ ctx.fillStyle='#fff'; ctx.font='12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('故障', b.x+b.w/2, b.y+b.h/2); }
    });
    // 待发弹
    if(!proj && !ended){
      const b=BALLS[selBall];
      ctx.beginPath(); ctx.arc(SX,SY,12,0,Math.PI*2); ctx.fillStyle=b.color; ctx.fill(); ctx.fillStyle='#0a0d14'; ctx.font='10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(b.emoji,SX,SY);
    }
    // 飞行弹
    if(proj){ ctx.beginPath(); ctx.arc(proj.x,proj.y,10,0,Math.PI*2); ctx.fillStyle=proj.color; ctx.fill(); ctx.fillStyle='#0a0d14'; ctx.font='10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(proj.emoji,proj.x,proj.y); }
  }
  function frame(now){
    const dt=Math.min(0.033,(now-last)/1000); last=now;
    if(!ended){ update(dt); draw(); raf=requestAnimationFrame(frame); }
  }

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="bz-box">
      <div class="mm-head"><div><div class="mm-title">🎯 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="bz-stats"><span>🎯 打掉 <b>红色故障块</b></span><span>🎯 剩余 <b id="bzShots">${SHOTS}</b> 发</span></div>
      <canvas id="bzCanvas" width="${W}" height="${H}"></canvas>
      <div class="bz-balls">${BALLS.map((b,i)=>'<button class="bz-ball-btn'+(i===0?' active':'')+'" data-i="'+i+'">'+b.emoji+' '+b.name+'</button>').join('')}</div>
      <div class="bz-tip">按住向后拖再松手发射 · ping轻/ss快/curl重</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const cv=document.getElementById('bzCanvas'), ctx=cv.getContext('2d');
  const shotsEl=document.getElementById('bzShots');
  overlay.querySelectorAll('.bz-ball-btn').forEach(btn=>{
    btn.onclick=()=>{ selBall=+btn.dataset.i; overlay.querySelectorAll('.bz-ball-btn').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); };
  });
  cv.addEventListener('pointerdown', e=>{ if(!ended&&!proj){ drag={x:e.clientX,y:e.clientY}; } });
  cv.addEventListener('pointermove', e=>{ if(drag){ drag.x=e.clientX; drag.y=e.clientY; } });
  cv.addEventListener('pointerup', e=>{ if(drag){ drag=null; const r=cv.getBoundingClientRect(); launch((e.clientX-r.left)*(W/r.width),(e.clientY-r.top)*(H/r.height)); } });

  function endGame(isWin) {
    if (ended) return;
    ended = true; resultWin = isWin;
    if (isWin) { window.recordGameWin('boss'); window.miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=window.getGameStats(); _gs.bossBest=Math.max(_gs.bossBest||0, used); _gs.bossWins=(_gs.bossWins||0)+(isWin?1:0); window.saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'故障块砸掉了！':'命令弹打光了')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">用了 <b style="color:var(--amber)">'+used+'</b> 发</div>'+
        '<div style="display:flex;gap:10px;justify-window.content:center;margin-top:16px"><button class="mm-btn" onclick="window.bzAgain()">🔁 再砸一轮</button><button class="mm-btn primary" onclick="window.bzDone()">收下奖励</button></div>';
      window.focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.bzAgain = () => { overlay.remove(); openBoss(cfg, onComplete); };
  window.bzDone = () => { overlay.remove(); window.playAreaMusic(); if (onComplete) onComplete(resultWin); };
  function closeGame(manual) {
    if (ended) return;
    ended = true; cancelAnimationFrame(raf);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); window.playAreaMusic(); }
  }
  build();
  raf = requestAnimationFrame(frame);
}
