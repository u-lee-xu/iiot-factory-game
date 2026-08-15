// ═══════════════════════════════════════════════════════════════════
// games/tank — 拆自 app.js（openTank）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openTank(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('tank')) {
    window.showGameTutorial('tank', '🎯 消息守卫战', [
      '你的<b>坦克</b>守卫车间中央的 <b>MQTT Broker</b>，用 <b>WASD/←→↑↓</b>（手机<b>滑动</b>）移动',
      '<b>自动开炮</b>打掉涌来的垃圾消息（垃圾订阅/断线黑洞/畸形消息）',
      '消息<b>碰到 Broker 基地</b> -1 基地血；碰到坦克 -1 坦克命',
      '清完一波进下一波，越来越快'
    ], function(){ openTank(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('tank') || 'boss');
  const topics=(cfg.topics||['factory/+/temp']).map(String);
  const en=(cfg.enemies||[{topic:'factory/a/temp',name:'温度消息'}]).map(function(e){return {topic:e.topic||'factory/a/temp',name:e.name||e.topic};});
  const W=840,H=560;
  let lives=3, base=3, score=0, wave=1, ended=false;
  let tx=W/2, ty=H-60, dir={x:0,y:-1}, fireCd=0, invuln=0;
  let topicIdx=0, cannonTopic=topics[0];   // 炮口主题：只打匹配主题的消息
  let bullets=[], foes=[], spawnT=0, toSpawn=6, particles=[];
  const overlay=document.createElement('div');
  overlay.className='mm-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML=`
    <div class="sh-box">
      <div class="mm-head"><div><div class="mm-title">🎯 消息守卫战</div><div class="mm-sub">${escHtml(cfg.name||'')} —— 坦克守 Broker</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="sh-stats"><span>🚗 <b id="tkLives">3</b></span><span>🏰 <b id="tkBase">3</b></span><span>🎯 <b id="tkTopic" style="color:#7ee8fa">${cannonTopic}</b></span><span>🌊 第 <b id="tkWave">1</b> 波</span></div>
      <div class="canvas-wrap" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#071019;touch-action:none"><canvas id="tkCanvas" width="${W}" height="${H}" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;touch-action:none"></canvas></div>
      <div class="sh-tip">↑/↓ 切炮口主题 · 只打<b>匹配主题</b>的消息 · 守 Broker 别漏</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick=()=>closeGame(false);
  const cv=document.getElementById('tkCanvas'), ctx=cv.getContext('2d');
  const cw=cv.clientWidth||W; const sf=Math.max(0.6,cw/W);
  const livesEl=document.getElementById('tkLives'), baseEl=document.getElementById('tkBase'), scoreEl=document.getElementById('tkScore'), waveEl=document.getElementById('tkWave');
  const keys={};
  document.addEventListener('keydown', e=>{ keys[e.key]=true;
    if(e.key==='ArrowUp'||e.key==='w'){ topicIdx=(topicIdx+1)%topics.length; cannonTopic=topics[topicIdx]; var _t=document.getElementById('tkTopic'); if(_t)_t.textContent=cannonTopic; playSound('click'); }
    else if(e.key==='ArrowDown'||e.key==='s'){ topicIdx=(topicIdx+topics.length-1)%topics.length; cannonTopic=topics[topicIdx]; var _t2=document.getElementById('tkTopic'); if(_t2)_t2.textContent=cannonTopic; playSound('click'); }
    else if(e.key==='Escape')closeGame(false); });
  document.addEventListener('keyup', e=>{ keys[e.key]=false; });
  let joystick=null;
  cv.addEventListener('pointerdown',e=>{ joystick={x:e.clientX,y:e.clientY}; });
  cv.addEventListener('pointermove',e=>{ if(!joystick)return; const dx=e.clientX-joystick.x, dy=e.clientY-joystick.y; if(Math.abs(dx)>Math.abs(dy)) dir={x:Math.sign(dx),y:0}; else if(dy!==0) dir={x:0,y:Math.sign(dy)}; joystick.x=e.clientX; joystick.y=e.clientY; });
  cv.addEventListener('pointerup',()=>{ joystick=null; });
  function addParticles(x,y,c){ for(let i=0;i<12;i++)particles.push({x,y,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*220,t:0,color:c}); }
  function spawnFoe(){ const x=40+Math.random()*(W-80); const e=en[Math.floor(Math.random()*en.length)]; foes.push({x,y:-20,vy:40+wave*8,topic:e.topic,label:e.name}); }
  function update(dt){
    if(ended)return;
    if(invuln>0)invuln-=dt;
    // 移动
    let mvx=0,mvy=0;
    if(keys['a']||keys['ArrowLeft'])mvx=-1; if(keys['d']||keys['ArrowRight'])mvx=1;
    if(keys['w']||keys['ArrowUp'])mvy=-1; if(keys['s']||keys['ArrowDown'])mvy=1;
    if(mvx||mvy){ dir={x:mvx,y:mvy}; tx+=mvx*150*dt; ty+=mvy*150*dt; }
    tx=Math.max(20,Math.min(W-20,tx)); ty=Math.max(20,Math.min(H-30,ty));
    // 自动开炮
    fireCd-=dt; if(fireCd<=0){ fireCd=0.32; const bx=tx+dir.x*20, by=ty+dir.y*20; bullets.push({x:bx,y:by,vx:dir.x*340,vy:dir.y*340}); }
    // 生成敌人
    spawnT-=dt; if(spawnT<=0 && toSpawn>0){ spawnFoe(); toSpawn--; spawnT=Math.max(0.4,1.4-wave*0.08); }
    bullets.forEach(b=>{ b.x+=b.vx*dt; b.y+=b.vy*dt; });
    bullets=bullets.filter(b=>b.x>-20&&b.x<W+20&&b.y>-20&&b.y<H+20);
    foes.forEach(f=>{ f.y+=f.vy*dt; });
    foes=foes.filter(f=>f.y<H+20);
    // 子弹命中
    bullets.forEach(b=>{ foes.forEach(f=>{ if(!f.hit&&Math.abs(b.x-f.x)<22&&Math.abs(b.y-f.y)<22){ if(f.topic===cannonTopic){ f.hit=true; b.hit=true; score+=10; scoreEl.textContent=score; addParticles(f.x,f.y,'#ffb000'); playSound('success'); } else { b.hit=true; addParticles(f.x,f.y,'#7ee8fa'); playSound('click'); } } }); });
    bullets=bullets.filter(b=>!b.hit); foes=foes.filter(f=>!f.hit);
    // 敌人到基地
    foes.forEach(f=>{ if(f.y>H-28){ f.hit=true; base--; baseEl.textContent=base; addParticles(f.x,H-28,'#ff5252'); playSound('error'); if(base<=0){endGame(false);return;} } });
    foes=foes.filter(f=>!f.hit);
    // 敌人碰坦克
    foes.forEach(f=>{ if(invuln<=0&&Math.abs(f.x-tx)<26&&Math.abs(f.y-ty)<26){ f.hit=true; lives--; livesEl.textContent=lives; invuln=1.5; addParticles(tx,ty,'#ff5252'); playSound('error'); if(lives<=0){endGame(false);return;} } });
    foes=foes.filter(f=>!f.hit);
    // 清波
    if(toSpawn<=0 && foes.length===0){ wave++; waveEl.textContent=wave; toSpawn=6+wave*2; window.showToast('🌊 第 '+wave+' 波消息来袭！','success'); playSound('levelup'); }
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    // 基地 Broker
    ctx.fillStyle='rgba(0,188,212,.15)'; ctx.fillRect(0,H-30,W,30);
    ctx.fillStyle='#00bcd4'; ctx.shadowColor='#00bcd4'; ctx.shadowBlur=14; ctx.beginPath(); ctx.arc(W/2,H-15,14,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    ctx.fillStyle='#fff'; ctx.font='bold '+Math.round(10/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('Broker',W/2,H-15);
    // 坦克
    if(invuln<=0||Math.floor(invuln*8)%2===0){ ctx.fillStyle='#00e676'; ctx.fillRect(tx-14,ty-12,28,24); ctx.fillStyle='#b2ff59'; ctx.fillRect(tx+dir.x*16-4,ty+dir.y*16-6,8,12); }
    // 子弹
    ctx.fillStyle='#ffe066'; bullets.forEach(b=>ctx.fillRect(b.x-3,b.y-3,6,6));
    // 敌人（匹配炮口主题的亮红，否则灰）
    foes.forEach(f=>{ const match=f.topic===cannonTopic; ctx.fillStyle=match?'#ff5252':'#546e7a'; ctx.shadowColor=match?'#ff5252':'transparent'; ctx.shadowBlur=8; ctx.fillRect(f.x-18,f.y-10,36,20); ctx.shadowBlur=0; ctx.fillStyle='#fff'; ctx.font='bold '+Math.round(8/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText((f.topic||'').length>6?(f.topic||'').slice(0,6):f.topic||'', f.x, f.y); });
    // 粒子
    particles.forEach(p=>{ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; ctx.globalAlpha=Math.max(0,1-p.t/0.5); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,5,5); });
    ctx.globalAlpha=1; particles=particles.filter(p=>p.t<0.5);
  }
  function endGame(isWin){ if(ended)return; ended=true; if(isWin){window.recordGameWin('tank');window.miniMarkClear(cfg.id);playSound('fanfare');}
    setTimeout(()=>{ const res=document.createElement('div'); res.className='ty-result';
      window.focusResultPrimary(overlay);
      res.innerHTML='<div style="font-size:46px;line-height:1">🎯</div><div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:8px">'+(base>0?'Broker 守住了！':'Broker 被攻破了')+'</div><div style="font-size:15px;color:var(--dim);margin-top:6px">守到第 <b style="color:var(--amber)">'+wave+'</b> 波 · 得分 <b style="color:var(--amber)">'+score+'</b></div><div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.tkAgain()">🔁 再战</button><button class="mm-btn primary" onclick="window.tkDone()">收下奖励</button></div>';
      overlay.innerHTML=''; overlay.appendChild(res); },300); }
  window.tkAgain=()=>{ overlay.remove(); openTank(cfg,onComplete); };
  window.tkDone=()=>{ if(onComplete)onComplete(base>0); overlay.remove(); window.playAreaMusic(); };
  function closeGame(manual){ if(ended)return; ended=true; cancelAnimationFrame(raf); overlay.remove(); if(manual){if(onComplete)onComplete(false);window.playAreaMusic();} }
  let last=performance.now(), dt=0;
  function loop(now){ dt=Math.min(0.05,(now-last)/1000); last=now; update(dt); draw(); raf=requestAnimationFrame(loop); }
  let raf; raf=requestAnimationFrame(loop);
}
