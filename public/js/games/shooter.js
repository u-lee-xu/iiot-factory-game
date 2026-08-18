// ═══════════════════════════════════════════════════════════════════
// games/shooter — 拆自 app.js（openShooter）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openShooter(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  const advanced = !!cfg.advanced;
  const tutKey = advanced ? 'shooter_adv' : 'shooter';
  if (!window.tutSeen(tutKey)) {
    window.showGameTutorial(tutKey, advanced ? '🛸 数据蜂群 · 进阶' : '🛸 数据蜂群', [
      advanced
        ? '你的<b>飞机下面写着炮口文字</b>（一条解释），只有炮口<b>对应名词</b>的数据包才打得动，其余穿透'
        : '你的<b>飞机下面写着一条解释</b>，去找到<b>对应名词</b>的数据包打',
      advanced
        ? '<b>↑/↓</b> 切换炮口名词——想打哪个敌人，就把炮口切到<b>和它相同的名词</b>；匹配上才打得动，否则子弹穿透不扣血'
        : '只有<b>配对</b>的数据包才打得动；非配对的会被子弹穿透、不用管',
      '<b>←/→</b> 移动（自动开火）；手机：<b>拖动</b>移动（自动开火）',
      '初始火力弱，一个数据包要打 <b>3 下</b>才掉；多捡 ⚡ 道具升火力，越打越猛',
      '打掉配对会<b>随机掉落</b>：⚡ 火力、❤ 回命、☄ 全屏爆破、⏳ 缓速、💎 财宝',
      '配对命中 +10、连击加分；被子弹打中 -1 命，清空编队进下一波'
    ], function(){ openShooter(cfg, onComplete); });
    return;
  }
  const __inv = window.gameState.inventory || {};
  if (!window._shooterSkipLoadout && (((__inv['power_card']||0) > 0) || ((__inv['shield_card']||0) > 0) || ((__inv['slow_card']||0) > 0))) {
    window.showShooterLoadout(cfg, onComplete);
    return;
  }
  window._shooterSkipLoadout = false;   // 本局装备/跳过已处理，之后从菜单再进时重新询问
  playMusic(window.gameSong('shooter') || 'boss');
  // 词库：pairs = [{term 名词, hint 解释}]
  const pairs = (cfg.pairs || []).filter(Boolean);
  if (!pairs.length) { window.showToast('没有可用的配对词库', 'error'); return; }
  const terms = pairs.map(p => p.term);
  const hintOf = {}; pairs.forEach(p => hintOf[p.term] = p.hint);
  const WAVES = (cfg.waves || 4) + (cfg._hard ? 2 : 0);   // 二周目：多 2 波
  const WAVE_LABEL = cfg._endless ? '∞' : WAVES;
  const LIVES = cfg.lives || 5;
  const COLS = cfg.cols || 6, ROWS = cfg.rows || 4;

  let lives = LIVES + ((window.shooterBuff && window.shooterBuff.lives) || 0), score = 0, combo = 0, wave = 1, win = false, ended = false;
  let keys = { left:false, right:false };
  const W = 840, H = 560;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div class="sh-box">
      <div class="mm-head">
        <div><div class="mm-title">🛸 数据蜂群</div><div class="mm-sub">${escHtml(cfg.name||'')} —— ${advanced ? '↑/↓ 切换炮口文字，打对应的名词' : '看飞机上的解释，打对应的名词'}</div></div>
        <div class="mm-close" title="关闭">✕</div>
      </div>
      <div class="sh-stats">
        <span>❤️ <b id="shLives">${LIVES}</b></span>
        <span>🌊 第 <b id="shWave">1</b>/${WAVE_LABEL} 波</span>
        ${advanced ? '<span>🎯 炮口 <b id="shTerm" style="color:#7ee8fa">—</b></span>' : ''}
        <span>🎯 <b id="shScore">0</b></span>
        <span>🚀 <b id="shPower" style="color:#7ee8fa">x1</b></span>
        <span>🔥 <b id="shCombo" style="color:#ff7a00"></b></span>
      </div>
      <div class="canvas-wrap" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(ellipse at 50% 20%, #101a2e, #06070d);cursor:crosshair;touch-action:none"><canvas id="shCanvas" width="${W}" height="${H}" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;touch-action:none"></canvas></div>
      <div class="sh-tip">${advanced ? 'PC:↑/↓ 切炮口 ←/→移动 手机:左右拖移动·上下滑切炮口 自动开火' : '看飞机上的解释 → 打对应名词（非配对自动穿透） · ←/→移动/拖动 自动开火'}</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const cv = document.getElementById('shCanvas');
  const ctx = cv.getContext('2d');
  const cw = cv.clientWidth || W, ch = cv.clientHeight || H;
  const sfx = cw / W, sfy = ch / H;
  const livesEl = document.getElementById('shLives');
  const scoreEl = document.getElementById('shScore');
  const waveEl = document.getElementById('shWave');
  const comboEl = document.getElementById('shCombo');
  const powerEl = document.getElementById('shPower');
  const termEl = advanced ? document.getElementById('shTerm') : null;

  let player = { x: W/2, w: 34, h: 18 };
  let bullets = [], ebullets = [], booms = [], drops = [], floatTexts = [];
  let enemies = [], targetTerm = terms[0];
  const XSP = 96, EW = 78;                                  // 编队列间距 / 敌人宽度（让编队左右摆动而非贴边速降）
  let formX = 50, formY = 44, formDir = 1, formStep = 6;   // 下压步进放缓
  let fireCd = 0, efireCd = 0, invuln = 0, muzzle = 0;
  let pLevel = (window.shooterBuff && window.shooterBuff.pLevel) ? 1 : 0, picked = 0;   // 火力等级 0..3（显示 x1..x4）、本局拾取道具数
  let termList = [], termIdx = 0;   // 进阶模式：可切换的炮口术语列表
  const MAX_LVL = 3;
  const BULLET_LVLS = [
    { cd: 0.50, dmg: 1, vxs: [0],              col: '#ffe066', w: 4, h: 10, fx: 0 },
    { cd: 0.42, dmg: 2, vxs: [-9, 9],          col: '#7ee8fa', w: 4, h: 10, fx: 1 },
    { cd: 0.34, dmg: 3, vxs: [0, -62, 62],     col: '#7dff9e', w: 5, h: 12, fx: 2 },
    { cd: 0.27, dmg: 4, vxs: [0, -42, 42, -108, 108], col: '#ff8fd8', w: 5, h: 12, fx: 3 }
  ];
  const ROW_PITCH = 46;          // 行距加大，行间留空放术语
  const ENEMY_SKINS = [          // 敌人皮肤：每波换一套（后续可在商城购买更多）
    { col: '#00bcd4' },          // 网络蓝
    { col: '#ff7043' },          // 高温橙
    { col: '#ab6cff' }           // 协议紫
  ];
  let slowT = (window.shooterBuff && window.shooterBuff.slow) ? 8 : 0, lasers = [], skin = ENEMY_SKINS[0];

  function pickNextTarget(){
    const avail = {};
    enemies.forEach(e => { if (e.active) avail[e.term] = 1; });
    const list = Object.keys(avail);
    return list.length ? list[0] : null;
  }
  function cycleTerm(dir) {          // 进阶模式：↑/↓ 切换炮口
    if (!termList.length) return;
    termIdx = (termIdx + dir + termList.length) % termList.length;
    targetTerm = termList[termIdx];
    if (termEl) termEl.textContent = targetTerm;
    playSound('click');
    floatTexts.push({ x: player.x, y: H-96, txt: '🎯 ' + targetTerm, t: 0, col: '#7ee8fa' });
  }
  function nextActiveTerm() {        // 找一个还有敌人的其它名词
    const avail = [];
    enemies.forEach(e => { if (e.active && e.term !== targetTerm && avail.indexOf(e.term) < 0) avail.push(e.term); });
    return avail.length ? avail[0] : null;
  }
  function makeWave() {
    enemies = [];
    formX = 50; formY = 44; formDir = 1;   // 每波都从原点出发
    var _esCol = window.equippedEnemySkin();
    skin = _esCol ? { col: _esCol } : ENEMY_SKINS[(wave - 1) % ENEMY_SKINS.length];   // 装备的敌人皮肤优先，否则每波轮换
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        enemies.push({ r, c, x: formX + c*XSP, y: formY + r*ROW_PITCH, w: EW, h: 26,
          term: terms[(r*COLS+c) % terms.length], active:true, hp:3, maxHp:3, flash:0 });
      }
    }
    if (advanced) {
      const set = new Set();
      enemies.forEach(e => set.add(e.term));
      termList = Array.from(set);
      termIdx = 0;
      targetTerm = termList.length ? termList[0] : null;
      if (termEl) termEl.textContent = targetTerm || '—';
    } else {
      targetTerm = pickNextTarget();
    }
  }
  function fire() {
    if (fireCd > 0) return;
    const L = BULLET_LVLS[pLevel];
    fireCd = L.cd;
    muzzle = 0.08;
    L.vxs.forEach(vx => {
      bullets.push({ x: player.x, y: H-50, vx, vy: -500, dmg: L.dmg, w: L.w, h: L.h, col: L.col, fx: L.fx, t: 0 });
    });
    if (pLevel >= MAX_LVL) {   // 满级：机头同时射出激光
      lasers.push({ x: player.x, t: 0, dur: 0.42, dmgT: 0 });
    }
    playSound('shoot');
  }
  function hitEnemy(e, b) {
    e.hp -= b.dmg;
    e.flash = 0.12;
    if (e.hp > 0) {            // 没打死：闪白 + 火花，子弹消失（要再打几下）
      playSound('hit');
      booms.push({ x: b.x, y: b.y, t: 0, big: false, small: true });
      return;
    }
    booms.push({ x: e.x + e.w/2, y: e.y + e.h/2, t: 0, big: true });
    combo++;
    let gain = 10;
    if (combo >= 5) gain += 5;
    score += gain; scoreEl.textContent = score;
    comboEl.textContent = combo >= 2 ? 'x'+combo : '';
    playSound('success');
    // —— 击碎粒子 + 得分飘字 ——
    try{
      for(let k=0;k<10;k++){
        const ang=Math.random()*Math.PI*2, sp=80+Math.random()*140;
        floatTexts.push({ x: e.x+e.w/2, y: e.y+e.h/2, t: 0, txt: '✦', col:'#7ee8fa', vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp-40 });
      }
      floatTexts.push({ x: e.x+e.w/2, y: e.y+e.h/2-10, t: 0, txt: '+' + gain, col:'#ffd700' });
      if(combo>=2) floatTexts.push({ x: e.x+e.w/2, y: e.y+e.h/2-28, t: 0, txt: '🔥 x'+combo, col:'#ff7a00' });
    }catch(e2){}
    e.active = false;
    spawnDrop(e);
    if (!enemies.some(x => x.active && x.term === targetTerm)) {
      if (advanced) {
        const nt = nextActiveTerm();
        if (nt) {
          targetTerm = nt;
          termIdx = Math.max(0, termList.indexOf(nt));
          if (termEl) termEl.textContent = nt;
          window.showToast('🎯 炮口已切换 → ' + nt, 'info');
          playSound('click');
        }
      } else {
        targetTerm = pickNextTarget();
      }
    }
  }
  function spawnDrop(e) {
    if (Math.random() > 0.18) return;
    const roll = Math.random();
    let type = 'P';
    if (roll < 0.12) type = '☄';
    else if (roll < 0.27) type = '⏳';
    else if (roll < 0.40) type = '💎';
    else if (roll < 0.62) type = '❤';
    drops.push({ x: e.x + e.w/2, y: e.y + e.h/2, type, vy: 75 + Math.random()*35, t: 0, consumed: false });
  }
  function collectDrop(d) {
    d.consumed = true;
    picked++;
    playSound('pickup');
    if (d.type === 'P') {
      if (pLevel < MAX_LVL) {
        pLevel++;
        powerEl.textContent = 'x' + (pLevel+1);
        playSound('levelup');
        floatTexts.push({ x: player.x, y: H-64, txt: '🚀 火力 ' + (pLevel+1) + ' 级！', t: 0, col: '#7ee8fa' });
      } else {
        score += 20; scoreEl.textContent = score;
        floatTexts.push({ x: player.x, y: H-64, txt: '+20 火力已满', t: 0, col: '#ffe066' });
      }
    } else if (d.type === '❤') {
      lives = Math.min(LIVES + 2, lives + 1);
      livesEl.textContent = lives;
      playSound('levelup');
      floatTexts.push({ x: player.x, y: H-64, txt: '❤ +1 命', t: 0, col: '#ff7a7a' });
    } else if (d.type === '⏳') {
      slowT = 8;
      playSound('levelup');
      floatTexts.push({ x: player.x, y: H-64, txt: '⏳ 全场缓速 8 秒', t: 0, col: '#7ec8ff' });
    } else if (d.type === '💎') {
      score += 50; scoreEl.textContent = score;
      playSound('levelup');
      floatTexts.push({ x: player.x, y: H-64, txt: '💎 财宝 +50', t: 0, col: '#c9a6ff' });
    } else { // ☄ 全屏爆破
      let cleared = 0;
      enemies.forEach(e => {
        if (!e.active) return;
        e.active = false; cleared++;
        score += 10;
        booms.push({ x: e.x + e.w/2, y: e.y + e.h/2, t: 0, big: true });
      });
      scoreEl.textContent = score;
      playSound('fanfare');
      targetTerm = pickNextTarget();
      floatTexts.push({ x: player.x, y: H-64, txt: '☄ 全屏爆破 +' + (cleared*10), t: 0, col: '#ffb000' });
    }
  }
  function loseLife() {
    if (invuln > 0) return;
    lives--; livesEl.textContent = lives;
    invuln = 2;
    booms.push({ x: player.x, y: H-26, t: 0, big: true });
    playSound('error');
    if (lives <= 0) { endGame(false); }
  }
  function endGame(isWin) {
    if (ended) return;
    ended = true; win = isWin;
    if (win) { window.recordGameWin('shooter'); window.miniMarkClear(cfg.id); playSound('success'); }
    try{
      const gs = window.getGameStats();
      gs.shooterPlays = (gs.shooterPlays||0)+1;
      gs.shooterBest = Math.max(gs.shooterBest||0, score);
      gs.shooterWaves = Math.max(gs.shooterWaves||0, wave);
      gs.shooterCombo = Math.max(gs.shooterCombo||0, combo);
      gs.shooterMaxLevel = Math.max(gs.shooterMaxLevel||0, pLevel+1);
      gs.shooterPickups = (gs.shooterPickups||0) + picked;
      window.saveGameStats(gs);
    }catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML =
        '<div style="font-size:46px;line-height:1">'+(win?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(win?'var(--green)':'var(--red)')+';margin-top:8px">'+(win?'编队全清！工厂安全！':'防线被突破')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">配对命中 <b style="color:var(--amber)">'+score+'</b> 分 · 打到第 '+Math.min(wave,WAVES)+'/'+WAVES+' 波</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px">'+
          '<button class="mm-btn" onclick="window.shAgain()">🔁 再玩一次</button>'+
          '<button class="mm-btn primary" onclick="window.shDone()">收下奖励</button>'+
        '</div>';
      window.focusResultPrimary(overlay);
      overlay.innerHTML = '';
      overlay.appendChild(res);
    }, 300);
  }
  window.shAgain = () => { overlay.remove(); openShooter(cfg, onComplete); };
  window.shDone = () => { if (onComplete) onComplete(win); overlay.remove(); };
  function closeGame(manual) {
    if (ended) return;
    ended = true; cancelAnimationFrame(raf);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); window.playAreaMusic(); }
  }

  document.addEventListener('keydown', kd);
  document.addEventListener('keyup', ku);
  function kd(e){
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    else if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    else if (advanced && (e.key === 'ArrowUp' || e.key === 'w')) { e.preventDefault(); cycleTerm(1); }
    else if (advanced && (e.key === 'ArrowDown' || e.key === 's')) { e.preventDefault(); cycleTerm(-1); }
    else if (e.key === ' ') { e.preventDefault(); fire(); }
    else if (e.key === 'Escape') { closeGame(false); }
  }
  function ku(e){ if (e.key==='ArrowLeft'||e.key==='a') keys.left=false; else if (e.key==='ArrowRight'||e.key==='d') keys.right=false; }
  let dragging = false;
  // 触摸手势（进阶模式同样适用）：
  //  水平拖动 = 移动飞机（躲子弹），垂直滑动 = 切换炮口（up=下一个 / down=上一个）
  //  首次位移超阈值锁定手势方向，防止斜滑误触
  let gesture = null, gX = 0, gY = 0, gAcc = 0;
  cv.addEventListener('pointerdown', e => { dragging = true; gesture = null; gX = e.clientX; gY = e.clientY; gAcc = 0; e.preventDefault(); });
  cv.addEventListener('pointermove', e => {
    if (!dragging) return;
    const r = cv.getBoundingClientRect();
    const dx = e.clientX - gX, dy = e.clientY - gY;
    if (!gesture) {
      if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return;
      gesture = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';   // 锁定水平/垂直
    }
    if (gesture === 'h') {
      player.x = Math.max(20, Math.min(W-20, (e.clientX - r.left) / sfx));
      gX = e.clientX; gY = e.clientY;
    } else {
      // 垂直：累计位移超阈值切换一次炮口（防抖），可连续滑连续切
      gAcc += dy;
      if (Math.abs(gAcc) >= 34) {
        if (advanced) cycleTerm(gAcc > 0 ? 1 : -1);
        gAcc = 0; gX = e.clientX; gY = e.clientY;
      }
    }
    e.preventDefault();
  });
  cv.addEventListener('pointerup', () => { dragging = false; gesture = null; });
  cv.addEventListener('pointercancel', () => { dragging = false; gesture = null; });

  function update(dt) {
    if (ended) return;
    if (invuln > 0) invuln -= dt;
    // 自动开火（一直打，降低难度）
    fireCd -= dt;
    if (fireCd <= 0) fire();
    if (muzzle > 0) muzzle -= dt;
    // 移动
    const spd = 300;
    if (keys.left) player.x -= spd*dt;
    if (keys.right) player.x += spd*dt;
    player.x = Math.max(20, Math.min(W-20, player.x));
    // 全场缓速计时
    if (slowT > 0) slowT -= dt;
    // 编队移动（更慢：第 1 波最慢，逐波加快；缓速时更慢）
    const fMul = slowT > 0 ? 0.55 : 1;
    formX += formDir * (9 + wave*2) * fMul * dt;
    if (formX > W - COLS*118 - 20) { formDir = -1; formY += formStep; }
    if (formX < 30) { formDir = 1; formY += formStep; }
    enemies.forEach(e => {
      if (!e.active) return;
      e.x = formX + e.c*118;
      e.y = formY + e.r*ROW_PITCH;
      if (e.flash > 0) e.flash -= dt;
      if (e.y > H - 60) { loseLife(); e.active=false; }
    });
    // 我方子弹（含横向速度 + 拖尾计时）
    bullets.forEach(b => { b.x += b.vx*dt; b.y += b.vy*dt; b.t += dt; });
    bullets = bullets.filter(b => b.y > -20);
    // 激光：持续光束，对光束内的配对目标持续伤害
    lasers.forEach(l => {
      l.t += dt; l.dmgT += dt;
      if (l.dmgT >= 0.12) {
        l.dmgT = 0;
        enemies.forEach(e => {
          if (!e.active || e.term !== targetTerm) return;
          if (l.x > e.x - 10 && l.x < e.x + e.w + 10) hitEnemy(e, { dmg: 2 });
        });
      }
    });
    lasers = lasers.filter(l => l.t < l.dur);
    // 道具：下落 → 底部停留 → 拾取
    drops.forEach(d => { if (d.y < H - 36) d.y += d.vy*dt; d.t += dt; });
    drops.forEach(d => { if (d.y > H - 60 && Math.abs(d.x - player.x) < 28) collectDrop(d); });
    drops = drops.filter(d => !d.consumed && d.t < 9);
    // 敌方子弹（第 1 波不打，第 2 波起更慢更少）
    if (wave >= 2) {
      efireCd -= dt;
      if (efireCd <= 0) {
        efireCd = Math.max(1.6, 3.4 - wave*0.2) * (slowT > 0 ? 1.5 : 1);
        const shooters = enemies.filter(e=>e.active && e.r === ROWS-1);
        if (shooters.length) {
          const s = shooters[Math.floor(Math.random()*shooters.length)];
          ebullets.push({ x: s.x + s.w/2, y: s.y + s.h, vy: 120 + wave*8, w:4, h:10 });
        }
      }
    }
    ebullets.forEach(b => { b.y += b.vy*dt; });
    ebullets = ebullets.filter(b => b.y < H+20);
    // 碰撞
    bullets.forEach(b => {
      enemies.forEach(e => {
        if (!e.active) return;
        if (b.x > e.x && b.x < e.x+e.w && b.y > e.y && b.y < e.y+e.h) {
          if (e.term === targetTerm) { b.hit = true; hitEnemy(e, b); }
          else { booms.push({ x: b.x, y: b.y, t: 0, big: false, small: true }); }
        }
      });
    });
    bullets = bullets.filter(b => !b.hit);
    ebullets.forEach(b => {
      if (b.x > player.x-17 && b.x < player.x+17 && b.y > H-52 && b.y < H-24) { b.hit = true; loseLife(); }
    });
    ebullets = ebullets.filter(b => !b.hit);
    booms.forEach(b => b.t += dt);
    booms = booms.filter(b => b.t < 0.5);
    floatTexts.forEach(f => f.t += dt);
    floatTexts = floatTexts.filter(f => f.t < 1.3);
    if (enemies.every(e => !e.active)) {
      if (wave >= WAVES && !cfg._endless) { endGame(true); return; }   // 无限战：不结算，继续
      wave++; waveEl.textContent = wave;
      makeWave();
      window.showToast('🌊 第 '+wave+' 波编队来袭！', 'success');
    }
  }

  function draw(dt) {
    ctx.clearRect(0,0,W,H);
    const sf = Math.max(0.6, cw / W);   // 显示缩放（手机端字也跟着变大）
    // 背景网格
    ctx.strokeStyle = 'rgba(0,188,212,.12)';
    ctx.lineWidth = 1;
    for(let i=0;i<W;i+=40){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,H); ctx.stroke(); }
    for(let j=0;j<H;j+=40){ ctx.beginPath(); ctx.moveTo(0,j); ctx.lineTo(W,j); ctx.stroke(); }
    // 顶部目标名词：清晰显示当前要打 / 炮口匹配的名词（大字号+背景板），供玩家据此选火炮
    ctx.save();
    ctx.globalAlpha = 1;
    const _tl = targetTerm || '—';
    ctx.font = 'bold ' + Math.max(14, Math.round(20 / sf)) + 'px "Courier New", monospace';
    const _tw = ctx.measureText('🎯 ' + _tl).width;
    const _pad = 16, _bh = Math.max(26, Math.round(26 / sf));
    ctx.fillStyle = 'rgba(0,0,0,.72)';
    ctx.fillRect(W / 2 - _tw / 2 - _pad, 6, _tw + _pad * 2, _bh);
    ctx.strokeStyle = 'rgba(126,232,250,.65)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(W / 2 - _tw / 2 - _pad, 6, _tw + _pad * 2, _bh);
    ctx.fillStyle = '#7ee8fa';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🎯 ' + _tl, W / 2, 6 + _bh / 2);
    ctx.restore();

    // 敌人（名词）：进阶模式全部显示名词标签+血量，靠玩家主动匹配炮口；基础模式只高亮配对目标
    enemies.forEach(e => {
      if (!e.active) return;
      const match = e.term === targetTerm;
      if (!match) ctx.globalAlpha = 0.4;
      ctx.fillStyle = match ? '#ffb000' : skin.col;
      ctx.strokeStyle = match ? '#fff' : 'rgba(0,0,0,.6)';
      ctx.lineWidth = match ? 2 : 1;
      ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.strokeRect(e.x, e.y, e.w, e.h);
      if (match) {
        // 只显示当前目标(targetTerm)对应的名词+血量——与飞机上的解释成对；其它敌人不显示名词(半透明)
        const label = e.term;
        const fs = Math.max(9, Math.min(14, Math.floor(90 / Math.max(1, label.length) * 1.5)));
        ctx.font = 'bold ' + Math.round(fs/sf) + 'px "Courier New", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillText(label, e.x + e.w/2 + 1, e.y - 9 + 1);
        ctx.fillStyle = '#fff7d6';
        ctx.fillText(label, e.x + e.w/2, e.y - 9);
        const pw = 40, px = e.x + e.w/2 - pw/2, py = e.y + e.h - 7;
        for (let i=0;i<e.maxHp;i++) {
          const on = i < e.hp;
          ctx.fillStyle = on ? (e.hp === 1 ? '#ff5f57' : '#ffd27d') : 'rgba(255,255,255,.12)';
          ctx.fillRect(px + i*(pw/e.maxHp + 3), py, pw/e.maxHp, 4);
        }
      }
      // 命中闪白
      if (e.flash > 0) {
        ctx.globalAlpha = Math.min(1, e.flash/0.12) * 0.85;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(e.x, e.y, e.w, e.h);
      }
      ctx.globalAlpha = 1;
    });
    // 玩家（飞机带解释，火力高时带光环）
    if (invuln <= 0 || Math.floor(invuln*8)%2===0) {
      if (pLevel >= 2) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#ffb000';
        ctx.beginPath(); ctx.arc(player.x, H-48, 10 + pLevel*2, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      var _ps = window.PLANE_SKINS[window.getEquippedSkin('plane')] || window.PLANE_SKINS.default;
      ctx.fillStyle = _ps.col;
      ctx.beginPath();
      ctx.moveTo(player.x, H-50); ctx.lineTo(player.x-18, H-26); ctx.lineTo(player.x+18, H-26);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = _ps.ck;
      ctx.fillRect(player.x-3, H-44, 6, 8);
      // 火力 ≥1：机尾喷焰
      if (pLevel >= 1) {
        ctx.fillStyle = BULLET_LVLS[pLevel].col;
        ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(player.x, H-24, 3 + pLevel, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    // 枪口闪光
    if (muzzle > 0) {
      ctx.globalAlpha = muzzle/0.08;
      ctx.fillStyle = BULLET_LVLS[pLevel].col;
      ctx.beginPath(); ctx.arc(player.x, H-51, 6, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // 进阶：飞机炮口标签（当前装载的名词，要主动匹配敌人）显示在机头上方
    if (advanced && targetTerm) {
      // 进阶：炮口装载的是「名词对应的解释」（与敌人名词成对），玩家据此选武器打对应名词
      const tag = '🧩 ' + (hintOf[targetTerm] || targetTerm);
      ctx.font = 'bold ' + Math.round(12/sf) + 'px "Courier New", monospace';
      const tw = ctx.measureText(tag).width + 14;
      const ty = H - 64;
      ctx.fillStyle = 'rgba(0,0,0,.72)';
      ctx.strokeStyle = '#7ee8fa';
      ctx.lineWidth = 1.5;
      ctx.fillRect(player.x - tw/2, ty - 14, tw, 18);
      ctx.strokeRect(player.x - tw/2, ty - 14, tw, 18);
      ctx.fillStyle = '#7ee8fa';
      ctx.textAlign = 'center';
      ctx.fillText(tag, player.x, ty - 1);
    }
    // 飞机下的解释（配对线索）
    const hint = hintOf[targetTerm] || targetTerm;
    ctx.fillStyle = '#ffd27d';
    ctx.font = 'bold ' + Math.round(14/sf) + 'px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🧩 ' + hint, player.x, H - 4);
    // 激光束（满级武器）
    lasers.forEach(l => {
      const a = Math.max(0, 1 - l.t/l.dur);
      ctx.globalAlpha = 0.9*a;
      ctx.fillStyle = '#ff8fd8';
      ctx.fillRect(l.x - 5, 0, 10, H - 50);
      ctx.globalAlpha = 0.35*a;
      ctx.fillRect(l.x - 11, 0, 22, H - 50);
      ctx.globalAlpha = 1;
    });
    // 子弹（按火力等级带不同特效：拖尾/光晕/加宽）
    bullets.forEach(b => {
      ctx.save();
      if (b.fx >= 1) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = b.col;
        ctx.lineWidth = b.w + 4;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx*0.02, b.y - b.vy*0.02); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = b.col;
      if (b.fx >= 2) {
        ctx.globalAlpha = 0.45;
        ctx.fillRect(b.x - b.w/2 - 2, b.y - b.h/2 - 2, b.w + 4, b.h + 4);
        ctx.globalAlpha = 1;
      }
      ctx.fillRect(b.x - b.w/2, b.y - b.h/2, b.w, b.h);
      ctx.restore();
    });
    ctx.fillStyle = '#ff5555';
    ebullets.forEach(b => ctx.fillRect(b.x-2, b.y-5, 4, 10));
    // 道具掉落（P 火力 / ❤ 回命 / ☄ 爆破）
    drops.forEach(d => {
      const y = Math.min(d.y, H - 38);
      const bob = Math.sin(d.t*4) * 2;
      const alpha = (d.y > H - 38 && d.t > 7.5) ? Math.max(0.2, 1 - (d.t - 7.5)) : 1;
      ctx.globalAlpha = alpha;
      const col = d.type === 'P' ? '#7ee8fa' : d.type === '❤' ? '#ff7a7a' : d.type === '⏳' ? '#5ac8ff' : d.type === '💎' ? '#c9a6ff' : '#ffb000';
      ctx.fillStyle = col;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(d.x, y + bob, 10, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#061018';
      ctx.font = 'bold ' + Math.round(12/sf) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.type, d.x, y + bob + 1);
      ctx.globalAlpha = 1;
    });
    // 拾取飘字
    floatTexts.forEach(f => {
      // 粒子型(带vx/vy)：做抛物线飘散
      if (f.vx) { f.x += f.vx*dt; f.y += f.vy*dt; f.vy += 220*dt; }
      ctx.globalAlpha = Math.max(0, 1 - f.t/1.2);
      ctx.fillStyle = f.col;
      ctx.font = 'bold ' + Math.round(15/sf) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.txt, f.x, f.y - (f.vx ? 0 : f.t*42));
      ctx.globalAlpha = 1;
    });
    // 爆炸
    booms.forEach(b => {
      const a = 1 - b.t/0.5;
      ctx.globalAlpha = a;
      ctx.fillStyle = b.big ? '#ffb000' : '#ff7a00';
      const r = 8 + b.t*60;
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    });
    // 缓速指示
    if (slowT > 0) {
      ctx.globalAlpha = Math.min(1, slowT);
      ctx.fillStyle = '#7ec8ff';
      ctx.font = 'bold ' + Math.round(13/sf) + 'px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('⏳ 全场缓速 ' + slowT.toFixed(1) + 's', 10, 22);
      ctx.globalAlpha = 1;
    }
  }

  let last = performance.now();
  function loop(now) {
    if (ended) return;
    const dt = Math.min(0.05, (now - last)/1000);
    last = now;
    try { update(dt); draw(dt); }
    catch(e){ console.error('[数据蜂群] 循环异常：', e); }
    raf = requestAnimationFrame(loop);
  }
  let raf;
  window.shooterBuff = null;   // 已应用，清掉本次加成
  makeWave();
  raf = requestAnimationFrame(loop);
}
