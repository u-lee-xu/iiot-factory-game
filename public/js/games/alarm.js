// ═══════════════════════════════════════════════════════════════════
// games/alarm — 拆自 app.js（openAlarmRush）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openAlarmRush(cfg, onComplete) {
  if (!window.tutSeen('alarm')) {
    window.showGameTutorial('alarm', '🚨 值班抢险', [
      '产线设备<b>报警</b>了，快速处理',
      '别让产线烧了，稳住每一波'
    ], function(){ openAlarmRush(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('alarm'));
  const duration = cfg.duration || 40;
  const waves = cfg.waves || 4;
  const waveDur = duration / waves;
  const deviceCount = cfg.devices || 4;
  const OVERHEAT_TEMP = 80;
  const WINDOW = 3.0;         // 过热处理窗口（秒）
  const CRASH_LIMIT = 3;      // 累计宕机 3 台 → 产线瘫痪

  let timeLeft = duration, score = 0, combo = 0, crashes = 0, saves = 0;
  let wave = 1, finished = false, timer = null;
  const devices = [];

  // 预生成各波"哪台盒子会爆表"
  const events = [];
  for (let w = 1; w <= waves; w++) {
    const count = Math.min(deviceCount, 1 + Math.round((w - 1) * 0.7));
    const arr = [];
    for (let i = 0; i < deviceCount; i++) arr.push(i);
    arr.sort(() => Math.random() - 0.5);
    const pick = arr.slice(0, count);
    let t = waveDur * 0.15;
    const gap = (waveDur * 0.75) / Math.max(1, count);
    pick.forEach(d => { events.push({ absT: (w - 1) * waveDur + t, device: d }); t += gap; });
  }
  let evIdx = 0;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="mm-box ar-box">
      <div class="mm-head">
        <div>
          <div class="mm-title">🚨 ${escHtml(cfg.name)}</div>
          <div class="mm-sub">${escHtml(cfg.subtitle || '')}</div>
        </div>
        <div class="mm-close">✕</div>
      </div>
      <div class="ar-top">
        <span>⏱ <b id="arTime">${duration}</b>s</span>
        <span>波 <b id="arWave">1</b>/${waves}</span>
        <span>得分 <b id="arScore">0</b></span>
        <span>连击 <b id="arCombo">0</b> 🔥</span>
        <span>宕机 <b id="arCrash" style="color:var(--red)">0</b>/${CRASH_LIMIT}</span>
      </div>
      <div class="ar-grid" id="arGrid"></div>
      <div class="ar-msg" id="arMsg"></div>
    </div>`;
  document.body.appendChild(overlay);

  const grid = overlay.querySelector('#arGrid');
  const msgEl = overlay.querySelector('#arMsg');

  function flash(t, cls) {
    msgEl.textContent = t;
    msgEl.style.color = cls === 'err' ? 'var(--red)' : cls === 'ok' ? 'var(--green)' : cls === 'warn' ? 'var(--amber)' : 'var(--amber)';
    clearTimeout(flash._t);
    flash._t = setTimeout(() => { msgEl.textContent = ''; }, 1500);
  }
  function shake(el) {
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }

  for (let i = 0; i < deviceCount; i++) {
    const el = document.createElement('div');
    el.className = 'ar-card normal';
    el.innerHTML = '<div class="ar-dev-name">边缘盒子 0' + (i + 1) + '</div><div class="ar-temp">--℃</div><div class="ar-bar"><div class="ar-bar-fill" style="width:30%"></div></div><div class="ar-status">正常</div><button class="ar-cool" style="display:none">❄️ 强制降温</button>';
    grid.appendChild(el);
    const d = {
      i, el,
      temp: 52 + Math.random() * 14, state: 'normal', crashTimer: 0, heatRate: 7,
      tempEl: el.querySelector('.ar-temp'), barEl: el.querySelector('.ar-bar-fill'), statusEl: el.querySelector('.ar-status'),
      coolEl: el.querySelector('.ar-cool')
    };
    d.coolEl.onclick = (ev) => { ev.stopPropagation(); coolDevice(d); };
    el.onclick = () => tapDevice(d);
    devices.push(d);
  }

  // 主动降温：区别于"等到爆表再点"——升温中提前用 ❄️ 压下去，得奖励
  function coolDevice(d) {
    if (finished) return;
    if (d.state === 'heating') {
      combo++; saves++;
      const gain = 15 + (combo - 1) * 5;
      score += gain;
      flash('❄️ 提前降温 +' + gain, 'ok');
      if (combo >= 2) playSound('combo', combo); else playSound('success');
      d.temp = Math.max(38, d.temp - 34);
      d.state = 'normal';
      d.el.className = 'ar-card normal'; d.statusEl.textContent = '已降温';
      d.coolEl.style.display = 'none';
      try{
        const rb=d.el.getBoundingClientRect(), ob=overlay.getBoundingClientRect();
        const bx=rb.left+rb.width/2-ob.left, by=rb.top+rb.height/2-ob.top;
        for(let k=0;k<8;k++){
          const sp=document.createElement('span');
          sp.className='mm-burst';
          sp.style.cssText='left:'+bx+'px;top:'+by+'px;--mx:'+((Math.random()*80-40))+'px;--my:'+((Math.random()*-70-10))+'px;background:'+['#7ee8fa','#fff','#4dd0e1'][k%3];
          overlay.appendChild(sp);
          setTimeout(()=>{ try{sp.remove();}catch(e){} }, 550);
        }
      }catch(e2){}
    } else if (d.state === 'overheat') {
      // 爆表了必须点卡片本体处理，❄️ 只能压一部分
      d.temp -= 20;
      if (d.temp < OVERHEAT_TEMP) { d.state = 'heating'; d.el.className = 'ar-card heating'; d.statusEl.textContent = '降温中…'; flash('❄️ 压住了，但还没完全好', 'warn'); }
      else flash('❄️ 降温中，别松手…', 'warn');
    }
    renderHUD();
  }

  function tapDevice(d) {
    if (finished) return;
    if (d.state === 'overheat') {
      d.state = 'saved';
      combo++;
      saves++;
      const gain = 20 + (combo - 1) * 5;
      score += gain;
      flash('✅ 处理成功 +' + gain, 'ok');
      if (combo >= 2) playSound('combo', combo); else playSound('success');
      d.el.className = 'ar-card saved';
      d.statusEl.textContent = '已处理';
      d.coolEl.style.display = 'none';
      // 处理成功粒子
      try{
        const rb=d.el.getBoundingClientRect(), ob=overlay.getBoundingClientRect();
        const bx=rb.left+rb.width/2-ob.left, by=rb.top+rb.height/2-ob.top;
        for(let k=0;k<10;k++){
          const sp=document.createElement('span');
          sp.className='mm-burst';
          sp.style.cssText='left:'+bx+'px;top:'+by+'px;--mx:'+((Math.random()*80-40))+'px;--my:'+((Math.random()*-70-10))+'px;background:'+['#00e676','#ffd700','#ff7a7a'][k%3];
          overlay.appendChild(sp);
          setTimeout(()=>{ try{sp.remove();}catch(e){} }, 550);
        }
      }catch(e2){}
      d.temp = 46 + Math.random() * 8;
      setTimeout(() => { if (d.state === 'saved') { d.state = 'normal'; d.el.className = 'ar-card normal'; d.statusEl.textContent = '正常'; } }, 2600);
    } else if (d.state === 'heating') {
      combo = 0; score -= 5;
      flash('⚠️ 处理太早 -5（等它冒烟变红再点）', 'err');
      shake(d.el); playSound('error');
    } else if (d.state === 'normal') {
      combo = 0; score -= 10;
      flash('❌ 误报 -10（它还好好的，别乱点）', 'err');
      shake(d.el); playSound('error');
    }
    renderHUD();
  }

  function renderHUD() {
    overlay.querySelector('#arScore').textContent = score;
    overlay.querySelector('#arCombo').textContent = combo;
    overlay.querySelector('#arCrash').textContent = crashes;
  }

  function tick() {
    if (finished) return;
    const dt = 0.05;
    timeLeft -= dt;
    const elapsed = duration - timeLeft;
    // 触发爆表事件
    while (evIdx < events.length && events[evIdx].absT <= elapsed) {
      const e = events[evIdx++];
      const d = devices[e.device];
      if (d.state === 'crashed') continue;
      d.state = 'heating';
      d.temp = Math.max(d.temp, 66);
      d.el.className = 'ar-card heating';
      d.statusEl.textContent = '升温中';
      d.coolEl.style.display = '';
      flash('🌡️ 边缘盒子 0' + (d.i + 1) + ' 开始升温！快用 ❄️ 降温！', 'warn');
    }
    // 更新每台盒子
    devices.forEach(d => {
      if (d.state === 'normal') {
        d.temp += (Math.random() - 0.5) * 1.4 * dt;
        d.temp = Math.max(36, Math.min(74, d.temp));
      } else if (d.state === 'heating') {
        d.temp += d.heatRate * dt;
        if (d.temp >= OVERHEAT_TEMP) {
          d.state = 'overheat'; d.crashTimer = WINDOW;
          d.el.className = 'ar-card overheat';
          d.statusEl.textContent = '🔥 过热！点卡片处理！';
          d.coolEl.style.display = '';
          flash('🔥 边缘盒子 0' + (d.i + 1) + ' 爆表了！快点卡片！', 'err');
          playSound('alarm');
        }
      } else if (d.state === 'overheat') {
        d.crashTimer -= dt;
        if (d.crashTimer <= 0) {
          d.state = 'crashed'; crashes++; combo = 0; score -= 30;
          d.el.className = 'ar-card crashed';
          d.statusEl.textContent = '💥 宕机';
          d.coolEl.style.display = 'none';
          flash('💥 宕机 -30（共宕机 ' + crashes + '/' + CRASH_LIMIT + '）', 'err');
          shake(d.el); playSound('error');
          if (crashes >= CRASH_LIMIT) { clearInterval(timer); finish(false); return; }
        }
      }
      d.tempEl.textContent = Math.round(d.temp) + '℃';
      d.barEl.style.width = Math.min(100, Math.max(0, ((d.temp - 35) / 65) * 100)) + '%';
    });
    wave = Math.min(waves, Math.floor((duration - timeLeft) / waveDur) + 1);
    overlay.querySelector('#arTime').textContent = Math.max(0, Math.ceil(timeLeft));
    overlay.querySelector('#arWave').textContent = wave;
    renderHUD();
    if (timeLeft <= 0) { clearInterval(timer); finish(true); }
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
      const totalEvents = events.length;
      const stars = (crashes === 0 && saves >= Math.ceil(totalEvents * 0.9)) ? 3 : (crashes <= 1) ? 2 : 1;
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `
        <div class="big">🚨</div>
        <div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:6px">${escHtml(cfg.name)} 守住产线！</div>
        <div class="xp">+${cfg.xp || 0} XP</div>
        <div style="font-size:14px;color:var(--dim)">得分 ${score} · 处理成功 ${saves}/${totalEvents} 起 · 宕机 ${crashes} 台 · ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
        <div class="note">看准冒烟变红的盒子再点，连击越多分越高</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="mm-btn" data-act="again">🔁 再守一次</button>
          <button class="mm-btn primary" data-act="done">收下奖励</button>
        </div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="again"]').onclick = () => { window.playAreaMusic(); overlay.remove(); openAlarmRush(cfg, onComplete); };
      overlay.querySelector('[data-act="done"]').onclick = () => { window.playAreaMusic(); overlay.remove(); window.recordGameWin('alarm'); if (onComplete) onComplete(true); };
    } else {
      playSound('fail');
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `
        <div class="big">💥</div>
        <div style="font-size:20px;font-weight:bold;color:var(--red);margin-top:6px">产线瘫痪了！</div>
        <div style="font-size:14px;color:var(--dim);margin-top:8px">宕机 ${crashes}/${CRASH_LIMIT} 台 · 再来一次，盯紧冒烟的盒子</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="mm-btn primary" data-act="retry">🔁 再来一次</button>
          <button class="mm-btn" data-act="skip">先干正事</button>
        </div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="retry"]').onclick = () => { window.playAreaMusic(); overlay.remove(); openAlarmRush(cfg, onComplete); };
      overlay.querySelector('[data-act="skip"]').onclick = () => { window.playAreaMusic(); overlay.remove(); if (onComplete) onComplete(false); };
    }
  }

  renderHUD();
  timer = setInterval(tick, 50);
}
