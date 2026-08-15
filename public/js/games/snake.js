// ═══════════════════════════════════════════════════════════════════
// games/snake — 拆自 app.js（openSnake）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openSnake(cfg, onComplete) {
  // ================= 难度与配置 =================
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('snake')) {
    window.showGameTutorial('snake', '🐍 网线贪吃蛇', [
      '用 <b>←/→/↑/↓</b>（手机<b>滑动</b>）控制蛇，撞墙/撞自己 -1 命',
      '<b>吃蓝色术语</b>（如「网关」）带着它，头顶会显示当前带的词',
      '再吃<b>黄色解释</b>——<b>匹配</b>当前术语就配对成功 +25 连击；吃错解释会清掉带的词',
      '配对 <b>6 对</b> 通关；每 3 对厂长会出题，答对给奖励'
    ], function(){ openSnake(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('snake') || 'hub');

  // ---- 词库 & 配对表 ----
  const pairs = (cfg.pairs || []).map(function(p){ return {id:p.id||'', t:String(p.t||''), h:String(p.h||'')}; }).filter(function(p){ return p.t && p.h; });
  const terms = pairs.map(p=>p.t), hints = pairs.map(p=>p.h);
  const hintOf = {}, idOf = {};
  pairs.forEach(p=>{ hintOf[p.t]=p.h; idOf[p.t]=p.id; });
  const WIN = cfg.win || 6;

  // ---- 画布 / 网格（文字整体放大）----
  const W = 840, H = 560, cell = 30, COLS = Math.floor(W/cell), ROWS = Math.floor(H/cell);
  const F_FOOD = 15, F_FLOAT = 19;      // 屏上字号(px)：旧版 8/13 过小，明显放大

  // ---- 游戏状态 ----
  let lives = 3, score = 0, combo = 0, paired = 0, ended = false, quizLock = false;
  let currentTerm = '';
  let snake = [{x:6,y:6},{x:5,y:6},{x:4,y:6}], dir = {x:1,y:0}, nextDir = {x:1,y:0};
  let speed = 4, timer = 0, invuln = 0, spawnTimer = 0;
  let foods = [], particles = [], floats = [];

  // ================= 界面 =================
  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-window.content:center';
  overlay.innerHTML = `
    <div class="sh-box">
      <div class="mm-head"><div><div class="mm-title">🐍 网线贪吃蛇</div><div class="mm-sub">${escHtml(cfg.name||'')} —— 吃术语，配对解释</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="sh-stats">
        <span>❤️ <b id="snLives">3</b></span>
        <span>🧩 带词 <b id="snTerm" style="color:#7ee8fa">—</b></span>
        <span>✅ <b id="snPair">0</b>/${WIN}</span>
        <span>🎯 <b id="snScore">0</b></span>
        <span>🔥 <b id="snCombo" style="color:#ff7a00"></b></span>
      </div>
      <div class="canvas-wrap" style="flex:1;min-height:0;display:flex;align-items:center;justify-window.content:center;overflow:hidden;background:#050a12;touch-action:none"><canvas id="snCanvas" width="${W}" height="${H}" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;touch-action:none"></canvas></div>
      <div class="sh-tip">吃蓝色术语带着它 → 吃黄色解释配对 · 每3对厂长出题</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const cv = document.getElementById('snCanvas'), ctx = cv.getContext('2d');
  const cw = cv.clientWidth || W; const sf = Math.max(0.6, cw/W);
  const livesEl=document.getElementById('snLives'), scoreEl=document.getElementById('snScore'), termEl=document.getElementById('snTerm'), pairEl=document.getElementById('snPair'), comboEl=document.getElementById('snCombo');

  // ================= 输入 =================
  function kd(e){
    if (quizLock) return;
    if(e.key==='ArrowUp'||e.key==='w'){nextDir={x:0,y:-1};e.preventDefault();}
    else if(e.key==='ArrowDown'||e.key==='s'){nextDir={x:0,y:1};e.preventDefault();}
    else if(e.key==='ArrowLeft'||e.key==='a'){nextDir={x:-1,y:0};e.preventDefault();}
    else if(e.key==='ArrowRight'||e.key==='d'){nextDir={x:1,y:0};e.preventDefault();}
    else if(e.key==='Escape') closeGame(false);
  }
  document.addEventListener('keydown', kd);
  let swipeStart=null;
  cv.addEventListener('pointerdown', e=>{ if(quizLock) return; swipeStart={x:e.clientX,y:e.clientY}; });
  cv.addEventListener('pointerup', e=>{ if(!swipeStart) return; const dx=e.clientX-swipeStart.x, dy=e.clientY-swipeStart.y; if(Math.abs(dx)>Math.abs(dy)) nextDir={x:Math.sign(dx),y:0}; else if(dy!==0) nextDir={x:0,y:Math.sign(dy)}; swipeStart=null; });

  // ================= 食物 =================
  function isOnSnake(x,y){ return snake.some(s=>s.x===x&&s.y===y); }
  function spawnFood(kind){
    // 找一个空位（避开蛇身和已有食物），最多试 60 次
    // 避开边缘 2 格：食物上方的文字不会被顶部/两侧裁掉
    const X_MIN=2, X_MAX=COLS-3, Y_MIN=1, Y_MAX=ROWS-2;
    let x,y,tries=0;
    do { x=X_MIN+Math.floor(Math.random()*(X_MAX-X_MIN+1)); y=Y_MIN+Math.floor(Math.random()*(Y_MAX-Y_MIN+1)); tries++; }
    // 避开蛇身、已有食物、以及与已有食物文字重叠（x/y 至少隔 2 格，文字在上方不打架）
    while((isOnSnake(x,y) || foods.some(f=>f.x===x&&f.y===y) || foods.some(f=>Math.abs(f.x-x)<2&&Math.abs(f.y-y)<2)) && tries<90);
    // 场上不要出现两个一样的词/解释，避免配对歧义
    const busy = {}; foods.forEach(f=>{ busy[f.label]=true; });
    if(kind==='term'){
      const pool = terms.filter(t=>!busy[t]);
      const t = pool.length ? pool[Math.floor(Math.random()*pool.length)] : terms[Math.floor(Math.random()*terms.length)];
      foods.push({x,y,kind:'term',label:t});
    } else {
      // 优先放"场上已有术语对应的解释"，保证蓝黄能配对
      const fieldTerm = foods.find(f=>f.kind==='term');
      let h = null;
      if(fieldTerm && !busy[hintOf[fieldTerm.label]]) h = hintOf[fieldTerm.label];
      if(!h){
        // 否则从场上所有术语的解释里选一个还没在场的
        const fieldHints = foods.filter(f=>f.kind==='term').map(f=>hintOf[f.label]).filter(hh=>!busy[hh]);
        if(fieldHints.length) h = fieldHints[Math.floor(Math.random()*fieldHints.length)];
      }
      if(!h){ const pool = hints.filter(hh=>!busy[hh]); h = pool.length ? pool[Math.floor(Math.random()*pool.length)] : hints[Math.floor(Math.random()*hints.length)]; }
      foods.push({x,y,kind:'hint',label:h});
    }
  }
  function ensureFoods(){
    if(!foods.some(f=>f.kind==='term')) spawnFood('term');
    if(!foods.some(f=>f.kind==='hint')) spawnFood('hint');
    // 若玩家正带着词，确保场上出现它对应的解释（能完成配对）
    if(currentTerm && !foods.some(f=>f.kind==='hint' && f.label===hintOf[currentTerm])){
      const busy={}; foods.forEach(f=>{busy[f.label]=true;});
      if(!busy[hintOf[currentTerm]]) spawnFood('hint');
    }
    while(foods.length<5){
      // 补位时也优先凑可配对的一对（蓝+对应黄）
      const ft=foods.find(f=>f.kind==='term');
      const hasMatch = ft && foods.some(f=>f.kind==='hint'&&f.label===hintOf[ft.label]);
      if(ft && !hasMatch) spawnFood('hint');
      else spawnFood(Math.random()<0.5?'term':'hint');
    }
  }
  function addParticles(x,y,c){ for(let i=0;i<14;i++)particles.push({x:x*cell+cell/2,y:y*cell+cell/2,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*220,t:0,color:c}); }
  // 飘字：注意参数是 txt，对象里写 txt:txt（旧版误写 txt:t → 吃食物即 ReferenceError 死机）
  function float(x,y,txt,c){ floats.push({x:x*cell+cell/2,y:y*cell+cell/2,txt:txt,color:c,t:0}); }

  // ================= 厂长问答（每 3 对）=================
  function askFactoryQuiz(){
    if(ended) return;
    quizLock = true;
    const q = pairs[Math.floor(Math.random()*pairs.length)];
    const pool = pairs.filter(p=>p.t!==q.t).map(p=>p.h);
    const opts = [q.h].concat(pool.slice(0,3));
    for(let i=opts.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [opts[i],opts[j]]=[opts[j],opts[i]]; }
    const ov=document.createElement('div');
    ov.className='mm-overlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9700;display:flex;align-items:center;justify-window.content:center';
    ov.innerHTML='<div class="mm-box" style="width:min(480px,92vw)"><div class="mm-head"><div><div class="mm-title">🤔 厂长提问</div><div class="mm-sub">答对额外 +1 命 / +30 分</div></div></div><div class="pd-body"><div style="font-size:16px;font-weight:bold;color:var(--amber);margin-bottom:10px">「'+escHtml(q.t)+'」是什么意思？</div><div style="display:flex;flex-direction:column;gap:8px" id="snqOpts"></div></div></div>';
    document.body.appendChild(ov);
    const box=ov.querySelector('#snqOpts');
    opts.forEach(function(h){
      const b=document.createElement('button'); b.className='mm-btn'; b.style.cssText='text-align:left;white-space:normal;height:auto;line-height:1.4;padding:10px 14px';
      b.textContent=h;
      b.onclick=function(){
        ov.remove(); quizLock=false;
        if(h===q.h){ lives=Math.min(6,lives+1); livesEl.textContent=lives; score+=30; scoreEl.textContent=score; playSound('fanfare'); float(snake[0].x,snake[0].y,'✅ 答对 +1命/+30！','#00e676'); }
        else { playSound('click'); float(snake[0].x,snake[0].y,'厂长：再想想，是「'+hintOf[q.t]+'」','#ffd27d'); }
      };
      box.appendChild(b);
    });
  }

  // ================= 吃食物 / 配对 =================
  function eat(f){
    if(f.kind==='term'){
      // 吃蓝色术语：带着它（若已带别的词则换带）
      const prev = currentTerm;
      currentTerm=f.label; termEl.textContent=f.label; termEl.style.color='#7ee8fa';
      score+=5; scoreEl.textContent=score; playSound('click');
      float(f.x,f.y, prev ? '换带「'+f.label+'」' : '带着「'+f.label+'」，去找解释', '#7ee8fa');
    } else if(currentTerm && hintOf[currentTerm]===f.label){
      // 配对成功
      combo++; score += 25 + (combo>=5?10:combo>=3?5:0); paired++;
      scoreEl.textContent=score; comboEl.textContent=combo>=2?'x'+combo:''; pairEl.textContent=paired;
      addParticles(f.x,f.y,'#00e676'); float(f.x,f.y,'✅ '+currentTerm+'='+hintOf[currentTerm],'#00e676');
      playSound('success');
      if(idOf[currentTerm]) window.unlockPedia(window.currentLevelId, [idOf[currentTerm]]);   // 收录图鉴
      currentTerm=''; termEl.textContent='—'; termEl.style.color='#7ee8fa';
      if(paired>=WIN){ endGame(true); return; }
      if(paired%3===0) setTimeout(askFactoryQuiz, 350);   // 特效播完再出题，避免打断
    } else if(currentTerm){
      // 吃错解释：清掉带的词
      score+=2; scoreEl.textContent=score; combo=0; if(comboEl)comboEl.textContent='';
      float(f.x,f.y,'❌ 不是「'+currentTerm+'」的解释','#ff5252'); playSound('error');
      currentTerm=''; termEl.textContent='—';
    } else {
      score+=2; scoreEl.textContent=score; float(f.x,f.y,'先吃蓝色术语，再吃解释','#ffd27d');
    }
  }

  // ================= 移动 / 碰撞 =================
  function loseLife(){
    playSound('error'); invuln=1.5; lives--; livesEl.textContent=lives; addParticles(snake[0].x,snake[0].y,'#ff5252');
    if(lives<=0){ endGame(false); return; }
    snake=snake.slice(0,3); currentTerm=''; termEl.textContent='—';
  }
  function step(){
    const head={x:snake[0].x+dir.x, y:snake[0].y+dir.y};
    if(head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS){ loseLife(); return; }
    if(snake.some(s=>s.x===head.x&&s.y===head.y)){ loseLife(); return; }
    snake.unshift(head);
    let ate=null;
    for(let i=0;i<foods.length;i++){ const f=foods[i]; if(!f.hit && f.x===head.x && f.y===head.y){ f.hit=true; ate=f; break; } }
    if(ate){ eat(ate); if(ended) return; }
    foods=foods.filter(f=>!f.hit);
    if(!ate) snake.pop();
    // 补充食物
    spawnTimer-=dt; if(spawnTimer<=0){ ensureFoods(); spawnTimer=0.6; }
    if(cfg._endless && paired>0 && paired%10===0) speed = 1.9 + paired*0.2;   // 无限战略快
  }
  function update(dt){
    if(ended || quizLock) return;
    if(invuln>0) invuln-=dt;
    if(!(nextDir.x===-dir.x && nextDir.y===-dir.y)) dir=nextDir;
    speed = 1.9 + paired*0.1; timer += dt; const stepT=1/speed;
    if(timer<stepT) return; timer-=stepT;
    step();
  }

  // ================= 渲染 =================
  function draw(){
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle='rgba(0,188,212,.06)'; ctx.lineWidth=1;
    for(let x=0;x<=W;x+=cell){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<=H;y+=cell){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    // 底部网格微光
    ctx.fillStyle='rgba(0,188,212,.03)'; ctx.fillRect(0,0,W,H);
    // 食物：蓝=术语 / 黄=解释，圆点 + 上方完整文字（深色描边便于阅读）
    foods.forEach(function(f){
      const fx=f.x*cell+cell/2, fy=f.y*cell+cell/2;
      const isTerm = f.kind==='term';
      const pulse = 1 + 0.12*Math.sin(performance.now()/260 + f.x*1.7 + f.y*2.3);
      const rad = 12*pulse;
      // 外发光环
      ctx.fillStyle = isTerm ? 'rgba(33,150,243,.22)' : 'rgba(255,179,0,.22)';
      ctx.beginPath(); ctx.arc(fx,fy,rad+7,0,Math.PI*2); ctx.fill();
      // 主体
      ctx.fillStyle = isTerm ? '#2196f3' : '#ffb300';
      ctx.shadowColor = isTerm ? '#2196f3' : '#ffb300'; ctx.shadowBlur=12;
      ctx.beginPath(); ctx.arc(fx,fy,rad,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
      // 高光
      ctx.fillStyle='rgba(255,255,255,.55)';
      ctx.beginPath(); ctx.arc(fx-rad*0.3,fy-rad*0.35,rad*0.28,0,Math.PI*2); ctx.fill();
      ctx.font='bold '+Math.round(F_FOOD/sf)+'px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='alphabetic';
      ctx.lineWidth=4; ctx.strokeStyle='rgba(0,0,0,.88)';
      ctx.strokeText(f.label, fx, fy-20);
      ctx.fillStyle='#fff'; ctx.fillText(f.label, fx, fy-20);
    });
    // 蛇身：卡通圆润——身体用带内高光的圆角胶囊，尾部渐细，蛇头大圆+大眼睛+腮红+小舌头
    const segN=snake.length;
    // 身体关节：为让身体连贯，取每段中心画圆角胶囊
    const drawSeg = function(s,i){
      const isHead = (i===0);
      const cx=s.x*cell+cell/2, cy=s.y*cell+cell/2;
      const tailT = Math.max(0.35, 1 - i/segN);           // 尾部略小
      const r = isHead ? cell*0.5 : cell*0.38*tailT;
      // 前一节（用于连接圆角）
      const prev = snake[i+1];
      const bodyColor = isHead ? (currentTerm?'#00e5ff':'#8cff5e') : 'rgba(0,205,102,'+(0.4+0.6*tailT).toFixed(2)+')';
      ctx.fillStyle = bodyColor;
      if(isHead && currentTerm){ ctx.shadowColor='#4dd0e1'; ctx.shadowBlur=16; }
      if(prev){
        // 在两节之间画一个胶囊（连接相邻节，使身体连续）
        const pcx=prev.x*cell+cell/2, pcy=prev.y*cell+cell/2;
        const ang=Math.atan2(cy-pcy, cx-pcx);
        const len=Math.hypot(cx-pcx, cy-pcy);
        const rr=r*0.8;
        ctx.beginPath();
        ctx.moveTo(cx+Math.cos(ang+Math.PI/2)*rr, cy+Math.sin(ang+Math.PI/2)*rr);
        ctx.lineTo(pcx+Math.cos(ang+Math.PI/2)*rr, pcy+Math.sin(ang+Math.PI/2)*rr);
        ctx.lineTo(pcx+Math.cos(ang-Math.PI/2)*rr, pcy+Math.sin(ang-Math.PI/2)*rr);
        ctx.lineTo(cx+Math.cos(ang-Math.PI/2)*rr, cy+Math.sin(ang-Math.PI/2)*rr);
        ctx.closePath(); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
      // 内高光（顶部小圆）卡通质感
      ctx.fillStyle='rgba(255,255,255,.28)';
      ctx.beginPath(); ctx.arc(cx-r*0.28, cy-r*0.32, r*0.32, 0, Math.PI*2); ctx.fill();
      if(isHead){
        ctx.shadowBlur=0;
        const ex = dir.x, ey = dir.y;
        const eo = cell*0.30, er = 4.2;
        // 大眼睛（两个，朝方向偏移）
        [[-0.5,0.6],[0.5,0.6]].forEach(function(off){
          const exx = ex*eo + off[0]*cell*0.26;
          const eyy = ey*eo + off[1]*cell*0.26;
          const eX=cx+exx, eY=cy+eyy;
          ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(eX,eY,er,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#123'; ctx.beginPath(); ctx.arc(eX+ex*1.2,eY+ey*1.2,er*0.62,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(eX+ex*2.2-eY*0+ex*0.4,eY+ey*2.2-2,1.4,0,Math.PI*2); ctx.fill();
        });
        // 腮红
        ctx.fillStyle='rgba(255,120,120,.4)';
        ctx.beginPath(); ctx.arc(cx - cell*0.42, cy+cell*0.34, 3.4, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + cell*0.42, cy+cell*0.34, 3.4, 0, Math.PI*2); ctx.fill();
        // 小舌头（朝方向）
        ctx.strokeStyle='#ff5a5a'; ctx.lineWidth=2; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(cx+ex*cell*0.42, cy+ey*cell*0.42);
        ctx.lineTo(cx+ex*cell*0.62, cy+ey*cell*0.62); ctx.stroke();
        // 头顶呆毛
        ctx.strokeStyle='rgba(140,255,94,.9)'; ctx.lineWidth=2.4; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(cx - cell*0.15, cy - cell*0.5);
        ctx.quadraticCurveTo(cx - cell*0.28, cy - cell*0.72, cx - cell*0.05, cy - cell*0.6); ctx.stroke();
      }
      ctx.shadowBlur=0;
    };
    for(let i=0;i<segN;i++){ const s=snake[i]; drawSeg(s,i); }
    // 粒子
    particles.forEach(function(p){ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; ctx.globalAlpha=Math.max(0,1-p.t/0.5); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,5,5); });
    ctx.globalAlpha=1; particles=particles.filter(function(p){return p.t<0.5;});
    // 飘字（放大）
    floats.forEach(function(f){ f.t+=dt; ctx.globalAlpha=Math.max(0,1-f.t/1.3); ctx.fillStyle=f.color; ctx.font='bold '+Math.round(F_FLOAT/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.fillText(f.txt, f.x, f.y-f.t*40); });
    ctx.globalAlpha=1; floats=floats.filter(function(f){return f.t<1.3;});
  }

  // ================= 结算 =================
  function endGame(isWin){
    if(ended) return; ended=true;
    if(isWin){ window.recordGameWin('snake'); window.miniMarkClear(cfg.id); playSound('fanfare'); }
    setTimeout(function(){
      const res=document.createElement('div'); res.className='ty-result';
      res.innerHTML='<div style="font-size:46px;line-height:1">🐍</div><div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'网络三件套配对完成！':'网线断了，重接一下')+'</div><div style="font-size:15px;color:var(--dim);margin-top:6px">配对 <b style="color:var(--amber)">'+paired+'</b> 对 · 得分 <b style="color:var(--amber)">'+score+'</b></div><div style="font-size:13px;color:var(--dim);margin-top:4px">'+'记住的术语已收录图鉴'+(isWin?'':'，配对 '+WIN+' 对即通关')+'</div><div style="display:flex;gap:10px;justify-window.content:center;margin-top:16px"><button class="mm-btn" onclick="window.snAgain()">🔁 再来</button><button class="mm-btn primary" onclick="window.snDone()">收下奖励</button></div>';
      window.focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    },300);
  }
  function cleanup(){ document.removeEventListener('keydown', kd); }
  window.snAgain=function(){ cleanup(); overlay.remove(); openSnake(cfg,onComplete); };
  window.snDone=function(){ cleanup(); if(onComplete)onComplete(paired>=WIN); overlay.remove(); window.playAreaMusic(); };
  function closeGame(manual){ if(ended) return; ended=true; cancelAnimationFrame(raf); cleanup(); overlay.remove(); if(manual){ if(onComplete)onComplete(false); window.playAreaMusic(); } }

  // ================= 主循环（try/catch 防御：单点异常不再死机）=================
  ensureFoods();
  let last=performance.now(), dt=0;
  function loop(now){
    dt=Math.min(0.05,(now-last)/1000); last=now;
    try { update(dt); draw(); }
    catch(e){ console.error('[网线贪吃蛇] 循环异常：', e); }
    raf=requestAnimationFrame(loop);
  }
  let raf; raf=requestAnimationFrame(loop);
}
