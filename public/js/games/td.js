// ═══════════════════════════════════════════════════════════════════
// games/td — 拆自 app.js（openTowerDefense）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openTowerDefense(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('td')) {
    window.showGameTutorial('td', '🛡️ 车间防线 · 对症下药', [
      '<b>攻击都有弱点</b>：DDoS 怕防火墙，端口扫描怕 IDS，ARP 欺骗怕安全网关',
      '点击空地<b>部署设备</b>；只有<b>克制对应攻击</b>的设备才能打出高伤害',
      '用错设备伤害极低——<b>选对设备</b>才能守住！<br>（恶魔会在你耳边嘀咕？别信它）'
    ], function(){ openTowerDefense(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('td') || 'boss');
  const CELL = 40, COLS = 13, ROWS = 13;
  const W = COLS*CELL, H = ROWS*CELL;
  const PATH = [[0,6],[3,6],[3,3],[6,3],[6,9],[9,9],[9,2],[12,2]];
  // 塔：攻击有克星 —— counter 指向它克制的敌人 id
  const TOWERS = [
    { id:'fw',  name:'防火墙',   emoji:'🧱', cost:50, range:110, dmg:14, cd:0.5,  color:'#ffb300', counter:'ddos', sub:'拦 DDoS' },
    { id:'ids', name:'IDS',     emoji:'🕵️', cost:80, range:140, dmg:20, cd:0.8,  color:'#4d96ff', counter:'scan', sub:'抓扫描' },
    { id:'gw',  name:'安全网关', emoji:'🛡️', cost:110,range:150, dmg:26, cd:1.0,  color:'#50e3c2', counter:'arp',  sub:'防欺骗' }
  ];
  // 敌人：weak 是它的弱点（哪个塔克制它）
  const ENEMIES = [
    { id:'ddos', name:'DDoS',      emoji:'🌐', hp:26, speed:1.5, gold:12, color:'#ff6b6b', r:9,  weak:'fw',  weakName:'防火墙' },
    { id:'scan', name:'端口扫描',   emoji:'🔍', hp:50, speed:1.0, gold:20, color:'#ff9f43', r:10, weak:'ids', weakName:'IDS' },
    { id:'arp',  name:'ARP欺骗',   emoji:'🕸️', hp:90, speed:0.7, gold:32, color:'#c07bd6', r:11, weak:'gw',  weakName:'安全网关' }
  ];
  // 教学波次：每波只出同一种敌人，让玩家学会"对症下药"
  const TEACH = [ ['ddos'], ['scan'], ['arp'] ];
  const WAVES = Math.max(cfg.waves || 5, 4);
  let wave = 0, lives = 10, money = 130, ended = false;
  let enemies = [], towers = [], bullets = [];
  let selTower = 0, spawnQ = [], spawnT = 0, waveActive = false, last = 0, raf = 0;
  let effects = [], floaters = [];   // 特效：冲击波/粒子/飘字
  let waveBanner = 0;
  const pathPts = PATH.map(p => [p[0]*CELL+CELL/2, p[1]*CELL+CELL/2]);
  const occupied = {};
  PATH.forEach(p => { occupied[p[0]+','+p[1]] = true; });
  const counterMult = 2.6;   // 克制伤害倍率
  const wrongMult = 0.18;    // 用错设备伤害倍率（几乎无效）

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="td-box">
      <div class="mm-head"><div><div class="mm-title">🛡️ ${escHtml(cfg.name)}</div><div class="mm-sub">对症下药：用克制的设备打对应攻击</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="td-stats">
        <span>🌊 第 <b id="tdWave">0</b>/${WAVES} 波</span>
        <span>❤️ <b id="tdLives">${lives}</b></span>
        <span>💰 <b id="tdMoney">${money}</b></span>
        <span>👾 <b id="tdLeft">0</b></span>
      </div>
      <canvas id="tdCanvas" width="${W}" height="${H}"></canvas>
      <div class="td-toolbar" id="tdToolbar"></div>
      <div class="td-legend" id="tdLegend"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const cv = document.getElementById('tdCanvas'), ctx = cv.getContext('2d');
  const livesEl=document.getElementById('tdLives'), moneyEl=document.getElementById('tdMoney'), waveEl=document.getElementById('tdWave'), leftEl=document.getElementById('tdLeft');

  // 工具栏：每个设备按钮显示"克制谁"
  const tb = document.getElementById('tdToolbar');
  TOWERS.forEach((t,i) => {
    const b = document.createElement('button');
    b.className = 'td-tower-btn' + (i===0?' active':'');
    b.innerHTML = t.emoji + ' <b>'+t.name+'</b> <span class="td-sub">克 '+t.sub+'</span> <b style="color:var(--amber)">'+t.cost+'</b>';
    b.title = t.name + ' —— 专门克制 ' + ENEMIES.find(e=>e.id===t.counter).name;
    b.onclick = () => { selTower = i; tb.querySelectorAll('.td-tower-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); playSound('click'); };
    tb.appendChild(b);
  });
  // 图例：三种攻击 → 该用什么设备
  const legend = document.getElementById('tdLegend');
  legend.innerHTML = ENEMIES.map(e=>{
    const t=TOWERS.find(x=>x.id===e.weak);
    return '<span class="td-lg" data-weak="'+e.weak+'">'+e.emoji+' '+e.name+' → '+t.emoji+t.name+'</span>';
  }).join('');

  // 点击空地放塔（坐标按画布实际显示尺寸换算）
  cv.addEventListener('click', e => {
    if (ended) return;
    const r = cv.getBoundingClientRect();
    const cx = Math.floor((e.clientX - r.left) * (W/r.width) / CELL);
    const cy = Math.floor((e.clientY - r.top) * (H/r.height) / CELL);
    const key = cx+','+cy;
    if (cx<0||cx>=COLS||cy<0||cy>=ROWS||occupied[key]) { playSound('error'); return; }
    const t = TOWERS[selTower];
    if (money < t.cost) { window.showToast('钱不够，先杀怪攒钱', 'error'); return; }
    money -= t.cost; moneyEl.textContent = money;
    occupied[key] = true;
    towers.push({ x: cx*CELL+CELL/2, y: cy*CELL+CELL/2, cx, cy, type: selTower, cd: 0, fresh: true });
    setTimeout(function(){ var idx=towers.length-1; if(towers[idx]) towers[idx].fresh=false; }, 700);
    window.__tdSelTower = towers[towers.length-1];
    addEffect(cx*CELL+CELL/2, cy*CELL+CELL/2, 'boom', {color:t.color});
    playSound('click');
  });

  // 教学提示：波前弹出"该用什么"的引导
  function showTeach(w){
    if (w-1 < TEACH.length) {
      const eid = TEACH[w-1][0];
      const e = ENEMIES.find(x=>x.id===eid);
      const t = TOWERS.find(x=>x.id===e.weak);
      const tip = document.createElement('div');
      tip.className = 'td-teach';
      tip.innerHTML = '<div class="td-teach-em">'+e.emoji+'</div><div class="td-teach-txt">第 '+w+' 波：<b>'+e.name+'</b> 来了！<br>它最怕 <b style="color:'+t.color+'">'+t.emoji+t.name+'</b> —— 部署它，打起来才疼！</div>';
      document.body.appendChild(tip);
      setTimeout(()=>{ tip.classList.add('show'); }, 200);
      setTimeout(()=>{ tip.classList.remove('show'); setTimeout(()=>tip.remove(),500); }, 3200);
    }
  }

  function startWave() {
    wave++; waveEl.textContent = wave;
    waveActive = true;
    const n = 3 + wave;
    spawnQ = [];
    // 教学波只出同一种；第4波起混合
    if (wave <= TEACH.length) {
      const eid = TEACH[wave-1][0];
      for (let i=0;i<n;i++) spawnQ.push(eid);
    } else {
      for (let i=0;i<n;i++) spawnQ.push(ENEMIES[Math.floor(Math.random()*ENEMIES.length)].id);
    }
    spawnT = 0.5;
    showTeach(wave);
    waveBanner = 1.2;   // 波次横幅
  }
  function endWave() {
    waveActive = false;
    if (wave >= WAVES) { endGame(true); return; }
    startWave();
  }

  function addEffect(x,y,type,extra){
    effects.push({x,y,type,t:0,extra:extra||{}});
  }
  function addFloat(x,y,txt,color,big){
    floaters.push({x,y,txt,color,t:0,big:!!big});
  }

  function update(dt) {
    if (waveBanner>0) waveBanner-=dt;
    if (ended) return;
    // 生成
    if (waveActive && spawnQ.length) {
      spawnT -= dt;
      if (spawnT <= 0) {
        const eid = spawnQ.shift();
        const en = ENEMIES.find(x=>x.id===eid);
        enemies.push({ x:pathPts[0][0], y:pathPts[0][1], hp:en.hp*(1+wave*0.18), max:en.hp*(1+wave*0.18), speed:en.speed, gold:en.gold, color:en.color, r:en.r, id:eid, weak:en.weak, weakName:en.weakName, emoji:en.emoji, name:en.name, wp:1 });
        spawnT = Math.max(0.35, 1.05 - wave*0.12);
      }
    }
    // 敌人移动
    for (let i=enemies.length-1;i>=0;i--) {
      const e = enemies[i];
      const tx = pathPts[e.wp][0], ty = pathPts[e.wp][1];
      const dx = tx-e.x, dy = ty-e.y, d = Math.hypot(dx,dy);
      if (d < 2) { e.wp++; if (e.wp >= pathPts.length) { enemies.splice(i,1); lives--; livesEl.textContent=lives; addEffect(pathPts[pathPts.length-1][0], pathPts[pathPts.length-1][1],'leak'); if (lives<=0) { endGame(false); return; } } }
      else { e.x += dx/d*e.speed*CELL*0.28; e.y += dy/d*e.speed*CELL*0.28; }
    }
    // 塔射击
    towers.forEach(t => {
      t.cd -= dt;
      if (t.cd > 0) return;
      let best=null, bd=99999;
      enemies.forEach(e => { const d2=(e.x-t.x)**2+(e.y-t.y)**2; if (d2 < TOWERS[t.type].range**2 && d2 < bd) { bd=d2; best=e; } });
      if (best) {
        const tw = TOWERS[t.type];
        const isCounter = tw.counter === best.weak;   // 这个塔克制这个敌人?
        t.cd = tw.cd;
        bullets.push({ x:t.x, y:t.y, tx:best.x, ty:best.y, tgt:best, dmg:tw.dmg*(isCounter?counterMult:wrongMult), color:tw.color, counter:isCounter, weak:best.weak });
        // 塔开火闪光
        addEffect(t.x, t.y, 'muzzle', {color:tw.color, counter:isCounter});
        playSound('click');
      }
    });
    // 子弹
    for (let i=bullets.length-1;i>=0;i--) {
      const b = bullets[i];
      if (!b.tgt || !enemies.includes(b.tgt)) { bullets.splice(i,1); continue; }
      const dx=b.tgt.x-b.x, dy=b.tgt.y-b.y, d=Math.hypot(dx,dy);
      if (d < 6) {
        b.tgt.hp -= b.dmg;
        const killed = b.tgt.hp <= 0;
        bullets.splice(i,1);
        if (b.counter) {
          // 克制命中：金色暴击特效
          addEffect(b.tgt.x, b.tgt.y, 'hit-big', {color:'#ffd700'});
          addFloat(b.tgt.x, b.tgt.y-16, '克制 ×'+counterMult+'！', '#ffd700', true);
          playSound('fanfare');
        } else {
          // 用错设备：微弱火花 + 提示
          addEffect(b.tgt.x, b.tgt.y, 'hit-sm', {color:'#888'});
          addFloat(b.tgt.x, b.tgt.y-14, '无效（非克制）', '#999');
          playSound('click');
        }
        if (killed) {
          const idx=enemies.indexOf(b.tgt); if(idx>=0) enemies.splice(idx,1);
          money += b.tgt.gold; moneyEl.textContent = money;
          addEffect(b.tgt.x, b.tgt.y, 'boom', {color:b.tgt.color});
          addFloat(b.tgt.x, b.tgt.y, '+'+b.tgt.gold+'💰', '#ffd27d');
          playSound('success');
        }
      }
      else { b.x += dx/d*420*dt; b.y += dy/d*420*dt; }
    }
    // 特效更新
    effects.forEach(f=>f.t+=dt); effects=effects.filter(f=>f.t<0.6);
    floaters.forEach(f=>f.t+=dt); floaters=floaters.filter(f=>f.t<1.1);
    leftEl.textContent = enemies.length + spawnQ.length;
    if (waveActive && !spawnQ.length && !enemies.length) endWave();
  }

  function draw() {
    ctx.clearRect(0,0,W,H);
    // 背景网格（带深浅）
    ctx.strokeStyle='rgba(255,255,255,.05)'; ctx.lineWidth=1;
    for (let x=0;x<=W;x+=CELL){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for (let y=0;y<=H;y+=CELL){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    // 可部署格微光
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){ if(!occupied[c+','+r]){ ctx.fillStyle='rgba(255,255,255,.02)'; ctx.fillRect(c*CELL+1,r*CELL+1,CELL-2,CELL-2); } }
    // 通路
    ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.lineWidth=CELL*0.8; ctx.strokeStyle='#2a2336'; ctx.beginPath(); ctx.moveTo(pathPts[0][0],pathPts[0][1]); for (let i=1;i<pathPts.length;i++) ctx.lineTo(pathPts[i][0],pathPts[i][1]); ctx.stroke();
    ctx.lineWidth=CELL*0.5; ctx.strokeStyle='#7a5ad0'; ctx.beginPath(); ctx.moveTo(pathPts[0][0],pathPts[0][1]); for (let i=1;i<pathPts.length;i++) ctx.lineTo(pathPts[i][0],pathPts[i][1]); ctx.stroke();
    // 起点/终点
    ctx.save(); ctx.shadowColor='#00e676'; ctx.shadowBlur=12; ctx.font='22px sans-serif'; ctx.fillText('🏭', pathPts[0][0]-8, pathPts[0][1]+7); ctx.restore();
    ctx.save(); ctx.shadowColor='#ff5252'; ctx.shadowBlur=12; ctx.font='22px sans-serif'; ctx.fillText('🚪', pathPts[pathPts.length-1][0]-8, pathPts[pathPts.length-1][1]+7); ctx.restore();
    // 塔
    towers.forEach(t => {
      const tw=TOWERS[t.type], tx=t.x, ty=t.y, R=CELL*0.42;
      ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(tx-R-2, ty+R-6, R*2+4, 6);
      ctx.fillStyle=tw.color; ctx.shadowColor=tw.color; ctx.shadowBlur=12;
      ctx.fillRect(tx-R, ty-R, R*2, R*2); ctx.shadowBlur=0;
      ctx.fillStyle='rgba(255,255,255,.5)'; ctx.fillRect(tx-R+2, ty-R+2, R*2-4, 4);
      ctx.fillStyle='#0a0d14'; ctx.font='bold 16px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(tw.emoji, tx, ty+1);
      // 塔克制目标显示小字
      ctx.fillStyle='rgba(255,255,255,.5)'; ctx.font='9px sans-serif'; ctx.textBaseline='top';
      ctx.fillText(tw.sub, tx, ty+R+2);
      if(t.fresh){ ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(tx,ty,R+6,0,Math.PI*2); ctx.stroke(); }
      if(window.__tdSelTower===t){ ctx.strokeStyle='rgba(255,255,255,.2)'; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.arc(tx,ty,tw.range,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); }
    });
    // 敌人
    enemies.forEach(e => {
      ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(e.x, e.y+e.r+3, e.r*0.9, 3, 0, 0, Math.PI*2); ctx.fill();
      const grad=ctx.createRadialGradient(e.x-e.r*0.3,e.y-e.r*0.3,e.r*0.2,e.x,e.y,e.r);
      grad.addColorStop(0,'#fff'); grad.addColorStop(0.35,e.color); grad.addColorStop(1,'rgba(0,0,0,.4)');
      ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.5)'; ctx.lineWidth=1; ctx.stroke();
      ctx.font='12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(e.emoji, e.x, e.y-1);
      // 弱点标签（头顶：怕哪个设备）
      ctx.save();
      ctx.shadowColor='#000'; ctx.shadowBlur=4;
      ctx.fillStyle='#fff'; ctx.font='bold 9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='alphabetic';
      ctx.fillText('怕 '+TOWERS.find(x=>x.id===e.weak).emoji+e.weakName, e.x, e.y-e.r-6);
      ctx.restore();
      // 血条
      const bw=e.r*2.4;
      ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(e.x-bw/2, e.y+e.r+3, bw, 4);
      ctx.fillStyle=e.hp/e.max>0.5?'#00e676':'#ff5252'; ctx.fillRect(e.x-bw/2, e.y+e.r+3, bw*Math.max(0,e.hp/e.max), 4);
    });
    // 子弹（光点+拖尾）
    bullets.forEach(b => {
      const ang=Math.atan2(b.ty-b.y,b.tx-b.x);
      ctx.strokeStyle=b.color; ctx.globalAlpha=0.5; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(b.x-Math.cos(ang)*8, b.y-Math.sin(ang)*8); ctx.lineTo(b.x,b.y); ctx.stroke();
      ctx.globalAlpha=1; ctx.shadowColor=b.color; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(b.x,b.y,3.2,0,Math.PI*2); ctx.fillStyle=b.color; ctx.fill(); ctx.shadowBlur=0;
    });
    // 特效
    effects.forEach(f=>{
      const p=f.t/0.6;
      if(f.type==='boom'){ // 爆炸碎片
        for(let i=0;i<8;i++){ const a=i*Math.PI/4; const d=p*26; ctx.fillStyle=f.extra.color; ctx.globalAlpha=1-p; ctx.beginPath(); ctx.arc(f.x+Math.cos(a)*d, f.y+Math.sin(a)*d, 3,0,Math.PI*2); ctx.fill(); }
        ctx.globalAlpha=1;
      } else if(f.type==='hit-big'){ // 克制命中金色冲击环
        ctx.strokeStyle='#ffd700'; ctx.globalAlpha=1-p; ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(f.x,f.y,8+p*22,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1;
      } else if(f.type==='hit-sm'){ // 无效微光
        ctx.fillStyle='#888'; ctx.globalAlpha=1-p; ctx.beginPath(); ctx.arc(f.x,f.y,2,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
      } else if(f.type==='muzzle'){ // 开火闪光
        ctx.fillStyle=f.extra.color; ctx.globalAlpha=1-p; ctx.beginPath(); ctx.arc(f.x,f.y,5+p*6,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
      } else if(f.type==='leak'){ // 漏敌红闪
        ctx.fillStyle='#ff5252'; ctx.globalAlpha=1-p; ctx.beginPath(); ctx.arc(f.x,f.y,8+p*30,0,Math.PI*2); ctx.strokeStyle='#ff5252'; ctx.lineWidth=3; ctx.stroke(); ctx.globalAlpha=1;
      }
    });
    // 飘字
    floaters.forEach(f=>{
      ctx.globalAlpha=Math.max(0,1-f.t/1.1);
      ctx.fillStyle=f.color; ctx.font='bold '+(f.big?16:11)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.shadowColor='#000'; ctx.shadowBlur=4;
      ctx.fillText(f.txt, f.x, f.y-f.t*34); ctx.shadowBlur=0;
      ctx.globalAlpha=1;
    });
    // 波次横幅
    if(waveBanner>0 && wave>0){
      const a=Math.min(1, waveBanner/1.2*2);
      ctx.save(); ctx.globalAlpha=Math.max(0,a);
      ctx.fillStyle='#ffd700'; ctx.font='bold 30px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.shadowColor='#000'; ctx.shadowBlur=10;
      ctx.fillText('第 '+wave+' 波', W/2, H/2-10);
      ctx.fillStyle='#fff'; ctx.font='14px sans-serif';
      ctx.fillText(wave<=TEACH.length?('全 '+ENEMIES.find(x=>x.id===TEACH[wave-1][0]).name+'！'):'混合攻击！', W/2, H/2+18);
      ctx.restore();
    }
  }

  function frame(now) {
    const dt = Math.min(0.033,(now-last)/1000); last = now;
    if (!ended) { update(dt); draw(); raf = requestAnimationFrame(frame); }
  }
  function endGame(isWin) {
    if (ended) return;
    ended = true;
    if (isWin) { window.recordGameWin('td'); window.miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=window.getGameStats(); _gs.tdBest=Math.max(_gs.tdBest||0, wave); _gs.tdWins=(_gs.tdWins||0)+(isWin?1:0); window.saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'车间防线守住！':'防线被攻破')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">守到第 '+Math.min(wave,WAVES)+'/'+WAVES+' 波 · 剩余 💰 '+money+'</div>'+
        '<div style="font-size:13px;color:var(--dim);margin-top:4px">记住：DDoS→防火墙 · 端口扫描→IDS · ARP欺骗→安全网关</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.tdAgain()">🔁 再守一轮</button><button class="mm-btn primary" onclick="window.tdDone()">收下奖励</button></div>';
      window.focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.tdAgain = () => { overlay.remove(); openTowerDefense(cfg, onComplete); };
  window.tdDone = () => { overlay.remove(); window.playAreaMusic(); if (onComplete) onComplete(ended && wave>=WAVES); };
  function closeGame(manual) {
    if (ended) return;
    ended = true; cancelAnimationFrame(raf);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); window.playAreaMusic(); }
  }
  startWave();
  raf = requestAnimationFrame(frame);
}
