// ═══════════════════════════════════════════════════════════════════
// games/typing — 拆自 app.js（openTypingDefense）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openTypingDefense(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('typing')) { window.showTypingTutorial(cfg, function(){ openTypingDefense(cfg, onComplete); }); return; }
  playMusic(window.gameSong('typing') || 'match');
  const words = (cfg.words || []).filter(Boolean).map(String);
  if (!words.length) { window.showToast('没有可用的关键词', 'error'); return; }
  // 难度随游玩次数递进：新手(首玩必能通) → 进阶 → 高手
  const _tw = (window.getGameStats().typingWins || 0);
  const _diff = cfg._hard ? 2 : Math.min(_tw, 2);   // 二周目直接上高手场
  const switchEnabled = _diff >= 1;   // 进阶/高手场开放 TAB 切词
  const LV = [
    { name:'新手场', waves:2, perWave:3, lives:6, wt:20, spd:5, acc:0.12, max:18, s0:3300, smin:1200 },
    { name:'进阶场', waves:3, perWave:4, lives:5, wt:18, spd:6, acc:0.16, max:22, s0:3000, smin:1000 },
    { name:'高手场', waves:4, perWave:5, lives:5, wt:15, spd:7, acc:0.2,  max:26, s0:2800, smin:850  }
  ][_diff];
  const LIVES = LV.lives;
  const WAVES = LV.waves;
  const WAVE_TIME = LV.wt;             // 每波秒数
  const BASE_SPEED = LV.spd, ACCEL = LV.acc, SPAWN0 = LV.s0, SPAWN_MIN = LV.smin, MAX_SPEED = LV.max;

  function tier(text){ const n=text.length; const mul=Math.max(0.8, Math.min(1.2, 1.25 - (n-3)*0.05)); return {mul:mul, pt:n>=8?14:n>=5?10:8}; }   // 越长掉得越慢（短词快、长词慢，好打字）
  const bossPool = words.filter(w=>w.length>=7).length>=3 ? words.filter(w=>w.length>=7) : words.slice().sort((a,b)=>b.length-a.length).slice(0, Math.min(6, words.length));

  let lives = LIVES, score = 0, combo = 0, win = false;
  let wave = 1, waveLeft = 0, bossActive = false;
  let elapsed = 0;   // 通关计时（秒），不做限时
  let paused = false, ended = false;
  let typed = '';
  let typedWord = null;   // 锁定目标：一旦开打某个词就只跟它比
  let active = [];
  let spawnTimer = null, loopTimer = null, t0 = Date.now();
  let field = null;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:9500;display:flex;align-items:center;justify-window.content:center';
  overlay.innerHTML = `
    <div class="ty-box">
      <div class="mm-head">
        <div>
          <div class="mm-title">🔫 术语防御战 · <span id="tyDiff" style="color:#8b91a6;font-size:15px">${LV.name}</span></div>
          <div class="mm-sub">${escHtml(cfg.name || '')} —— 分波防守，只记通关用时；Boss 要打两遍${switchEnabled ? '；TAB 切换目标词' : ''}</div>
        </div>
        <div class="mm-close" title="关闭">✕</div>
      </div>
      <div class="ty-stats">
        <span>❤️ <b id="tyLives">${LIVES}</b></span>
        <span>🌊 第 <b id="tyWave">1</b>/${WAVES} 波</span>
        <span>剩 <b id="tyLeft">0</b></span>
        <span>⏱ <b id="tyTime">0</b>s</span>
        <span>🎯 <b id="tyScore">0</b></span>
        <span>⌨️ <b id="tyTyped" style="color:var(--amber)">…</b></span>
        <span>🔥 <b id="tyCombo" style="color:#ff7a00"></b></span>
      </div>
      <div class="ty-field" id="tyField"></div>
      <div class="ty-cannon" id="tyCannon">🔫</div>
      <input id="tyInput" autocomplete="off" spellcheck="false" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none">
    </div>
  `;
  document.body.appendChild(overlay);
  const box = overlay.querySelector('.ty-box');
  field = document.getElementById('tyField');
  function showWordHint(x, y, text){
    if(!text) return;
    const d=document.createElement('div');
    d.className='ty-word-hint';
    d.textContent = text;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    field.appendChild(d);
    setTimeout(()=>{ try{ d.remove(); }catch(e){} }, 1700);
  }
  const input = document.getElementById('tyInput');
  const livesEl = document.getElementById('tyLives');
  const scoreEl = document.getElementById('tyScore');
  const timeEl = document.getElementById('tyTime');
  const typedEl = document.getElementById('tyTyped');
  const comboEl = document.getElementById('tyCombo');
  const waveEl = document.getElementById('tyWave');
  const leftEl = document.getElementById('tyLeft');
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  box.addEventListener('mousedown', e => e.preventDefault());

  function waveNeed(w){ return LV.perWave + w - 1; }
  function waveSpeedMul(){ return 1 + (wave - 1) * 0.08; }
  function wordSpeed(){ const el=(Date.now()-t0)/1000; return Math.min(BASE_SPEED + ACCEL*el, MAX_SPEED) * waveSpeedMul(); }

  // 爆炸特效
  function boomEffect(x, y, big){
    const chars=['💥','✦','✧','⭐','💫'];
    const n = big ? 14 : 9;
    for(let i=0;i<n;i++){
      const s=document.createElement('span');
      s.className='ty-boom-p'+(big?' big':'');
      s.textContent=chars[i%chars.length];
      s.style.left=x+'px'; s.style.top=y+'px';
      s.style.setProperty('--dx', (Math.random()*90-45)+'px');
      s.style.setProperty('--dy', (Math.random()*-80-10)+'px');
      field.appendChild(s);
      setTimeout(()=>s.remove(), 650);
    }
  }

  function spawnWord() {
    if (ended || paused) return;
    // 场上已有同名词（含 BOSS、含正在录入的词）则重抽，避免同时出现两个一样的词
    let text = null;
    for (let _g = 0; _g < 30; _g++) {
      const c = words[Math.floor(Math.random() * words.length)];
      if (!active.some(function(w){ return w.text === c; })) { text = c; break; }
    }
    if (!text) { spawnTimer = setTimeout(spawnWord, 700); return; }   // 场上全被占用，稍后再试
    const t = tier(text);
    const el = document.createElement('div');
    el.className = 'ty-word';
    el.textContent = text;
    const maxX = Math.max(10, field.clientWidth - 140);
    el.style.left = (10 + Math.random() * maxX) + 'px';
    el.style.top = '0px';
    field.appendChild(el);
    active.push({ text, y:0, el, disp: text, speed: wordSpeed() * t.mul * (0.95 + Math.random()*0.1), pt: t.pt, boss:false });
    const gap = Math.max(SPAWN_MIN, SPAWN0 - (wave-1)*120);
    spawnTimer = setTimeout(spawnWord, gap);
  }
  function spawnBoss() {
    bossActive = true;
    const text = bossPool[Math.floor(Math.random()*bossPool.length)];
    // 场上若有同名普通词，先清掉——只留 BOSS 这一个，锁词不会打错目标
    const _dups = active.filter(function(w){ return !w.boss && w.text === text; });
    _dups.forEach(function(w){ try{ w.el.remove(); }catch(e){} var i=active.indexOf(w); if(i>=0) active.splice(i,1); });
    const el = document.createElement('div');
    el.className = 'ty-word ty-boss';
    el.textContent = '👑 ' + text;
    const maxX = Math.max(10, field.clientWidth - 190);
    el.style.left = (10 + Math.random() * maxX) + 'px';
    el.style.top = '0px';
    field.appendChild(el);
    active.push({ text, y:0, el, disp: '👑 ' + text, speed: wordSpeed() * 0.55, pt: 30, boss:true, hp:2, hit:0 });
    leftEl.textContent = '👑';
    // 无超时限制，继续计通关用时
    playSound('alarm');
    // 暂停 + 提示
    paused = true;
    clearTimeout(spawnTimer);
    const tip = document.createElement('div');
    tip.className = 'ty-boss-tip';
    tip.innerHTML = '👑 <b>BOSS 来袭！</b>它很硬，要<u>打两遍</u>——打一遍会受伤，再打一遍才打爆！<button class="mm-btn primary" id="bossGo" style="margin-top:8px">开打！</button>';
    field.appendChild(tip);
    var _bg = document.getElementById('bossGo');
    _bg.onclick = () => { tip.remove(); paused = false; spawnTimer = setTimeout(spawnWord, 1400); input.focus(); };
    _bg.focus();   // 聚焦按钮：回车/空格 = 明确开打，不再是误触
  }

  function clearScreen() {
    active.forEach(w => { try{ w.el.remove(); }catch(e){} });
    active = [];
    clearTimeout(spawnTimer);
    if (typedWord) { typed = ''; if (typedEl) typedEl.textContent = '…'; typedWord = null; }
  }

  function fireCannon(w, hit) {
    // 命中判定：boss 2 血
    if (w.boss && w.hit === 0) {
      w.hit = 1;
      w.el.classList.add('ty-boss-hit');
      boomEffect(w.el.offsetLeft + w.el.offsetWidth/2, w.el.offsetTop + w.el.offsetHeight/2, true);
      playSound('error');
      combo = 0; if(comboEl) comboEl.textContent='';
      window.showToast('💥 BOSS 中招！再打一遍！', 'error');
      return;
    }
    // 打爆（含 boss 第二下）
    const cannonEl = document.getElementById('tyCannon');
    const cb = cannonEl.getBoundingClientRect(), fb = field.getBoundingClientRect();
    const cx = cb.left + cb.width/2 - fb.left, cy = cb.top - fb.top - 6;
    const bullet = document.createElement('div');
    bullet.className = 'ty-bullet';
    bullet.style.left = cx + 'px'; bullet.style.top = cy + 'px';
    field.appendChild(bullet);
    const tx = w.el.offsetLeft + w.el.offsetWidth/2, ty = w.el.offsetTop + w.el.offsetHeight/2;
    requestAnimationFrame(() => { bullet.style.transform = 'translate('+(tx-cx)+'px,'+(ty-cy)+'px)'; });
    setTimeout(() => {
      bullet.remove();
      boomEffect(tx, ty, !!w.boss);
      showWordHint(tx, ty - 14, window.TY_HINTS[w.text] || w.text);   // 爆炸中心显示该命令的作用
      w.el.classList.add('ty-boom');
      setTimeout(() => { w.el.remove(); const idx=active.indexOf(w); if(idx>=0) active.splice(idx,1); }, 180);
      combo++;
      const gain = w.pt + (combo>=6?10 : combo>=3?5 : 0);
      score += gain; scoreEl.textContent = score;
      comboEl.textContent = combo>=2 ? 'x'+combo : '';
      playSound('success');
      // —— 打爆飘字：得分 + 连击提示 ——
      try{
        const s2=document.createElement('div');
        s2.className='ty-score-float';
        s2.textContent = '+'+gain;
        s2.style.cssText='left:'+(tx)+'px;top:'+(ty-8)+'px';
        field.appendChild(s2);
        setTimeout(()=>{ try{s2.remove();}catch(e){} }, 800);
        if(combo>=3){
          const c2=document.createElement('div');
          c2.className='ty-combo-float';
          c2.textContent = '🔥 连击 x'+combo;
          c2.style.cssText='left:'+(tx)+'px;top:'+(ty-30)+'px';
          field.appendChild(c2);
          setTimeout(()=>{ try{c2.remove();}catch(e){} }, 900);
        }
      }catch(e3){}
      if (w.boss) {
        // 清屏 → 下一波 / 通关
        clearScreen();
        if (wave >= WAVES && !cfg._endless) { endGame(true); return; }   // 无限战：不结算继续
        wave++; bossActive = false; waveLeft = waveNeed(wave);
        waveEl.textContent = wave; leftEl.textContent = waveLeft;
        window.showToast('🌊 第 '+wave+' 波！清屏加速', 'success');
        spawnTimer = setTimeout(spawnWord, 800);
      } else {
        waveLeft--; leftEl.textContent = Math.max(0, waveLeft);
        if (waveLeft <= 0 && !bossActive) { spawnBoss(); }
      }
    }, 240);
  }

  function leakWord(w) {
    if (w.leaked) return;
    if (typedWord === w) { typed = ''; if (typedEl) typedEl.textContent = '…'; typedWord = null; }
    w.leaked = true; combo = 0; if(comboEl) comboEl.textContent='';
    w.el.classList.add('ty-leak');
    setTimeout(() => { w.el.remove(); const idx=active.indexOf(w); if(idx>=0) active.splice(idx,1); }, 200);
    lives--; livesEl.textContent = lives;
    field.classList.remove('ty-hit'); void field.offsetWidth; field.classList.add('ty-hit');
    playSound('error');
    if (lives <= 0) endGame(false);
  }

  function resetWordDisp(w) { if (w && w.el) w.el.innerHTML = escHtml(w.disp || w.text); }
  function switchTarget() {           // 进阶/高手场：TAB 在候选词里切换目标
    if (!switchEnabled || ended || paused) return;
    const cands = active.filter(w => w.text.indexOf(typed) === 0);
    if (cands.length < 2) return;
    const cur = typedWord ? cands.indexOf(typedWord) : -1;
    const next = cands[(cur + 1) % cands.length];
    if (typedWord && typedWord !== next) {
      typedWord.el.classList.remove('ty-target');
      resetWordDisp(typedWord);
    }
    typedWord = next;
    if (typed) {
      typedWord.el.classList.remove('ty-target');
      typedWord.el.innerHTML = '<span class="ty-prefix">'+escHtml(typed)+'</span>'+escHtml(typedWord.text.slice(typed.length));
    } else {
      typedWord.el.classList.add('ty-target');
    }
    playSound('click');
  }
  function clearTyped() {
    typed = ''; typedEl.textContent = '…';
    if (typedWord) { typedWord.el.classList.remove('ty-target'); resetWordDisp(typedWord); typedWord = null; }
  }
  function onKey(ch) {
    if (ended || paused) return;
    playSound('type');
    if (typedWord) {
      // 已锁定目标：只跟它比，打错就清空重来（不会悄悄切到别的词）
      if (typedWord.text.indexOf(typed + ch) === 0) {
        typed += ch; typedEl.textContent = typed;
        typedWord.el.classList.remove('ty-target');
        typedWord.el.innerHTML = '<span class="ty-prefix">'+escHtml(typed)+'</span>'+escHtml(typedWord.text.slice(typed.length));
        if (typed === typedWord.text) { const w = typedWord; clearTyped(); fireCannon(w); }
      } else {
        clearTyped();
        combo = 0; if (comboEl) comboEl.textContent = '';
        field.classList.remove('ty-err'); void field.offsetWidth; field.classList.add('ty-err');
      }
      return;
    }
    // 新开一个词：锁定到「最靠近炮台」的匹配词
    const cands = active.filter(w => w.text.indexOf(ch) === 0);
    if (!cands.length) {
      combo = 0; if (comboEl) comboEl.textContent = '';
      field.classList.remove('ty-err'); void field.offsetWidth; field.classList.add('ty-err');
      return;
    }
    typedWord = cands.reduce((a, b) => (b.y > a.y ? b : a));
    typed = ch; typedEl.textContent = typed;
    typedWord.el.innerHTML = '<span class="ty-prefix">'+escHtml(typed)+'</span>'+escHtml(typedWord.text.slice(typed.length));
    if (typed === typedWord.text) { const w = typedWord; clearTyped(); fireCannon(w); }
  }
  input.addEventListener('keydown', e => {
    e.preventDefault();
    if (e.key === 'Escape') { closeGame(false); return; }
    if (e.key === 'Tab') { switchTarget(); return; }
    if (e.key.length === 1) onKey(e.key);
  });
  overlay.addEventListener('click', () => input.focus());
  input.focus();

  function tick() {
    if (ended || paused) return;
    const bottom = field.clientHeight - 42;
    active.forEach(w => {
      if (w.leaked) return;
      w.y += w.speed * 0.225;
      w.el.style.top = w.y + 'px';
      if (w.y > bottom) leakWord(w);
    });
    elapsed += 0.1;
    timeEl.textContent = Math.max(0, Math.ceil(elapsed));
  }
  loopTimer = setInterval(tick, 100);

  function endGame(isWin) {
    if (ended) return;
    ended = true; win = isWin;
    clearInterval(loopTimer); clearTimeout(spawnTimer);
    try{
      const _gs = window.getGameStats();
      _gs.typingPlays = (_gs.typingPlays||0) + 1;
      _gs.typingBest = Math.max(_gs.typingBest||0, score);
      _gs.typingWaves = Math.max(_gs.typingWaves||0, wave);
      _gs.typingCombo = Math.max(_gs.typingCombo||0, combo);
      _gs.typingTime = Math.max(_gs.typingTime||0, Math.round((Date.now()-t0)/1000));
      window.saveGameStats(_gs);
    }catch(e){}
    if (win) { window.recordGameWin('typing'); window.miniMarkClear(cfg.id); playSound('success'); }
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML =
        '<div style="font-size:46px;line-height:1">'+(win?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(win?'var(--green)':'var(--red)')+';margin-top:8px">'+(win?'全部防线守住！':'防线失守')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">击落 <b style="color:var(--amber)">'+score+'</b> · 打到第 '+Math.min(wave,WAVES)+'/'+WAVES+' 波 · 剩余 ❤️ '+Math.max(0,lives)+' · 用时 <b style="color:var(--amber)">'+Math.ceil(elapsed)+'</b>s</div>'+
        '<div style="display:flex;gap:10px;justify-window.content:center;margin-top:16px">'+
          '<button class="mm-btn" onclick="window.tyAgain()">🔁 再玩一次</button>'+
          '<button class="mm-btn primary" onclick="window.tyDone()">收下奖励</button>'+
        '</div>';
      window.focusResultPrimary(overlay);
      overlay.innerHTML = '';
      overlay.appendChild(res);
    }, 300);
  }
  window.tyAgain = () => { overlay.remove(); openTypingDefense(cfg, onComplete); };
  window.tyDone = () => { if (onComplete) onComplete(win); overlay.remove(); };

  function closeGame(manual) {
    if (ended) return;
    ended = true; clearInterval(loopTimer); clearTimeout(spawnTimer);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); window.playAreaMusic(); }
  }
  // 开波
  waveLeft = waveNeed(1); leftEl.textContent = waveLeft;
  spawnWord();
}
