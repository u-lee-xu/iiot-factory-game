// ═══════════════════════════════════════════════════════════════════
// games/flappy — 拆自 app.js（openFlappy）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openFlappy(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('flappy')) {
    window.showGameTutorial('flappy', '🦅 云端跳跃 · 命令三选一', [
      '每根云柱是一道<b>命令选择题</b>：题目在上方，3 条飞行道各标一个选项',
      '三条道<b>都能穿过</b>，但只有<b>答案正确那条道</b>是安全的——飞错道会撞上隐形云墙 <b>-1 命</b>',
      '<b>点击/空格/↑</b> 起飞；先读题、再选道，安全穿过 +10'
    ], function(){ openFlappy(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('flappy') || 'hub');
  const questions=(cfg.questions||[{q:'SSH 登录命令是？',opts:['ssh user@ip','apt install','nslookup'],ans:0}]).map(function(q){return {q:String(q.q||''),opts:(q.opts||[]).map(String),ans:Number(q.ans)||0};});
  const W=840,H=560;
  const laneYs=[H*0.25, H*0.5, H*0.75];
  const gapHalf=58;
  let lives=3, score=0, ended=false;
  let py=H/2, vy=0, rot=0;
  let pipes=[], timer=0, speed=130;
  let particles=[];
  const overlay=document.createElement('div');
  overlay.className='mm-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-window.content:center';
  overlay.innerHTML=`
    <div class="sh-box">
      <div class="mm-head"><div><div class="mm-title">🦅 云端跳跃</div><div class="mm-sub">${escHtml(cfg.name||'')} —— 看题，飞到正确命令的道</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="sh-stats"><span>❤️ <b id="fpLives">3</b></span><span>🎯 <b id="fpScore">0</b></span><span>⚡ <b id="fpSpeed">0</b></span></div>
      <div class="canvas-wrap" style="flex:1;min-height:0;display:flex;align-items:center;justify-window.content:center;overflow:hidden;background:linear-gradient(#7ec8ff,#cfe9ff);touch-action:none"><canvas id="fpCanvas" width="${W}" height="${H}" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;touch-action:none"></canvas></div>
      <div class="sh-tip">点击/空格/↑ 起飞 · 先读题，飞进答案正确那条道 · 飞错道撞隐形云墙-1命</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick=()=>closeGame(false);
  const cv=document.getElementById('fpCanvas'), ctx=cv.getContext('2d');
  const cw=cv.clientWidth||W; const sf=Math.max(0.6,cw/W);
  const livesEl=document.getElementById('fpLives'), scoreEl=document.getElementById('fpScore'), speedEl=document.getElementById('fpSpeed');
  function flap(){ vy=-170; playSound('type'); }
  document.addEventListener('keydown', e=>{ if(e.key===' '||e.key==='ArrowUp'||e.key==='w'){e.preventDefault();flap();} else if(e.key==='Escape')closeGame(false); });
  cv.addEventListener('pointerdown', e=>{ e.preventDefault(); flap(); });
  function addParticles(x,y,c){ for(let i=0;i<8;i++)particles.push({x,y,vx:(Math.random()-.5)*100,vy:(Math.random()-.5)*100,t:0,color:c}); }
  function spawnPipe(){
    const q=questions[Math.floor(Math.random()*questions.length)];
    pipes.push({x:W+60, q, ans:q.ans, scored:false, hitDone:false});
  }
  function update(dt){
    if(ended)return;
    speed = 130 + score*2.5; speedEl.textContent=Math.round(speed);
    vy += 380*dt; py += vy*dt; rot = Math.max(-0.5, Math.min(1, vy/600));
    timer -= dt;
    if(timer<=0){ spawnPipe(); timer = Math.max(1.2, 1.7 - score*0.02); }
    pipes.forEach(p=>p.x -= speed*dt);
    pipes = pipes.filter(p=>p.x>-70);
    const cy = py+13;
    pipes.forEach(p=>{
      // 整根管道安全通过小鸟位置 → +10
      if(!p.scored && p.x+60 < 70){ p.scored=true; score+=10; scoreEl.textContent=score; playSound('success'); addParticles(70, cy, '#fff'); }
      // 管道覆盖小鸟位置：只有在「正确选项那道」的空隙才安全，其余都是隐形云墙（每根只判一次）
      if(!p.hitDone && p.x < 70 && p.x+60 > 70){
        let inOpen = Math.abs(cy - laneYs[p.ans]) < gapHalf;
        if(!inOpen){ p.hitDone=true; hit(); }
      }
    });
    if(py<-10||py>H-10){ hit(); }
  }
  function hit(){
    if(ended)return;
    playSound('error'); lives--; livesEl.textContent=lives; addParticles(70, py, '#ff5252');
    if(lives<=0){ endGame(false); return; }
    py=H/2; vy=0;
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    for(let i=0;i<6;i++){ const cx=((i*160 - (performance.now()/20)%160)%W), cy=40+i*90; ctx.fillStyle='rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(cx,cy,24,0,Math.PI*2); ctx.arc(cx+20,cy-8,18,0,Math.PI*2); ctx.arc(cx+40,cy,22,0,Math.PI*2); ctx.fill(); }
    pipes.forEach(p=>{
      // 三条云道都画成「可穿过」的缺口，不暴露答案——只有答对的选项那道才真正安全
      ctx.fillStyle='rgba(76,175,80,.35)';
      for(let i=0;i<3;i++){
        const y0=laneYs[i]-gapHalf, y1=laneYs[i]+gapHalf;
        ctx.fillRect(p.x, y0-3, 60, 6);                       // 道上沿
        ctx.fillRect(p.x, y1-3, 60, 6);                       // 道下沿
        // 道内：半透明云（可穿过）
        ctx.fillStyle='rgba(255,255,255,.10)';
        ctx.fillRect(p.x, y0+3, 60, (y1-y0)-6);
        ctx.fillStyle='rgba(76,175,80,.35)';
      }
      // 每条道左侧标选项
      p.q.opts.forEach(function(o,i){
        ctx.fillStyle='#1b5e20';
        ctx.font='bold '+Math.round(11/sf)+'px sans-serif'; ctx.textAlign='right';
        ctx.fillText(o, p.x-12, laneYs[i]+4);
      });
      // 题目显示在云柱上方
      ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=2;
      ctx.font='bold '+Math.round(13/sf)+'px sans-serif'; ctx.textAlign='center';
      ctx.strokeText('❓ '+p.q.q, p.x+30, 22); ctx.fillText('❓ '+p.q.q, p.x+30, 22);
    });
    ctx.save(); ctx.translate(70,py); ctx.rotate(rot);
    ctx.fillStyle='#00bcd4'; ctx.beginPath(); ctx.moveTo(26,0); ctx.lineTo(-18,-12); ctx.lineTo(-8,0); ctx.lineTo(-18,12); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#b2ebf2'; ctx.fillRect(-4,-3,8,6);
    ctx.restore();
    particles.forEach(p=>{ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; ctx.globalAlpha=Math.max(0,1-p.t/0.5); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,4,4); });
    ctx.globalAlpha=1; particles=particles.filter(p=>p.t<0.5);
  }
  function endGame(isWin){
    if(ended)return; ended=true;
    if(isWin){ window.recordGameWin('flappy'); window.miniMarkClear(cfg.id); playSound('fanfare'); }
    setTimeout(()=>{ const res=document.createElement('div'); res.className='ty-result';
      window.focusResultPrimary(overlay);
      res.innerHTML='<div style="font-size:46px;line-height:1">🦅</div><div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:8px">掉进断线黑洞了</div><div style="font-size:15px;color:var(--dim);margin-top:6px">穿过 <b style="color:var(--amber)">'+score/10+'</b> 道命令题</div><div style="display:flex;gap:10px;justify-window.content:center;margin-top:16px"><button class="mm-btn" onclick="window.fpAgain()">🔁 再来</button><button class="mm-btn primary" onclick="window.fpDone()">收下奖励</button></div>';
      overlay.innerHTML=''; overlay.appendChild(res); },300);
  }
  window.fpAgain=()=>{ overlay.remove(); openFlappy(cfg,onComplete); };
  window.fpDone=()=>{ if(onComplete)onComplete(score>=50); overlay.remove(); window.playAreaMusic(); };
  function closeGame(manual){ if(ended)return; ended=true; cancelAnimationFrame(raf); overlay.remove(); if(manual){if(onComplete)onComplete(false);window.playAreaMusic();} }
  let last=performance.now(), dt=0;
  function loop(now){ dt=Math.min(0.05,(now-last)/1000); last=now; update(dt); draw(); raf=requestAnimationFrame(loop); }
  let raf; raf=requestAnimationFrame(loop);
}
