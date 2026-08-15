// ═══════════════════════════════════════════════════════════════════
// games/snake — 网线贪吃蛇（滚轴大世界 + 平滑移动 + 皮肤 + 配对规则）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openSnake(cfg, onComplete) {
  // ================= 难度与配置 =================
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  const WIN = cfg.win || 6;   // 提前定义，教程文案也要用
  if (!window.tutSeen('snake')) {
    window.showGameTutorial('snake', '🐍 网线贪吃蛇', [
      '用 <b>←/→/↑/↓</b>（手机<b>滑动</b>）控制蛇，撞墙/撞自己/撞边界 -1 命',
      '地图上会有<b>墙体</b>（砖块）挡路，配对越多墙越多——绕开它们',
      '<b>蓝色术语</b>（如「网关」）<b>可以随便吃</b>——吃下就「带着」它，头顶显示当前带的词',
      '<b>黄色解释要配对才能吃</b>：带着匹配的蓝色术语，再去吃对应的黄色解释 → 配对成功 +连击',
      '没带词吃黄色=吃不到（提示先吃蓝）；吃错解释会清空带的词',
      '<b>一开始场上只有 1 对</b>（1 蓝 + 1 黄）——先找蓝吃，再去吃它对应的黄',
      '配对越多难度越高：场上蓝黄对数变多，还会出现<b>多余的黄色干扰</b>，看准对应关系再吃',
      '世界很大，镜头会跟着蛇走；节奏也随配对加快',
      '<b>右上角小地图</b>看全局；配对 <b>'+WIN+' 对</b> 通关',
      '每 3 对厂长会出题，答对给奖励'
    ], function(){ openSnake(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('snake') || 'hub');

  // ---- 词库 & 配对表 ----
  const pairs = (cfg.pairs || []).map(function(p){ return {id:p.id||'', t:String(p.t||''), h:String(p.h||'')}; }).filter(function(p){ return p.t && p.h; });
  const terms = pairs.map(p=>p.t), hints = pairs.map(p=>p.h);
  const hintOf = {}, idOf = {};
  pairs.forEach(p=>{ hintOf[p.t]=p.h; idOf[p.t]=p.id; });

  // ===== 皮肤（钱包装备的蛇皮肤）=====
  const skid = (window.getEquippedSkin ? window.getEquippedSkin('snake') : 'default') || 'default';
  const SK = (window.SNAKE_SKINS && window.SNAKE_SKINS[skid]) || (window.SNAKE_SKINS && window.SNAKE_SKINS.default) || { name:'网线青绿', col:'#8cff5e', dark:'#1fa84f', belly:'#b9f6a5', glow:'#00e676', eye:'#ffffff' };

  // ================= 世界 / 视口（滚轴大世界）=================
  const cell = 30;
  const VIEW_COLS = 28, VIEW_ROWS = 18;
  const W = VIEW_COLS*cell, H = VIEW_ROWS*cell;      // 画布 840×540
  let worldW = 52, worldH = 36;                       // 世界：初期小，配对越多逐步扩大
  function worldSizeFor(paired){
    // 地图从小到大：配对越多，世界越大（配合蛇的行进/难度）
    if(paired>=6) return {w:140, h:88};
    if(paired>=4) return {w:108, h:70};
    if(paired>=2) return {w:80, h:52};
    return {w:52, h:36};
  }
  function expandWorld(){
    const s=worldSizeFor(paired);
    if(s.w!==worldW || s.h!==worldH){
      worldW=s.w; worldH=s.h;
      float(grid[0][0], grid[0][1], '🌍 地图扩大了！', '#7ee8fa');
    }
    spawnWalls();   // 墙随配对逐渐变多，地形有变化
  }
  // 墙体：避开蛇头附近与食物，生成 1~3 格小墙段；配对越多墙越多
  function spawnWalls(){
    const want = paired>=1 ? Math.min(2 + paired*2, 16) : 0;   // 后期墙多（上限16），初期少/无
    let guard=0;
    while(walls.length < want && guard++ < 60){
      const hx=grid[0][0], hy=grid[0][1];
      const wx=1 + Math.floor(Math.random()*(worldW-2));
      const wy=1 + Math.floor(Math.random()*(worldH-2));
      if(Math.abs(wx-hx)<7 && Math.abs(wy-hy)<7) continue;      // 蛇头周围留空
      const len=1+Math.floor(Math.random()*3);
      const horiz=Math.random()<0.5;
      let ok=true; const seg=[];
      for(let k=0;k<len;k++){
        const cx=wx+(horiz?k:0), cy=wy+(horiz?0:k);
        if(cx<1||cx>=worldW-1||cy<1||cy>=worldH-1){ ok=false; break; }
        if(isOnSnake(cx,cy) || foods.some(f=>f.x===cx&&f.y===cy) || walls.some(w=>w.x===cx&&w.y===cy)){ ok=false; break; }
        seg.push({x:cx,y:cy});
      }
      if(ok) seg.forEach(w=>walls.push(w));
    }
  }
  const F_FOOD = 15, F_FLOAT = 19;

  // ================= 游戏状态 =================
  let lives = 3, score = 0, combo = 0, paired = 0, ended = false, quizLock = false;
  let dt = 0;   // 帧间隔（模块级，step 也要用）
  let currentTerm = '';
  // 蛇：grid 为整数格序列（头在[0]）；headPos 为蛇头平滑浮点位置（格），蛇身沿路径回溯——保证移动连续无回跳
  const cx0 = Math.floor(worldW/2), cy0 = Math.floor(worldH/2);
  let grid = [[cx0,cy0],[cx0-1,cy0],[cx0-2,cy0]];
  let headPos = {x:cx0, y:cy0};
  let frac = 0;   // 本格推进进度 0~1
  let dir = {x:1,y:0}, nextDir = {x:1,y:0};
  let speed = 3.0, timer = 0, invuln = 0, spawnTimer = 0;   // speed: 格/秒（横纵一致）
  let foods = [], particles = [], floats = [], walls = [];
  let camX = 0, camY = 0;

  // ================= 界面 =================
  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
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
      <div class="canvas-wrap" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#050a12;touch-action:none"><canvas id="snCanvas" width="${W}" height="${H}" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;touch-action:none"></canvas></div>
      <div class="sh-tip">蓝色随便吃 · 黄色配对才吃 · 镜头跟随 · 小地图看全局</div>
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
  // 触摸/鼠标滑动：pointermove 实时转向（不必等抬手），阈值触发，可连续滑动连续转向
  let swipeStart=null, swipeActive=false;
  cv.addEventListener('pointerdown', e=>{ if(quizLock) return; swipeActive=true; swipeStart={x:e.clientX,y:e.clientY}; });
  cv.addEventListener('pointermove', e=>{
    if(!swipeActive || !swipeStart || quizLock) return;
    const dx=e.clientX-swipeStart.x, dy=e.clientY-swipeStart.y;
    const T=24;   // 转向阈值(px)，超过即转
    if(Math.abs(dx)<T && Math.abs(dy)<T) return;
    if(Math.abs(dx)>Math.abs(dy)) nextDir={x:Math.sign(dx),y:0};
    else nextDir={x:0,y:Math.sign(dy)};
    swipeStart={x:e.clientX,y:e.clientY};   // 允许连续滑动连续转向
    e.preventDefault();
  });
  cv.addEventListener('pointerup', e=>{ swipeActive=false; swipeStart=null; });
  cv.addEventListener('pointercancel', e=>{ swipeActive=false; swipeStart=null; });

  // ================= 食物（对数驱动：引导"先吃蓝、再找对应黄配对"）=================
  // 目标对数：初期 1 对（1 蓝 + 1 对应黄）→ 配对越多场上对数越多（最多 4 对）
  function targetPairs(){ return Math.min(1 + Math.floor(paired/3), 4); }   // 每 3 对 +1，放缓增量
  function isOnSnake(x,y){ return grid.some(g=>g[0]===x&&g[1]===y); }
  function pickSpot(){
    // 蛇头附近找空位（避开蛇身、已有食物、文字重叠），最多 90 次
    const h={x:grid[0][0], y:grid[0][1]};
    let x,y,tries=0;
    do {
      x = Math.max(1, Math.min(worldW-2, h.x + Math.floor((Math.random()*2-1)*22)));
      y = Math.max(1, Math.min(worldH-2, h.y + Math.floor((Math.random()*2-1)*14)));
      tries++;
    } while((isOnSnake(x,y) || foods.some(f=>f.x===x&&f.y===y) || foods.some(f=>Math.abs(f.x-x)<2&&Math.abs(f.y-y)<2)) && tries<90);
    return {x:x, y:y};
  }
  function spawnHint(label){
    const p=pickSpot(); foods.push({x:p.x, y:p.y, kind:'hint', label:label});
  }
  // 放一对（蓝 + 对应黄），优先选场上/玩家身上都没有的新术语
  function spawnPair(){
    const busy={}; foods.forEach(f=>{ busy[f.label]=true; });
    if(currentTerm) busy[currentTerm]=true;
    const pool=terms.filter(t=>!busy[t]);
    const t=pool.length ? pool[Math.floor(Math.random()*pool.length)] : terms[Math.floor(Math.random()*terms.length)];
    const p1=pickSpot(), p2=pickSpot();
    foods.push({x:p1.x, y:p1.y, kind:'term', label:t});
    foods.push({x:p2.x, y:p2.y, kind:'hint', label:hintOf[t]});
  }
  // 干扰黄：难度提升后场上黄色变多（不对应任何场上蓝的陷阱，黄色多于蓝色）
  function distractorCount(){ return Math.min(Math.floor(paired/3), 3); }
  function spawnDistractorHint(){
    // 只从"可用且不对应任何场上蓝"的黄色里选；没货返回 false（干扰黄数量自适应词库大小）
    const busy={}; foods.forEach(f=>{ busy[f.label]=true; });
    const termLabels = foods.filter(f=>f.kind==='term').map(f=>f.label);
    const protectedHints = {}; termLabels.forEach(t=>{ protectedHints[hintOf[t]]=true; });
    const pool = hints.filter(h=>!busy[h] && !protectedHints[h]);
    if(!pool.length) return false;
    const h = pool[Math.floor(Math.random()*pool.length)];
    const p=pickSpot(); foods.push({x:p.x, y:p.y, kind:'hint', label:h});
    return true;
  }
  function ensureFoods(){
    // 1) 玩家带词时，确保场上出现它对应的黄（配对可达，引导去找"合适的黄"）
    if(currentTerm){
      const th=hintOf[currentTerm];
      if(!foods.some(f=>f.kind==='hint' && f.label===th)) spawnHint(th);
    }
    // 2) 场上蓝数不足目标对数 → 补新对（吃蓝后"再给一个蓝"，配对后"再补一对"）
    while(foods.filter(f=>f.kind==='term').length < targetPairs()){
      spawnPair();
    }
    // 3) 每个场上的蓝都要有对应黄在场（不出现"孤儿蓝"，保证可配对通关）
    foods.filter(f=>f.kind==='term').forEach(function(ft){
      if(!foods.some(g=>g.kind==='hint' && g.label===hintOf[ft.label])) spawnHint(hintOf[ft.label]);
    });
    // 4) 干扰黄：难度提升后黄色明显多于蓝色（吃错会清词，需要分辨）；词库不足则少放
    const wantHints = targetPairs() + distractorCount();
    for(let i=0; i<wantHints; i++){
      const have = foods.filter(f=>f.kind==='hint').length;
      if(have >= wantHints) break;
      if(!spawnDistractorHint()) break;
    }
  }
  function addParticles(x,y,c){ for(let i=0;i<14;i++)particles.push({x:x*cell+cell/2,y:y*cell+cell/2,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*220,t:0,color:c}); }
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
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9700;display:flex;align-items:center;justify-content:center';
    ov.innerHTML='<div class="mm-box" style="width:min(480px,92vw)"><div class="mm-head"><div><div class="mm-title">🤔 厂长提问</div><div class="mm-sub">答对额外 +1 命 / +30 分</div></div></div><div class="pd-body"><div style="font-size:16px;font-weight:bold;color:var(--amber);margin-bottom:10px">「'+escHtml(q.t)+'」是什么意思？</div><div style="display:flex;flex-direction:column;gap:8px" id="snqOpts"></div></div></div>';
    document.body.appendChild(ov);
    const box=ov.querySelector('#snqOpts');
    opts.forEach(function(h){
      const b=document.createElement('button'); b.className='mm-btn'; b.style.cssText='text-align:left;white-space:normal;height:auto;line-height:1.4;padding:10px 14px';
      b.textContent=h;
      b.onclick=function(){
        ov.remove(); quizLock=false;
        if(h===q.h){ lives=Math.min(6,lives+1); livesEl.textContent=lives; score+=30; scoreEl.textContent=score; playSound('fanfare'); float(grid[0][0],grid[0][1],'✅ 答对 +1命/+30！','#00e676'); }
        else { playSound('click'); float(grid[0][0],grid[0][1],'厂长：再想想，是「'+hintOf[q.t]+'」','#ffd27d'); }
      };
      box.appendChild(b);
    });
  }

  // ================= 吃食物 / 配对（规则明确：蓝随便吃 · 黄配对才吃）=================
  function eat(f){
    if(f.kind==='term'){
      // 蓝色术语：随便吃，带着它（若已带别的词则换带）
      f.hit=true;
      const prev = currentTerm;
      currentTerm=f.label; termEl.textContent=f.label; termEl.style.color='#7ee8fa';
      score+=5; scoreEl.textContent=score; playSound('click');
      float(f.x,f.y, prev ? '换带「'+f.label+'」' : '带着「'+f.label+'」，去找黄色解释', '#7ee8fa');
    } else if(currentTerm && hintOf[currentTerm]===f.label){
      // 黄色解释：与带的词匹配 → 配对成功
      f.hit=true;
      combo++; score += 25 + (combo>=5?10:combo>=3?5:0); paired++;
      scoreEl.textContent=score; comboEl.textContent=combo>=2?'x'+combo:''; pairEl.textContent=paired;
      addParticles(f.x,f.y,'#00e676'); float(f.x,f.y,'✅ '+currentTerm+'='+hintOf[currentTerm],'#00e676');
      playSound('success');
      if(idOf[currentTerm]) window.unlockPedia(window.currentLevelId, [idOf[currentTerm]]);   // 收录图鉴
      currentTerm=''; termEl.textContent='—'; termEl.style.color='#7ee8fa';
      expandWorld();   // 地图随配对逐渐扩大
      if(paired>=WIN){ endGame(true); return; }
      if(paired%3===0) setTimeout(askFactoryQuiz, 350);
    } else if(currentTerm){
      // 黄色解释：与带的词不匹配 → 配对失败，清空带的词（明确反馈）
      f.hit=true;
      score+=2; scoreEl.textContent=score; combo=0; if(comboEl)comboEl.textContent='';
      float(f.x,f.y,'❌ 不是「'+currentTerm+'」的解释，带的词清了','#ff5252'); playSound('error');
      currentTerm=''; termEl.textContent='—';
    } else {
      // 没带词吃黄色：不消耗食物，只提示
      float(f.x,f.y,'先吃蓝色术语，再吃解释','#ffd27d'); playSound('click');
      return;   // 注意：这里不标记 hit，食物保留
    }
  }

  // ================= 移动 / 碰撞（滚轴世界）=================
  function loseLife(){
    playSound('error'); invuln=1.5; lives--; livesEl.textContent=lives; addParticles(grid[0][0],grid[0][1],'#ff5252');
    if(lives<=0){ endGame(false); return; }
    // 蛇身重置为 3 节，带词清空
    const h=grid[0];
    grid = [[h[0],h[1]],[h[0]-1,h[1]],[h[0]-2,h[1]]];
    headPos={x:h[0], y:h[1]}; frac=0;
    currentTerm=''; termEl.textContent='—';
  }
  function step(){
    // 转向只在本格走完（step）时生效，保证蛇头插值沿固定方向、移动连续
    if(!(nextDir.x===-dir.x && nextDir.y===-dir.y)) dir={x:nextDir.x, y:nextDir.y};
    const head=grid[0];
    const nx=head[0]+dir.x, ny=head[1]+dir.y;
    if(nx<0||nx>=worldW||ny<0||ny>=worldH){ loseLife(); return; }
    if(grid.some(g=>g[0]===nx&&g[1]===ny)){ loseLife(); return; }
    if(walls.some(w=>w.x===nx&&w.y===ny)){ loseLife(); return; }   // 撞墙掉命
    grid.unshift([nx,ny]);
    let ate=null;
    for(let i=0;i<foods.length;i++){ const f=foods[i]; if(!f.hit && f.x===nx && f.y===ny){ ate=f; break; } }
    if(ate){ eat(ate); if(ended) return; }
    foods=foods.filter(f=>!f.hit);   // 只有 eat 里标记 hit 的才被消耗
    if(!ate) grid.pop();
    spawnTimer-=dt; if(spawnTimer<=0){ ensureFoods(); spawnTimer=0.6; }
  }
  function update(dt){
    if(ended || quizLock) return;
    if(invuln>0) invuln-=dt;
    speed = (cfg._endless && paired>0 ? 2.6+paired*0.2 : 3.0 + paired*0.1);   // 格/秒，平缓提速
    const stepT = 1/speed;
    timer += dt;
    // 掉帧可累积多步：用 while 保证 timer<stepT，蛇头位置连续不跳变
    while(timer >= stepT){ timer -= stepT; step(); if(ended) return; }
    frac = timer/stepT;   // 0 <= frac < 1
    // 蛇头平滑位置：从 grid[0] 沿 dir（进入本格的方向）走 frac——step 后方向更新、位置自然衔接
    headPos.x = grid[0][0] + dir.x*frac;
    headPos.y = grid[0][1] + dir.y*frac;
    // 相机跟随蛇头（平滑）
    const tcx = clamp(headPos.x - VIEW_COLS/2, 0, worldW - VIEW_COLS);
    const tcy = clamp(headPos.y - VIEW_ROWS/2, 0, worldH - VIEW_ROWS);
    camX += (tcx - camX)*Math.min(1, dt*7);
    camY += (tcy - camY)*Math.min(1, dt*7);
  }

  // ================= 渲染 =================
  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
  // 蛇身第 i 节位置：从蛇头 headPos 沿 grid 路径往回走 i 格（浮点，随蛇头连续）
  function bodyPos(i){
    let rem=i, a={x:headPos.x, y:headPos.y};
    for(let k=1;k<grid.length && rem>0;k++){
      const b={x:grid[k][0], y:grid[k][1]};
      const d=Math.hypot(b.x-a.x, b.y-a.y);
      if(d>=rem){ const t=rem/(d||1); return {x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t}; }
      rem-=d; a=b;
    }
    return {x:grid[grid.length-1][0], y:grid[grid.length-1][1]};
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    const offX = Math.round(camX*cell), offY = Math.round(camY*cell);
    // 世界底纹（淡色棋盘随镜头）
    ctx.fillStyle='rgba(0,188,212,.025)';
    for(let gy=Math.floor(camY); gy<camY+VIEW_ROWS+1; gy++){
      for(let gx=Math.floor(camX); gx<camX+VIEW_COLS+1; gx++){
        if((gx+gy)%2===0){ ctx.fillRect(gx*cell-offX, gy*cell-offY, cell, cell); }
      }
    }
    // 网格线（只画视口内，浅色）
    ctx.strokeStyle='rgba(0,188,212,.06)'; ctx.lineWidth=1;
    const sx0=Math.floor(camX), sy0=Math.floor(camY);
    for(let gx=sx0; gx<=sx0+VIEW_COLS; gx++){ ctx.beginPath(); ctx.moveTo(gx*cell-offX,0); ctx.lineTo(gx*cell-offX,H); ctx.stroke(); }
    for(let gy=sy0; gy<=sy0+VIEW_ROWS; gy++){ ctx.beginPath(); ctx.moveTo(0,gy*cell-offY); ctx.lineTo(W,gy*cell-offY); ctx.stroke(); }
    // 世界边界提示线（当镜头贴边时）
    if(camX<=0){ ctx.fillStyle='rgba(255,82,82,.35)'; ctx.fillRect(0,0,3,H); }
    if(camX>=worldW-VIEW_COLS){ ctx.fillStyle='rgba(255,82,82,.35)'; ctx.fillRect(W-3,0,3,H); }
    if(camY<=0){ ctx.fillStyle='rgba(255,82,82,.35)'; ctx.fillRect(0,0,W,3); }
    if(camY>=worldH-VIEW_ROWS){ ctx.fillStyle='rgba(255,82,82,.35)'; ctx.fillRect(0,H-3,W,3); }

    // 墙体：砖块 + 边框 + 纹理
    walls.forEach(function(w){
      const wx=w.x*cell-offX, wy=w.y*cell-offY;
      if(wx<-cell||wx>W||wy<-cell||wy>H) return;
      ctx.fillStyle='#33424f';
      ctx.fillRect(wx,wy,cell,cell);
      ctx.strokeStyle='#1d262e'; ctx.lineWidth=2;
      ctx.strokeRect(wx,wy,cell,cell);
      // 砖缝纹理
      ctx.strokeStyle='rgba(255,255,255,.07)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(wx,wy+cell/2); ctx.lineTo(wx+cell,wy+cell/2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wx+cell/2,wy); ctx.lineTo(wx+cell/2,wy+cell); ctx.stroke();
    });
    // 食物：蓝=术语(随便吃) / 黄=解释(配对才吃)；配对目标高亮
    foods.forEach(function(f){
      const fx=f.x*cell+cell/2-offX, fy=f.y*cell+cell/2-offY;
      if(fx<-40||fx>W+40||fy<-40||fy>H+40) return;   // 视口外不画
      const isTerm = f.kind==='term';
      const matchTarget = !isTerm && currentTerm && hintOf[currentTerm]===f.label;   // 正是当前要配对的解释
      const pulse = 1 + 0.12*Math.sin(performance.now()/260 + f.x*1.7 + f.y*2.3);
      const rad = 12*pulse;
      const base = isTerm ? '#2196f3' : '#ffb300';
      // 外发光环
      ctx.fillStyle = isTerm ? 'rgba(33,150,243,.22)' : 'rgba(255,179,0,.22)';
      if(matchTarget){ ctx.fillStyle='rgba(0,230,118,.35)'; }
      ctx.beginPath(); ctx.arc(fx,fy,rad+7,0,Math.PI*2); ctx.fill();
      // 主体
      ctx.fillStyle = matchTarget ? '#00e676' : base;
      ctx.shadowColor = matchTarget ? '#00e676' : base; ctx.shadowBlur= matchTarget?18:12;
      ctx.beginPath(); ctx.arc(fx,fy,rad,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
      // 高光
      ctx.fillStyle='rgba(255,255,255,.55)';
      ctx.beginPath(); ctx.arc(fx-rad*0.3,fy-rad*0.35,rad*0.28,0,Math.PI*2); ctx.fill();
      // 文字（上方）
      ctx.font='bold '+Math.round(F_FOOD/sf)+'px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='alphabetic';
      ctx.lineWidth=4; ctx.strokeStyle='rgba(0,0,0,.88)';
      ctx.strokeText(f.label, fx, fy-20);
      ctx.fillStyle = matchTarget ? '#b9ffdd' : '#fff';
      ctx.fillText(f.label, fx, fy-20);
    });

    // ===== 蛇身：按皮肤样式绘制（smooth 连续 / bamboo 竹节 / comet 彗星拖尾）=====
    const style = SK.style || 'smooth';
    const segN=grid.length;
    const pts=[];
    for(let i=0;i<segN;i++){ pts.push(i===0?{x:headPos.x,y:headPos.y}:bodyPos(i)); }
    ctx.lineCap='round'; ctx.lineJoin='round';
    if(style==='bamboo'){
      // 竹节：一节节圆球 + 连接胶囊，带亮色节环
      for(let i=0;i<segN;i++){
        const pt=pts[i];
        const x=pt.x*cell+cell/2-offX, y=pt.y*cell+cell/2-offY;
        const tailT=Math.max(0.42, 1-i/segN);
        const r=cell*0.42*tailT;
        if(i>0){
          const p2=pts[i-1];
          const p2x=p2.x*cell+cell/2-offX, p2y=p2.y*cell+cell/2-offY;
          const a2=Math.atan2(y-p2y, x-p2x);
          const rr=r*0.8;
          ctx.fillStyle=mixColor(SK.col, SK.dark, i/segN);
          ctx.beginPath();
          ctx.moveTo(x+Math.cos(a2+Math.PI/2)*rr, y+Math.sin(a2+Math.PI/2)*rr);
          ctx.lineTo(p2x+Math.cos(a2+Math.PI/2)*rr, p2y+Math.sin(a2+Math.PI/2)*rr);
          ctx.lineTo(p2x+Math.cos(a2-Math.PI/2)*rr, p2y+Math.sin(a2-Math.PI/2)*rr);
          ctx.lineTo(x+Math.cos(a2-Math.PI/2)*rr, y+Math.sin(a2-Math.PI/2)*rr);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = (i===0 && currentTerm) ? SK.glow : (i===0 ? SK.col : mixColor(SK.col, SK.dark, i/segN));
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
        // 节环（浅色环纹）
        ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.lineWidth=1.6;
        ctx.beginPath(); ctx.arc(x,y,r*0.92,0,Math.PI*2); ctx.stroke();
        // 高光
        ctx.fillStyle='rgba(255,255,255,.22)';
        ctx.beginPath(); ctx.arc(x-r*0.3,y-r*0.35,r*0.3,0,Math.PI*2); ctx.fill();
      }
    } else if(style==='comet'){
      // 彗星：发光拖尾——尾巴渐细、渐淡，带光晕
      for(let i=0;i<segN-1;i++){
        const a=pts[i], b=pts[i+1];
        const ax=a.x*cell+cell/2-offX, ay=a.y*cell+cell/2-offY;
        const bx=b.x*cell+cell/2-offX, by=b.y*cell+cell/2-offY;
        const tailT=Math.max(0.4, 1-i/segN);
        const w=cell*(0.92*tailT);
        ctx.strokeStyle=mixColor(SK.col, SK.dark, i/segN);
        ctx.globalAlpha=0.3+0.7*tailT;
        ctx.shadowColor=SK.glow; ctx.shadowBlur=16;
        ctx.lineWidth=w;
        ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      }
      ctx.shadowBlur=0; ctx.globalAlpha=1;
    } else {
      // smooth（默认）：朴素——一根等粗的线，不渐变、无高光/鳞片
      ctx.strokeStyle = currentTerm ? SK.glow : SK.col;
      ctx.lineWidth = cell*0.8;
      ctx.beginPath();
      pts.forEach(function(pt,i){
        const x=pt.x*cell+cell/2-offX, y=pt.y*cell+cell/2-offY;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();
    }
    // ===== 蛇头（大圆 + 五官）=====
    const hx=headPos.x*cell+cell/2-offX, hy=headPos.y*cell+cell/2-offY;
    const hr=cell*0.5;
    ctx.fillStyle = currentTerm ? SK.glow : (style==='smooth' ? SK.dark : SK.col);
    ctx.shadowColor=SK.glow; ctx.shadowBlur=(currentTerm||style==='comet')?16:0;
    ctx.beginPath(); ctx.arc(hx,hy,hr,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    // 头顶高光
    ctx.fillStyle='rgba(255,255,255,.25)';
    ctx.beginPath(); ctx.arc(hx-hr*0.26, hy-hr*0.32, hr*0.3, 0, Math.PI*2); ctx.fill();
    // 大眼睛（朝方向）
    const ex=dir.x, ey=dir.y, eo=cell*0.30;
    [[-0.52,0.62],[0.52,0.62]].forEach(function(off){
      const eX=hx+ex*eo+off[0]*cell*0.26, eY=hy+ey*eo+off[1]*cell*0.26;
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(eX,eY,5.2,5.8,Math.atan2(ey,ex),0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#1b2a3a'; ctx.beginPath(); ctx.arc(eX+ex*1.4,eY+ey*1.4,3.0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(eX+ex*2.4-1,eY+ey*2.4-1.6,1.3,0,Math.PI*2); ctx.fill();
    });
    // 腮红
    ctx.fillStyle='rgba(255,110,110,.4)';
    ctx.beginPath(); ctx.arc(hx-cell*0.42, hy+cell*0.34, 3.4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx+cell*0.42, hy+cell*0.34, 3.4, 0, Math.PI*2); ctx.fill();
    // 微笑嘴
    ctx.strokeStyle='rgba(0,0,0,.45)'; ctx.lineWidth=2; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(hx+ex*cell*0.06, hy+ey*cell*0.18+cell*0.12, 5, 0.15*Math.PI, 0.85*Math.PI); ctx.stroke();
    // 小舌头（朝方向）
    ctx.strokeStyle='#ff5a5a'; ctx.lineWidth=2.2; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(hx+ex*cell*0.46, hy+ey*cell*0.46);
    ctx.lineTo(hx+ex*cell*0.66, hy+ey*cell*0.66); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx+ex*cell*0.6, hy+ey*cell*0.56); ctx.lineTo(hx+ex*cell*0.72, hy+ey*cell*0.5); ctx.stroke();
    // 头顶呆毛（皮肤色）
    ctx.strokeStyle=SK.col; ctx.lineWidth=2.4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(hx-cell*0.12, hy-cell*0.5);
    ctx.quadraticCurveTo(hx-cell*0.3, hy-cell*0.74, hx-cell*0.02, hy-cell*0.62); ctx.stroke();

    // 小地图（右上角）
    drawMinimap();

    // 粒子
    particles.forEach(function(p){ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; ctx.globalAlpha=Math.max(0,1-p.t/0.5); ctx.fillStyle=p.color; ctx.fillRect(p.x-offX,p.y-offY,5,5); });
    ctx.globalAlpha=1; particles=particles.filter(function(p){return p.t<0.5;});
    // 飘字（相对世界坐标，用食物所在世界格转屏幕）
    floats.forEach(function(f){ f.t+=dt; ctx.globalAlpha=Math.max(0,1-f.t/1.3); ctx.fillStyle=f.color; ctx.font='bold '+Math.round(F_FLOAT/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.fillText(f.txt, f.x-offX, f.y-offY-f.t*40); });
    ctx.globalAlpha=1; floats=floats.filter(function(f){return f.t<1.3;});
  }

  function mixColor(c1, c2, t){
    // 简单的 hex 颜色插值
    const p=function(h){ return [parseInt(h.substr(1,2),16), parseInt(h.substr(3,2),16), parseInt(h.substr(5,2),16)]; };
    const a=p(c1), b=p(c2);
    const r=Math.round(a[0]+(b[0]-a[0])*t), g=Math.round(a[1]+(b[1]-a[1])*t), bl=Math.round(a[2]+(b[2]-a[2])*t);
    return 'rgb('+r+','+g+','+bl+')';
  }

  function drawMinimap(){
    const mw=116, mh=Math.round(mw*(worldH/worldW)), mx=W-mw-12, my=12;
    ctx.globalAlpha=0.85;
    ctx.fillStyle='rgba(4,10,20,.72)';
    ctx.fillRect(mx-4,my-4,mw+8,mh+8);
    ctx.strokeStyle='rgba(0,188,212,.5)'; ctx.lineWidth=1; ctx.strokeRect(mx,my,mw,mh);
    // 食物点
    foods.forEach(function(f){
      ctx.fillStyle = f.kind==='term' ? '#2196f3' : '#ffb300';
      ctx.fillRect(mx + (f.x/worldW)*mw -1, my + (f.y/worldH)*mh -1, 2.4, 2.4);
    });
    // 墙点
    ctx.fillStyle='#5a6b78';
    walls.forEach(function(w){
      ctx.fillRect(mx + (w.x/worldW)*mw -1, my + (w.y/worldH)*mh -1, 2, 2);
    });
    // 视口范围
    ctx.strokeStyle='rgba(255,255,255,.35)';
    ctx.strokeRect(mx + (camX/worldW)*mw, my + (camY/worldH)*mh, (VIEW_COLS/worldW)*mw, (VIEW_ROWS/worldH)*mh);
    // 蛇（画整条线）
    if(grid.length){
      ctx.strokeStyle=SK.col; ctx.lineWidth=2.6; ctx.lineCap='round';
      ctx.beginPath();
      grid.forEach(function(g,i){
        const px=mx+(g[0]/worldW)*mw, py=my+(g[1]/worldH)*mh;
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      });
      ctx.stroke();
    }
    // 蛇头点
    const hx=mx+(grid[0][0]/worldW)*mw, hy=my+(grid[0][1]/worldH)*mh;
    ctx.fillStyle=SK.glow; ctx.beginPath(); ctx.arc(hx,hy,2.6,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }

  // ================= 结算 =================
  function endGame(isWin){
    if(ended) return; ended=true;
    if(isWin){ window.recordGameWin('snake'); window.miniMarkClear(cfg.id); playSound('fanfare'); }
    setTimeout(function(){
      const res=document.createElement('div'); res.className='ty-result';
      res.innerHTML='<div style="font-size:46px;line-height:1">🐍</div><div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'网络三件套配对完成！':'网线断了，重接一下')+'</div><div style="font-size:15px;color:var(--dim);margin-top:6px">配对 <b style="color:var(--amber)">'+paired+'</b> 对 · 得分 <b style="color:var(--amber)">'+score+'</b></div><div style="font-size:13px;color:var(--dim);margin-top:4px">'+'记住的术语已收录图鉴'+(isWin?'':'，配对 '+WIN+' 对即通关')+'</div><div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.snAgain()">🔁 再来</button><button class="mm-btn primary" onclick="window.snDone()">收下奖励</button></div>';
      window.focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    },300);
  }
  function cleanup(){ document.removeEventListener('keydown', kd); }
  window.snAgain=function(){ cleanup(); overlay.remove(); openSnake(cfg,onComplete); };
  window.snDone=function(){ cleanup(); if(onComplete)onComplete(paired>=WIN); overlay.remove(); window.playAreaMusic(); };
  function closeGame(manual){ if(ended) return; ended=true; cancelAnimationFrame(raf); cleanup(); overlay.remove(); if(manual){ if(onComplete)onComplete(false); window.playAreaMusic(); } }

  // ================= 主循环 =================
  spawnWalls();
  ensureFoods();
  let last=performance.now();
  function loop(now){
    dt=Math.min(0.05,(now-last)/1000); last=now;
    try { update(dt); draw(); }
    catch(e){ console.error('[网线贪吃蛇] 循环异常：', e); }
    raf=requestAnimationFrame(loop);
  }
  let raf; raf=requestAnimationFrame(loop);
}
