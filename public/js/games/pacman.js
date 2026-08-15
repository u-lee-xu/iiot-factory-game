// ═══════════════════════════════════════════════════════════════════
// games/pacman.js — 容器吃豆人（吃镜像层 + 命令配对）
// 拆自 app.js；依赖 core/sound、core/utils；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { playSound, playMusic } from '../core/sound.js';
import { escHtml } from '../core/utils.js';

export function openPacman(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('pacman')) {
    window.showGameTutorial('pacman', '👾 容器吃豆人', [
      '在迷宫吃<b>镜像层</b>，<b>←/→/↑/↓</b> 或 <b>滑动</b> 移动',
      '躲开<b>清理进程</b>幽灵——碰到 -1 命',
      '吃 <b>端口映射</b>能量点后，幽灵变蓝，可以反吃它们 +50',
      '吃光全部镜像层过关，下一关更快'
    ], function(){ openPacman(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('pacman') || 'hub');
  const pairs=(cfg.pairs||[{t:'docker run',h:'启动一个容器'}]).map(function(p){return {t:String(p.t),h:String(p.h)};});
  const hintOf={}; pairs.forEach(function(p){hintOf[p.t]=p.h;});
  const ghostsN=(cfg.ghosts||['清理进程','镜像冲突','端口占用']).map(String);
  const W=840,H=560, COLS=19, ROWS=15, cell=Math.floor(Math.min(W,H)/Math.max(COLS,ROWS));
  // 迷宫 1=墙（简化：更开阔，避免复杂走廊）
  const base=[
    "1111111111111111111","1000000000000000001","1000000000000000001","1000011111111000001",
    "1000000000000000001","1000000000000000001","1000000000000000001","1000000000000000001",
    "1000000000000000001","1000000000000000001","1000011111111000001","1000000000000000001",
    "1000000000000000001","1000000000000000001","1111111111111111111"
  ];
  let map=[], dots=0, level=1, lives=3, score=0, ended=false;
  let px,py,pdir={x:1,y:0}, nextDir={x:1,y:0}, mouth=0;
  let moveTimer=0, ghostTimer=0, gameTime=0;   // 移动节奏计时器（降低速度）+ 已游玩秒数
  let ghosts=[], power=0;
  let particles=[], floats=[];
  let currentCmd='', specials=[], paired=0;
  function build(){
    map=[]; dots=0; specials=[]; currentCmd=''; paired=0;
    base.forEach((row,r)=>{ const arr=[]; for(let c=0;c<row.length;c++){ const ch=row[c]; arr.push(ch); if(ch==='0') dots++; } map.push(arr); });
    // 放 2 对命令×动作配对卡
    var cands=[];
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++) if(map[r]&&map[r][c]==='0') cands.push([c,r]);
    function place(kind,cmd,label){ if(!cands.length)return; const i=Math.floor(Math.random()*cands.length); const a=cands.splice(i,1)[0]; map[a[1]][a[0]]=' '; dots--; specials.push({x:a[0],y:a[1],kind:kind,cmd:cmd,label:label}); }
    pairs.slice(0,2).forEach(function(p){ place('cmd', p.t, p.t); place('act', p.t, p.h); });
    px=1; py=1; pdir={x:1,y:0}; nextDir={x:1,y:0};
    // 只 1 个幽灵，藏在中心，15s 后释放（给玩家熟悉迷宫的时间）
    ghosts=[{x:9,y:7,dir:{x:0,y:0},flee:false,n:ghostsN[0],sleep:15}];
    power=0;
  }
  build();
  const overlay=document.createElement('div');
  overlay.className='mm-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML=`
    <div class="sh-box">
      <div class="mm-head"><div><div class="mm-title">👾 容器吃豆人</div><div class="mm-sub">${escHtml(cfg.name||'')} —— 吃镜像层，躲清理进程</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="sh-stats"><span>❤️ <b id="pcLives">3</b></span><span>🧩 带命令 <b id="pcCmd" style="color:#7ee8fa">—</b></span><span>🎯 <b id="pcScore">0</b></span><span>🏆 第 <b id="pcLevel">1</b> 关</span></div>
      <div class="canvas-wrap" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#04060c;touch-action:none"><canvas id="pcCanvas" width="${W}" height="${H}" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;touch-action:none"></canvas></div>
      <div class="sh-tip">←/→/↑/↓ 或 滑动 · 吃蓝色命令带着 → 吃对应黄色动作配对</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick=()=>closeGame(false);
  const cv=document.getElementById('pcCanvas'), ctx=cv.getContext('2d');
  const cw=cv.clientWidth||W; const sf=Math.max(0.6,cw/W);
  const livesEl=document.getElementById('pcLives'), scoreEl=document.getElementById('pcScore'), levelEl=document.getElementById('pcLevel'), termEl=document.getElementById('pcCmd');
  document.addEventListener('keydown', e=>{
    const k=e.key; e.preventDefault();
    if(k==='ArrowUp'||k==='w')nextDir={x:0,y:-1}; else if(k==='ArrowDown'||k==='s')nextDir={x:0,y:1};
    else if(k==='ArrowLeft'||k==='a')nextDir={x:-1,y:0}; else if(k==='ArrowRight'||k==='d')nextDir={x:1,y:0};
    else if(k==='Escape')closeGame(false);
  });
  let sw=null;
  const swipeDist=22;   // 滑动判定阈值（px）
  cv.addEventListener('pointerdown',e=>{ sw={x:e.clientX,y:e.clientY}; try{ cv.setPointerCapture&&cv.setPointerCapture(e.pointerId); }catch(_){ } });
  cv.addEventListener('pointermove',e=>{ if(!sw)return; const dx=e.clientX-sw.x,dy=e.clientY-sw.y; if(Math.abs(dx)<swipeDist&&Math.abs(dy)<swipeDist)return; if(Math.abs(dx)>Math.abs(dy)) nextDir={x:Math.sign(dx),y:0}; else if(dy!==0) nextDir={x:0,y:Math.sign(dy)}; sw=null; });
  cv.addEventListener('pointerup',e=>{ if(!sw)return; const dx=e.clientX-sw.x,dy=e.clientY-sw.y; if(Math.abs(dx)>swipeDist||Math.abs(dy)>swipeDist){ if(Math.abs(dx)>Math.abs(dy))nextDir={x:Math.sign(dx),y:0}; else nextDir={x:0,y:Math.sign(dy)}; } sw=null; });
  function addParticles(cx,cy,c){ for(let i=0;i<10;i++)particles.push({x:cx,y:cy,vx:(Math.random()-.5)*140,vy:(Math.random()-.5)*140,t:0,color:c}); }
  function update(dt){
    if(ended)return;
    mouth+=dt*6;
    if(power>0)power-=dt;
    gameTime+=dt;   // 已游玩秒数（用于幽灵延迟出场）
    // 幽灵延迟出场：前 15s 待在中心屋，不出动
    ghosts.forEach(function(g){ if(g.sleep>0){ g.sleep-=dt; if(g.sleep<=0){ g.dir={x:0,y:0}; } } });
    // 移动（计时器控制节奏：初始间隔 0.16s，随关卡略快）
    moveTimer-=dt;
    if(moveTimer<=0){
      moveTimer = Math.max(0.10, 0.16 - level*0.008);
      if(!(nextDir.x===-pdir.x&&nextDir.y===-pdir.y)) pdir=nextDir;
      const nx=px+pdir.x, ny=py+pdir.y;
      if(map[ny] && map[ny][nx]!=='1'){ px=nx; py=ny; }
      else { pdir={x:0,y:0}; }
    }
    // 吃镜像层
    if(map[py] && map[py][px]==='0'){ map[py][px]=' '; dots--; score+=5; scoreEl.textContent=score; playSound('success');
      if((px+py)%13===0){ power=6; playSound('levelup'); }   // 能量点（端口映射）
    }
    // 配对卡：命令 / 动作
    var sp = specials.filter(function(x){return x.x===px&&x.y===py;})[0];
    if(sp){
      specials=specials.filter(function(x){return x!==sp;});
      if(sp.kind==='cmd'){ currentCmd=sp.cmd; score+=5; scoreEl.textContent=score; if(termEl)termEl.textContent=sp.label; playSound('click'); floats.push({x:px*cell+cell/2,y:py*cell+cell/2,txt:'带命令：'+sp.label,t:0,col:'#2196f3'}); }
      else {
        if(currentCmd && hintOf[currentCmd]===sp.label){ paired++; score+=25; scoreEl.textContent=score; currentCmd=''; if(termEl)termEl.textContent='—'; playSound('success'); addParticles(px*cell+cell/2,py*cell+cell/2,'#00e676'); floats.push({x:px*cell+cell/2,y:py*cell+cell/2,txt:'✅ '+hintOf[currentCmd===sp.cmd?sp.cmd:currentCmd]+' 配对成功',t:0,col:'#00e676'}); if(paired>=pairs.length){ power=6; playSound('levelup'); } }
        else { score=Math.max(0,score-5); scoreEl.textContent=score; currentCmd=''; if(termEl)termEl.textContent='—'; playSound('error'); floats.push({x:px*cell+cell/2,y:py*cell+cell/2,txt:'❌ 命令不匹配',t:0,col:'#ff5252'}); }
      }
    }
    // 幽灵移动（计时器控制，速度比玩家慢，简化 AI）
    ghostTimer-=dt;
    if(ghostTimer>0){ } else {
    ghosts.forEach(g=>{
      if(g.sleep>0) return;   // 未到出场时间：静止在屋
      if(g.flee && power<=0) g.flee=false;
      if(power>0 && !g.flee){ // 朝远离玩家走
        const opts=[]; [[0,-1],[0,1],[-1,0],[1,0]].forEach(d=>{ const nx2=g.x+d[0],ny2=g.y+d[1]; if(map[ny2]&&map[ny2][nx2]!=='1') opts.push(d); });
        let best=opts[Math.floor(Math.random()*opts.length)]; g.dir=best||g.dir;
      } else {
        const opts=[]; [[0,-1],[0,1],[-1,0],[1,0]].forEach(d=>{ const nx2=g.x+d[0],ny2=g.y+d[1]; if(map[ny2]&&map[ny2][nx2]!=='1') opts.push(d); });
        if(Math.random()<0.12 && opts.length) g.dir=opts[Math.floor(Math.random()*opts.length)];
        else { const dx=px-g.x, dy=py-g.y; const cands=opts.filter(d=>Math.abs(d[0]*dy)>=0 && Math.abs(d[1]*dx)>=0); if(cands.length) g.dir=cands[Math.floor(Math.random()*cands.length)]; }
      }
      const gx=g.x+g.dir[0], gy=g.y+g.dir[1];
      if(map[gy] && map[gy][gx]!=='1'){ g.x=gx; g.y=gy; }
    });
    ghostTimer = Math.max(0.16, 0.26 - level*0.01);
    }
    // 碰撞
    ghosts.forEach(g=>{
      if(g.sleep>0) return;   // 未出场不碰撞
      if(g.x===px&&g.y===py){
        if(power>0 && !g.flee){ score+=50; g.flee=true; playSound('fanfare'); addParticles(px*cell+cell/2,py*cell+cell/2,'#7ee8fa'); }
        else if(!g.flee){ lives--; livesEl.textContent=lives; playSound('error'); addParticles(px*cell+cell/2,py*cell+cell/2,'#ff5252');
          if(lives<=0){ endGame(false); return; } px=1;py=1; pdir={x:1,y:0}; nextDir={x:1,y:0}; }
      }
    });
    // 过关
    if(dots<=0 && specials.length===0){ level++; levelEl.textContent=level; score+=level*50; playSound('fanfare'); build(); }
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    const c=cell;
    for(let r=0;r<ROWS;r++)for(let col=0;col<COLS;col++){
      const ch=map[r]&&map[r][col];
      if(ch==='1'){ ctx.fillStyle='#0d47a1'; ctx.fillRect(col*c,r*c,c,c); }
      else if(ch==='0'){ ctx.fillStyle='#ffd27d'; ctx.beginPath(); ctx.arc(col*c+c/2,r*c+c/2,4,0,Math.PI*2); ctx.fill(); }
    }
    // 吃豆人
    const cxp=px*c+c/2, cyp=py*c+c/2;
    ctx.fillStyle='#ffb300'; ctx.beginPath(); ctx.arc(cxp,cyp,c/2-2, mouth*0.8, Math.PI*2-mouth*0.8); ctx.lineTo(cxp,cyp); ctx.fill();
    // 幽灵
    ghosts.forEach(g=>{ const gx=g.x*c+c/2, gy=g.y*c+c/2;
      if(g.sleep>0){   // 待机：半透明灰，头顶显示倒计时
        ctx.globalAlpha=0.5;
        ctx.fillStyle='#9aa3bd';
        ctx.beginPath(); ctx.arc(gx,gy-3,c/2-2,Math.PI,0); ctx.lineTo(gx+c/2-2,gy+c/2-2); ctx.lineTo(gx-c/2+2,gy+c/2-2); ctx.fill();
        ctx.fillStyle='#fff'; ctx.font='bold '+Math.round(10/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('⏱ '+Math.ceil(g.sleep), gx, gy-2);
        ctx.globalAlpha=1;
        return;
      }
      ctx.fillStyle = (power>0&&!g.flee) ? '#64b5f6' : g.flee ? '#bdbdbd' : '#ff5252';
      ctx.beginPath(); ctx.arc(gx,gy-3,c/2-2,Math.PI,0); ctx.lineTo(gx+c/2-2,gy+c/2-2); ctx.lineTo(gx-c/2+2,gy+c/2-2); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='bold '+Math.round(9/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(g.n.length>2?g.n[0]:g.n, gx, gy-2);
    });
    // 配对卡
    specials.forEach(sp=>{ const sx=sp.x*cell+cell/2, sy=sp.y*cell+cell/2;
      ctx.fillStyle = sp.kind==='cmd' ? '#2196f3' : '#ffb300';
      ctx.shadowColor = sp.kind==='cmd' ? '#2196f3' : '#ffb300'; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(sx,sy,9,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
      ctx.fillStyle='#fff'; ctx.font='bold '+Math.round(7/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(sp.label.length>3?sp.label.slice(0,3)+'…':sp.label, sx, sy);
    });
    // 能量点状态
    if(power>0){ ctx.fillStyle='#7ee8fa'; ctx.font='bold '+Math.round(14/sf)+'px sans-serif'; ctx.textAlign='left'; ctx.fillText('⚡ 幽灵可反吃 ' + power.toFixed(1)+'s', 10, 24); }
    particles.forEach(p=>{ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; ctx.globalAlpha=Math.max(0,1-p.t/0.5); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,4,4); });
    ctx.globalAlpha=1; particles=particles.filter(p=>p.t<0.5);
    floats.forEach(f=>{ f.t+=dt; ctx.globalAlpha=Math.max(0,1-f.t/1.3); ctx.fillStyle=f.col; ctx.font='bold '+Math.round(11/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.fillText(f.txt, f.x, f.y-f.t*30); });
    ctx.globalAlpha=1; floats=floats.filter(f=>f.t<1.3);
  }
  function endGame(isWin){
    if(ended)return; ended=true;
    if(isWin){ window.recordGameWin('pacman'); window.miniMarkClear(cfg.id); playSound('fanfare'); }
    setTimeout(()=>{ const res=document.createElement('div'); res.className='ty-result';
      window.focusResultPrimary(overlay);
      res.innerHTML='<div style="font-size:46px;line-height:1">👾</div><div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:8px">'+(isWin?'镜像全部回收！':'被清理进程回收了')+'</div><div style="font-size:15px;color:var(--dim);margin-top:6px">得分 <b style="color:var(--amber)">'+score+'</b> · 到第 <b style="color:var(--amber)">'+level+'</b> 关</div><div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.pcAgain()">🔁 再来</button><button class="mm-btn primary" onclick="window.pcDone()">收下奖励</button></div>';
      overlay.innerHTML=''; overlay.appendChild(res); },300);
  }
  window.pcAgain=()=>{ overlay.remove(); openPacman(cfg,onComplete); };
  window.pcDone=()=>{ if(onComplete)onComplete(isWin); overlay.remove(); window.playAreaMusic(); };
  function closeGame(manual){ if(ended)return; ended=true; cancelAnimationFrame(raf); overlay.remove(); if(manual){if(onComplete)onComplete(false);window.playAreaMusic();} }
  let last=performance.now(), dt=0;
  function loop(now){ dt=Math.min(0.05,(now-last)/1000); last=now; update(dt); draw(); raf=requestAnimationFrame(loop); }
  let raf; raf=requestAnimationFrame(loop);
}
