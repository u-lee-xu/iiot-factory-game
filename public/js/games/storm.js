// ═══════════════════════════════════════════════════════════════════
// games/storm — 拆自 app.js（openStormDefense）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openStormDefense(cfg, onComplete) {
  if (!window.tutSeen('storm')) {
    window.showGameTutorial('storm', '🌪️ 数据风暴', [
      '数据风暴来了！拖<b>过滤器</b>处理涌入的数据',
      '每种过滤器有费用，算力有限不能全开',
      '别让管道崩了，守住每一波'
    ], function(){ openStormDefense(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('storm'));
  const duration = cfg.duration || 60;
  const waves = cfg.waves || 5;
  const waveDur = duration / waves;
  const FILTERS = (cfg.filters || [
    { id: 'smooth', name: '滑动均值', emoji: '📉', desc: '滤噪声压波动', cost: 8 },
    { id: 'clamp', name: '阈值截断', emoji: '🎚️', desc: '压异常尖峰', cost: 10 },
    { id: 'drop', name: '丢弃异常', emoji: '🗑️', desc: '直接丢异常·可能误伤关键', cost: 14 },
    { id: 'down', name: '降采样', emoji: '⏳', desc: '流量减半·可能漏关键', cost: 6 }
  ]);
  const BASE_P = { normal: 6, noise: 4, anomaly: 12, critical: 10 };
  const SCORE = { normal: 2, noise: 1, anomaly: 3, critical: 20 };
  const TYPE_NAME = { normal: '正常', noise: '噪声', anomaly: '异常', critical: '关键' };
  const TYPE_EMOJI = { normal: '🟢', noise: '⚪', anomaly: '🔴', critical: '🟡' };
  const DRAIN = 8, COMPUTE_MAX = 100, COMPUTE_REGEN = 25;

  let timeLeft = duration, pressure = 0, compute = COMPUTE_MAX, score = 0;
  let finished = false, peakPressure = 0, totalCrit = 0, savedCrit = 0;
  let blocks = [], spawnIdx = 0, timer = null;
  const filterSet = new Set();

  // 预生成各波数据块（越往后越猛，关键数据从后半程出现）
  const spawns = [];
  for (let w = 1; w <= waves; w++) {
    const inten = w / waves;
    const count = 8 + Math.round(10 * inten);
    const gap = (waveDur - 1.2) / count;
    let t = 0.5;
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      let type;
      if (inten < 0.35) type = r < 0.72 ? 'normal' : 'noise';
      else if (inten < 0.6) type = r < 0.45 ? 'normal' : (r < 0.78 ? 'noise' : 'anomaly');
      else type = r < 0.22 ? 'normal' : (r < 0.5 ? 'noise' : (r < 0.84 ? 'anomaly' : 'critical'));
      spawns.push({ absT: (w - 1) * waveDur + t, type });
      t += gap;
    }
  }

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="mm-box sd-box">
      <div class="mm-head">
        <div>
          <div class="mm-title">🌪️ ${escHtml(cfg.name)}</div>
          <div class="mm-sub">${escHtml(cfg.subtitle || '')}</div>
        </div>
        <div class="mm-close">✕</div>
      </div>
      <div class="sd-top">
        <span>⏱ <b id="sdTime">${duration}</b>s</span>
        <span>波 <b id="sdWave">1</b>/${waves}</span>
        <span>得分 <b id="sdScore">0</b></span>
      </div>
      <div class="sd-bar-wrap">
        <div class="sd-bar-label">管道压力（满 100 就崩）<span id="sdPNum" style="float:right;color:var(--amber)">0</span></div>
        <div class="sd-bar"><div class="sd-bar-fill sd-pressure-fill" id="sdPressure" style="width:0%"></div></div>
      </div>
      <div class="sd-bar-wrap">
        <div class="sd-bar-label">边缘算力 <span id="sdCNum" style="float:right;color:var(--cyan)">100</span></div>
        <div class="sd-bar"><div class="sd-bar-fill sd-compute-fill" id="sdCompute" style="width:100%"></div></div>
      </div>
      <div class="sd-pipe" id="sdPipe">
        <div class="sd-pipe-label">🌊 数据流 → 边缘处理（点下方过滤器来守管道）</div>
      </div>
      <div class="sd-filters" id="sdFilters"></div>
      <div class="sd-msg" id="sdMsg"></div>
    </div>`;
  document.body.appendChild(overlay);

  const pipe = overlay.querySelector('#sdPipe');
  const msgEl = overlay.querySelector('#sdMsg');
  let pipeWidth = 0;
  function measurePipe() { pipeWidth = pipe.clientWidth || 0; }
  measurePipe();
  setTimeout(measurePipe, 120);

  function flashMsg(t, cls) {
    msgEl.textContent = t;
    msgEl.style.color = cls === 'err' ? 'var(--red)' : cls === 'ok' ? 'var(--green)' : 'var(--amber)';
    clearTimeout(flashMsg._t);
    flashMsg._t = setTimeout(() => { msgEl.textContent = ''; }, 1500);
  }

  function renderFilters() {
    const box = overlay.querySelector('#sdFilters');
    box.innerHTML = '';
    FILTERS.forEach(f => {
      const on = filterSet.has(f.id);
      const btn = document.createElement('div');
      btn.className = 'sd-filter' + (on ? ' on' : '');
      btn.innerHTML = '<div class="sd-f-emoji">' + f.emoji + '</div><div class="sd-f-name">' + escHtml(f.name) + '</div><div class="sd-f-cost">⚡ ' + f.cost + '/s</div><div class="sd-f-desc">' + escHtml(f.desc) + '</div>';
      btn.onclick = () => toggleFilter(f.id);
      box.appendChild(btn);
    });
    const c = Math.max(0, Math.round(compute));
    overlay.querySelector('#sdCompute').style.width = c + '%';
    overlay.querySelector('#sdCNum').textContent = c;
  }

  function toggleFilter(id) {
    if (finished) return;
    playSound('toggle');
    if (filterSet.has(id)) { filterSet.delete(id); }
    else {
      const f = FILTERS.find(x => x.id === id);
      if (compute < f.cost) { flashMsg('⚡ 算力不足，先关掉别的过滤器再开', 'err'); return; }
      filterSet.add(id);
      flashMsg(f.emoji + ' ' + f.name + ' 已启用', 'ok');
      // 启用过滤器：粒子爆散
      try{
        const b = box.querySelector('[data-fid="'+id+'"]') || box;
        const rb=b.getBoundingClientRect(), ob=box.getBoundingClientRect();
        const bx=rb.left+rb.width/2-ob.left, by=rb.top+rb.height/2-ob.top;
        for(let k=0;k<8;k++){
          const sp=document.createElement('span');
          sp.className='mm-burst';
          sp.style.cssText='left:'+bx+'px;top:'+by+'px;--mx:'+((Math.random()*70-35))+'px;--my:'+((Math.random()*-60-10))+'px;background:'+['#00e676','#7ee8fa','#ffd700'][k%3];
          box.appendChild(sp);
          setTimeout(()=>{ try{sp.remove();}catch(e){} }, 550);
        }
      }catch(e2){}
    }
    renderFilters();
  }

  function pressureAdd(type) {
    let p = BASE_P[type];
    if (filterSet.has('smooth')) {
      if (type === 'noise') p *= 0.5;
      if (type === 'anomaly') p *= 0.75;
      if (type === 'critical') p *= 1.3;
    }
    if (filterSet.has('clamp')) {
      if (type === 'anomaly') p *= 0.4;
      if (type === 'noise') p *= 0.7;
    }
    if (filterSet.has('down')) {
      if (type === 'normal') p *= 0.5;
      if (type === 'critical') p *= 1.4;
    }
    if (filterSet.has('drop')) {
      if (type === 'anomaly') return { p: 0, dropped: true };
      if (type === 'critical' && Math.random() < 0.15) return { p: 15, mis: true };
    }
    return { p: Math.round(p), dropped: false };
  }

  function valueFor(type) {
    if (type === 'normal') return (24 + Math.random() * 6).toFixed(0) + '℃';
    if (type === 'noise') return (23 + Math.random() * 13).toFixed(0) + '℃';
    if (type === 'anomaly') return (88 + Math.random() * 18).toFixed(0) + '℃';
    return (32 + Math.random() * 8).toFixed(0) + '℃';
  }

  function spawn(type) {
    const r = pressureAdd(type);
    if (r.mis) {
      score -= 20;
      flashMsg('❌ 误丢了关键数据！-20 分，压力 +15', 'err');
      pipe.classList.remove('shake'); void pipe.offsetWidth; pipe.classList.add('shake');
      pressure += r.p;
      return;
    }
    if (r.dropped) { score += 3; return; }
    pressure += r.p;
    peakPressure = Math.max(peakPressure, pressure);
    const el = document.createElement('div');
    el.className = 'sd-block ' + type;
    el.innerHTML = '<span class="sd-b-val">' + valueFor(type) + '</span><span class="sd-b-type">' + TYPE_EMOJI[type] + ' ' + TYPE_NAME[type] + '</span>';
    pipe.appendChild(el);
    if (type === 'critical') totalCrit++;
    blocks.push({ el, type, x: 0, speed: (pipeWidth + 110) / 5.5 });
  }

  function tick() {
    if (finished) return;
    const dt = 0.05;
    pressure = Math.max(0, pressure - DRAIN * dt);
    compute = Math.min(COMPUTE_MAX, compute + COMPUTE_REGEN * dt);
    let cost = 0;
    filterSet.forEach(id => { const f = FILTERS.find(x => x.id === id); if (f) cost += f.cost; });
    compute -= cost * dt;
    if (compute <= 0) {
      compute = 0; filterSet.clear(); renderFilters();
      flashMsg('⚡ 算力耗尽，过滤器全关！', 'err');
    }
    timeLeft -= dt;
    const elapsed = duration - timeLeft;
    while (spawnIdx < spawns.length && spawns[spawnIdx].absT <= elapsed) { spawn(spawns[spawnIdx].type); spawnIdx++; }
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      b.x += b.speed * dt;
      b.el.style.transform = 'translateX(' + b.x + 'px)';
      if (b.x >= pipeWidth + 50) {
        b.el.remove(); blocks.splice(i, 1);
        score += SCORE[b.type];
        if (b.type === 'critical') savedCrit++;
      }
    }
    const waveNow = Math.min(waves, Math.floor((duration - timeLeft) / waveDur) + 1);
    overlay.querySelector('#sdTime').textContent = Math.max(0, Math.ceil(timeLeft));
    overlay.querySelector('#sdWave').textContent = waveNow;
    overlay.querySelector('#sdScore').textContent = score;
    overlay.querySelector('#sdPressure').style.width = Math.min(100, pressure) + '%';
    overlay.querySelector('#sdPNum').textContent = Math.round(pressure);
    if (pressure >= 100) { clearInterval(timer); finish(false); return; }
    if (timeLeft <= 0) {
      clearInterval(timer);
      // 收尾：把仍在管道里、已通过的数据一并算作处理完
      blocks.forEach(bl => { if (bl.el) bl.el.remove(); if (bl.type === 'critical') savedCrit++; });
      blocks = [];
      finish(true);
    }
  }

  overlay.querySelector('.mm-close').onclick = () => {
    if (finished) return;
    clearInterval(timer);
    closeOverlay();
  };
  function closeOverlay() {
    overlay.style.opacity = '0'; overlay.style.transition = 'opacity .3s';
    setTimeout(() => { window.playAreaMusic(); overlay.remove(); if (onComplete) onComplete(false); }, 300);
  }

  function finish(win) {
    finished = true;
    clearInterval(timer);
    if (win) {
      const ids = (cfg.pairs || []).map(pr => pr.id).filter(Boolean);
      if (ids.length) window.unlockPedia(window.currentLevelId, ids);
      playSound('fanfare');
      const savedRate = totalCrit ? savedCrit / totalCrit : 1;
      const stars = (peakPressure <= 60 && savedRate >= 0.9) ? 3 : (peakPressure <= 85 && savedRate >= 0.6) ? 2 : 1;
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `
        <div class="big">🌪️</div>
        <div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:6px">${escHtml(cfg.name)} 守住了！</div>
        <div class="xp">+${cfg.xp || 0} XP</div>
        <div style="font-size:14px;color:var(--dim)">峰值压力 ${Math.round(peakPressure)}% · 关键数据保住 ${savedCrit}/${totalCrit} · ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
        <div class="note">边缘算力有限，过滤器不能全开——学会掂量着用</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="mm-btn" data-act="again">🔁 再守一次</button>
          <button class="mm-btn primary" data-act="done">收下奖励</button>
        </div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="again"]').onclick = () => { window.playAreaMusic(); overlay.remove(); openStormDefense(cfg, onComplete); };
      overlay.querySelector('[data-act="done"]').onclick = () => { window.playAreaMusic(); overlay.remove(); window.recordGameWin('storm'); if (onComplete) onComplete(true); };
    } else {
      playSound('fail');
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `
        <div class="big">💥</div>
        <div style="font-size:20px;font-weight:bold;color:var(--red);margin-top:6px">管道崩了！</div>
        <div style="font-size:14px;color:var(--dim);margin-top:8px">压力冲到 100%（峰值 ${Math.round(peakPressure)}%）· 再来一次，试着提前开好过滤器</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="mm-btn primary" data-act="retry">🔁 再来一次</button>
          <button class="mm-btn" data-act="skip">先干正事</button>
        </div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="retry"]').onclick = () => { window.playAreaMusic(); overlay.remove(); openStormDefense(cfg, onComplete); };
      overlay.querySelector('[data-act="skip"]').onclick = () => { window.playAreaMusic(); overlay.remove(); if (onComplete) onComplete(false); };
    }
  }

  renderFilters();
  timer = setInterval(tick, 50);
}
