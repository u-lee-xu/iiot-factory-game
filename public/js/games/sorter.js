// ═══════════════════════════════════════════════════════════════════
// games/sorter — 拆自 app.js（openSorter）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openSorter(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('sorter')) {
    window.showGameTutorial('sorter', '📦 数据分类大师', [
      '数据<b>从上方落下</b>，在它滑到<b>判定线</b>前，点下方<b>正确的分类筐</b>接住它',
      '点错筐，或让它滑过判定线漏掉，都会 <b>-1 命</b>',
      '越接近判定线接住，<b>PERFECT</b> 加分越多；连续接对连击加分',
      '清完一波过关，越来越快'
    ], function(){ openSorter(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('sorter') || 'match');
  const cats = (cfg.categories || []).map(c => ({ name: String(c.name||''), icon: c.icon||'📦' }));
  const items = (cfg.items || []).filter(it => it && it.label && typeof it.cat === 'number').map(it => ({ label: String(it.label), cat: it.cat }));
  if (!cats.length || !items.length) { window.showToast('没有可分类的数据', 'error'); return; }
  const WAVES = cfg._endless ? 999 : (cfg.waves || 3);
  const PER = cfg.perWave || 10;
  const LIVES = cfg._hard ? 2 : (cfg.lives || 3);
  const HIT_Y = 232;      // 判定线（与 CSS .so-belt::after 对齐）
  const LEAK_Y = 292;     // 漏接线：滑过即失败

  let lives = LIVES, score = 0, combo = 0, wave = 1, done = 0, processed = 0, totalSorted = 0, ended = false;
  let belt = [], queue = [], spawnT = 0, last = 0, raf = 0;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="so-box">
      <div class="mm-head"><div><div class="mm-title">📦 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="so-stats">
        <span>❤️ <b id="soLives">${LIVES}</b></span>
        <span>🌊 第 <b id="soWave">1</b>/${WAVES} 波</span>
        <span>📦 <b id="soDone">0</b>/${PER}</span>
        <span>🎯 <b id="soScore">0</b></span>
        <span>🔥 <b id="soCombo" style="color:#ff7a00"></b></span>
      </div>
      <div class="so-belt" id="soBelt"><div class="so-judge" id="soJudge"></div></div>
      <div class="so-bins" id="soBins"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const beltEl = document.getElementById('soBelt');
  const judgeEl = document.getElementById('soJudge');
  const livesEl = document.getElementById('soLives');
  const scoreEl = document.getElementById('soScore');
  const comboEl = document.getElementById('soCombo');
  const waveEl = document.getElementById('soWave');
  const doneEl = document.getElementById('soDone');
  const binsEl = document.getElementById('soBins');

  // 分类筐
  cats.forEach((c, ci) => {
    const b = document.createElement('button');
    b.className = 'so-bin';
    b.innerHTML = '<span class="so-bin-icon">' + (c.icon||'') + '</span><span class="so-bin-name">' + escHtml(c.name) + '</span>';
    b.onclick = () => sortTo(ci, b);
    binsEl.appendChild(b);
  });

  function judge(txt, col){          // 节奏判定飘字
    judgeEl.textContent = txt;
    judgeEl.style.color = col || '#ffd700';
    judgeEl.classList.add('on');
    clearTimeout(judge._t);
    judge._t = setTimeout(() => judgeEl.classList.remove('on'), 500);
  }
  function pickItem(ci) {
    const pool = items.filter(it => it.cat === ci);
    return (pool[Math.floor(Math.random()*pool.length)] || {label:'?'}).label;
  }
  function newWave() {
    done = 0; processed = 0; doneEl.textContent = '0';
    waveEl.textContent = wave;
    queue = [];
    cats.forEach((c, ci) => { queue.push({ label: pickItem(ci), cat: ci }); });
    while (queue.length < PER) {
      const it = items[Math.floor(Math.random()*items.length)];
      queue.push({ label: it.label, cat: it.cat });
    }
    for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [queue[i],queue[j]]=[queue[j],queue[i]]; }
  }
  function itemSpeed() { return (34 + wave*7) * (cfg._hard ? 1.2 : 1); }   // px/s（纵向更慢，节奏从容）
  function spawnGap() { return Math.max(420, 1500 - wave*170); }             // ms
  function removeFromBelt(it) { const i = belt.indexOf(it); if (i >= 0) belt.splice(i,1); }

  function refreshUrgent() {
    let best = null;
    belt.forEach(it => { if (it.y < LEAK_Y && (!best || it.y > best.y)) best = it; });
    belt.forEach(it => { it.el.classList.toggle('so-urgent', it === best); });
  }
  function spawnItem() {
    if (ended || !queue.length) return;
    const q = queue.shift();
    const el = document.createElement('div');
    el.className = 'so-item';
    el.textContent = q.label;
    el.title = q.label;
    el.style.top = '-44px';
    beltEl.appendChild(el);
    belt.push({ el: el, label: q.label, cat: q.cat, y: -44, speed: itemSpeed() });
    refreshUrgent();
  }
  function flyTo(it, btn) {
    const r = btn.getBoundingClientRect(), be = beltEl.getBoundingClientRect();
    it.el.style.transition = 'all .28s ease';
    it.el.style.left = (r.left - be.left + r.width/2) + 'px';
    it.el.style.top = (r.top - be.top + r.height/2) + 'px';
    it.el.style.opacity = '0';
    setTimeout(() => { if (it.el.parentNode) it.el.parentNode.removeChild(it.el); }, 300);
  }
  function sortTo(ci, btn) {
    if (ended) return;
    let best = null;
    belt.forEach(it => { if (it.y < LEAK_Y && (!best || it.y > best.y)) best = it; });
    if (!best) { playSound('click'); return; }
    if (best.cat === ci) {
      const dist = Math.abs(best.y - HIT_Y);
      const rating = dist <= 14 ? 'PERFECT' : dist <= 34 ? 'GOOD' : 'OK';
      const mult = rating === 'PERFECT' ? 3 : rating === 'GOOD' ? 2 : 1;
      combo++; totalSorted++; processed++;
      score += 10 * mult * (1 + Math.floor(combo/5));
      scoreEl.textContent = score;
      comboEl.textContent = combo >= 2 ? 'x'+combo : '';
      done++; doneEl.textContent = Math.min(done, PER);
      playSound('success');
      removeFromBelt(best); flyTo(best, btn);
      judge(rating, rating === 'PERFECT' ? '#ffd700' : rating === 'GOOD' ? '#7ee8fa' : '#9aa3bd');
      // —— 分类成功：粒子 + 得分飘字 ——
      try{
        const bb=btn.getBoundingClientRect(), ob=beltEl.getBoundingClientRect();
        const bx=bb.left+bb.width/2-ob.left, by=bb.top-ob.top;
        for(let k=0;k<10;k++){
          const sp=document.createElement('span');
          sp.className='mm-burst';
          sp.style.cssText='left:'+bx+'px;top:'+by+'px;--mx:'+((Math.random()*90-45))+'px;--my:'+((Math.random()*-70-10))+'px;background:'+['#00e676','#ffd700','#7ee8fa','#b388ff'][k%4];
          beltEl.appendChild(sp);
          setTimeout(()=>{ try{sp.remove();}catch(e){} }, 550);
        }
        const fl=document.createElement('div');
        fl.className='so-float';
        fl.textContent = '+'+ (10 * mult * (1 + Math.floor(combo/5)));
        fl.style.cssText='left:'+bx+'px;top:'+(by-16)+'px';
        beltEl.appendChild(fl);
        setTimeout(()=>{ try{fl.remove();}catch(e){} }, 800);
      }catch(e2){}
      refreshUrgent();
      if (processed >= PER) onWaveClear();
    } else {
      combo = 0; if (comboEl) comboEl.textContent='';
      processed++; lives--; livesEl.textContent = lives;   // 点错也算处理过（扣命）
      best.el.classList.add('so-wrong');
      playSound('error');
      beltEl.classList.remove('so-hit'); void beltEl.offsetWidth; beltEl.classList.add('so-hit');
      judge('MISS', '#ff5252');
      removeFromBelt(best);
      setTimeout(() => { if (best.el.parentNode) best.el.parentNode.removeChild(best.el); }, 240);
      refreshUrgent();
      if (lives <= 0) endGame(false);
    }
  }
  function onWaveClear() {
    if (ended) return;
    belt.forEach(it => { if (it.el.parentNode) it.el.parentNode.removeChild(it.el); });
    belt = [];
    if (wave >= WAVES && !cfg._endless) { endGame(true); return; }
    wave++; newWave();
    spawnT = 600;
    window.showToast('🌊 第 '+wave+' 波！更快了', 'success');
  }
  function endGame(isWin) {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    if (isWin) { window.recordGameWin('sorter'); window.miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs = window.getGameStats(); _gs.sorterBest = Math.max(_gs.sorterBest||0, score); _gs.sorterCombo = Math.max(_gs.sorterCombo||0, combo); window.saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'全部归位，产线顺畅！':'分拣超载，流水线停了')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">分类 <b style="color:var(--amber)">'+totalSorted+'</b> 个 · 得分 <b style="color:var(--amber)">'+score+'</b> · 到第 '+Math.min(wave,WAVES)+'/'+WAVES+' 波</div>'+
        '<div style="display:flex;gap:10px;justify-window.content:center;margin-top:16px"><button class="mm-btn" onclick="window.soAgain()">🔁 再玩一次</button><button class="mm-btn primary" onclick="window.soDone()">收下奖励</button></div>';
      window.focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.soAgain = () => { overlay.remove(); openSorter(cfg, onComplete); };
  window.soDone = () => { overlay.remove(); window.playAreaMusic(); if (onComplete) onComplete(!ended ? false : (wave > WAVES && !cfg._endless ? true : false)); };
  function closeGame(manual) {
    if (ended) return;
    ended = true; cancelAnimationFrame(raf);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); window.playAreaMusic(); }
  }
  function loop(now) {
    const dt = Math.min(0.05, (now - last)/1000); last = now;
    if (!ended) {
      spawnT -= dt*1000;
      if (spawnT <= 0 && queue.length) { spawnItem(); spawnT = spawnGap(); }
      for (let i = belt.length - 1; i >= 0; i--) {
        const it = belt[i];
        it.y += it.speed * dt;
        it.el.style.top = it.y + 'px';
        if (it.y >= LEAK_Y) {   // 滑过判定线没接住：漏了
          combo = 0; if (comboEl) comboEl.textContent='';
          processed++; lives--; livesEl.textContent = lives;
          it.el.classList.add('so-leak');
          judge('MISS 漏接', '#ff5252');
          playSound('error');
          removeFromBelt(it);
          setTimeout(() => { if (it.el.parentNode) it.el.parentNode.removeChild(it.el); }, 260);
          if (lives <= 0) { endGame(false); return; }
        }
      }
      if (!ended && processed >= PER) onWaveClear();
      refreshUrgent();
    }
    raf = requestAnimationFrame(loop);
  }
  newWave();
  spawnT = 400;
  raf = requestAnimationFrame(loop);
}
