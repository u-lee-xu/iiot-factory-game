// ═══════════════════════════════════════════════════════════════════
// games/quick — 拆自 app.js（openQuickMatch）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openQuickMatch(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('quick')) {
    window.showGameTutorial('quick', '⚡ 快打', [
      '题目弹出，快速点选<b>正确答案</b>',
      '连对越多连击越高、越爽',
      '在倒计时结束前尽量多答对'
    ], function(){ openQuickMatch(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('quick'));
  const questions = cfg.pairs.slice(0, cfg.size).map(pr => Object.assign({}, pr));
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }
  const distractors = (cfg.distractors || []).filter(d => !questions.some(q => q.term === d));
  let cur = 0, score = 0, combo = 0, bestCombo = 0;
  let qkBaseTime = Math.round((cfg.timeLimit || 45) * (cfg._hard ? 0.7 : 1));   // 二周目初始时间打 7 折
  let timeLeft = qkBaseTime;
  let timer = null, finished = false;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="mm-box qk-box">
      <div class="mm-head">
        <div>
          <div class="mm-title">⚡ ${escHtml(cfg.name)}</div>
          <div class="mm-sub">${escHtml(cfg.subtitle || '')}</div>
        </div>
        <div class="mm-close">✕</div>
      </div>
      <div class="qk-stats">
        <span>题 <b id="qkCur">1</b>/${cfg.size}</span>
        <span>得分 <b id="qkScore">0</b></span>
        <span>连击 <b id="qkCombo">0</b> 🔥</span>
        <span>⏱ <b class="qk-timer">${timeLeft}</b>s</span>
      </div>
      <div class="qk-timerbar"><div class="qk-timerbar-fill high" id="qkTimerBar"></div></div>
      <div class="qk-terminal">
        <div class="qk-term-head">五号车间 · SSH 终端</div>
        <div class="qk-term-body" id="qkBody"></div>
      </div>
      <div class="qk-btns" id="qkBtns"></div>
      <div class="qk-msg" id="qkMsg"></div>
    </div>`;
  document.body.appendChild(overlay);

  function renderQ() {
    if (finished) return;
    if (cur >= questions.length) { clearInterval(timer); finish(true); return; }
    const q = questions[cur];
    overlay.querySelector('#qkCur').textContent = cur + 1;
    overlay.querySelector('#qkBody').innerHTML = '<div class="qk-q">' + escHtml(q.q || q.hint) + '</div>';
    overlay.querySelector('#qkMsg').textContent = '';
    const localD = (q.distractors || []).filter(function(d){ return d !== q.term; });
    const opts = [q.term].concat(localD.length ? localD : distractors);
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    const btns = overlay.querySelector('#qkBtns');
    btns.innerHTML = '';
    opts.forEach(o => {
      const b = document.createElement('button');
      b.className = 'qk-btn';
      b.textContent = o;
      b.onclick = () => {
        if (finished) return;
        if (o === q.term) {
          combo++;
          bestCombo = Math.max(bestCombo, combo);
          window.bumpGameStats({ qkCombo: Math.max(window.getGameStats().qkCombo || 0, bestCombo) });
          score += 10 + combo * 2;
          overlay.querySelector('#qkScore').textContent = score;
          overlay.querySelector('#qkCombo').textContent = combo;
          if (combo >= 2) playSound('combo', combo); else playSound('success');
          overlay.querySelector('#qkMsg').innerHTML = '<span class="qk-ok">✓ 正确！' + (q.cmd ? ' 示例：' + escHtml(q.cmd) : '') + '</span>';
          // —— 打击感：按钮爆发 + 粒子 + 连击飘字 ——
          try{
            b.classList.add('hit');
            const bb=b.getBoundingClientRect();
            const bx=bb.left+bb.width/2, by=bb.top+bb.height/2;
            // 粒子：fixed 定位到按钮中心（视口坐标）
            for(let k=0;k<10;k++){
              const sp=document.createElement('span');
              sp.className='qk-burst';
              sp.style.cssText='left:'+bx+'px;top:'+by+'px;--mx:'+((Math.random()*90-45))+'px;--my:'+((Math.random()*-70-10))+'px;background:'+['#00e676','#ffd700','#7ee8fa'][k%3];
              document.body.appendChild(sp);
              setTimeout(()=>{ try{sp.remove();}catch(e){} }, 550);
            }
            if(combo>=2){
              const fl=document.createElement('div');
              fl.className='qk-combo-float';
              fl.textContent = '🔥 连击 x'+combo;
              fl.style.cssText='left:'+bx+'px;top:'+(by-10)+'px';
              document.body.appendChild(fl);
              setTimeout(()=>{ try{fl.remove();}catch(e){} }, 800);
            }
          }catch(e2){}
          if (q.id) window.unlockPedia(window.currentLevelId, [q.id]);
          cur++;
          if (cur >= cfg.size) {
            if (cfg._endless) { cur = 0; qkBaseTime = Math.max(6, qkBaseTime - 3); timeLeft = qkBaseTime; qkTimeTotal = qkBaseTime; renderQ(); window.showToast('⏱ 下一轮时间缩短到 ' + qkBaseTime + ' 秒！', 'info'); }   // 无限战：每轮缩 3 秒，直到来不及
            else { clearInterval(timer); setTimeout(() => finish(true), 700); }
          }
          else setTimeout(renderQ, 550);
        } else {
          combo = 0;
          overlay.querySelector('#qkCombo').textContent = combo;
          playSound('error');
          overlay.querySelector('#qkMsg').innerHTML = '<span class="qk-err">✗ 正确答案是 ' + escHtml(q.term) + '（' + escHtml(q.hint) + '）</span>';
          b.classList.add('wrong');
          setTimeout(() => { b.classList.remove('wrong'); renderQ(); }, 1000);
        }
      };
      btns.appendChild(b);
    });
  }

  let qkTimeTotal = Math.max(timeLeft, 1);
  let qkLastTick = 99;
  timer = setInterval(() => {
    timeLeft -= 0.1;
    const t = overlay.querySelector('.qk-timer');
    if (t) t.textContent = Math.max(Math.ceil(timeLeft), 0);
    const qkSec = Math.ceil(timeLeft);
    if (qkSec <= 5 && qkSec > 0 && qkSec !== qkLastTick) { playSound('tick'); qkLastTick = qkSec; }
    const bar = overlay.querySelector('#qkTimerBar');
    if (bar) {
      const pct = Math.max(0, Math.min(100, (timeLeft / qkTimeTotal) * 100));
      bar.style.width = pct + '%';
      bar.className = 'qk-timerbar-fill ' + (pct > 50 ? 'high' : pct > 25 ? 'mid' : 'low');
    }
    if (timeLeft <= 0 && !finished) { clearInterval(timer); finish(false); }
  }, 100);

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
      playSound('fanfare');
      const stars = bestCombo >= cfg.size ? 3 : bestCombo >= Math.ceil(cfg.size / 2) ? 2 : 1;
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `
        <div class="big">⚡</div>
        <div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:6px">${escHtml(cfg.name)} 完成！</div>
        <div class="xp">+${cfg.xp || 0} XP</div>
        <div style="font-size:14px;color:var(--dim)">得分 ${score} · 最高连击 ${bestCombo} · 评价 ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
        <div class="note">快打奖励不计入排行榜，重在认熟命令</div>
        <div style="display:flex;gap:10px;justify-window.content:center;margin-top:16px">
          <button class="mm-btn" data-act="again">🔁 再打一次</button>
          <button class="mm-btn primary" data-act="done">收下奖励</button>
        </div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="again"]').onclick = () => { window.playAreaMusic(); overlay.remove(); openQuickMatch(cfg, onComplete); };
      overlay.querySelector('[data-act="done"]').onclick = () => { window.playAreaMusic(); overlay.remove(); window.recordGameWin('qk'); window.miniMarkClear(cfg.id); if (onComplete) onComplete(true); };
    } else {
      playSound('fail');
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `
        <div class="big">⏰</div>
        <div style="font-size:20px;font-weight:bold;color:var(--red);margin-top:6px">时间到，答对 ${cur}/${cfg.size} 题</div>
        <div style="font-size:14px;color:var(--dim);margin-top:8px">再打一次，手感会更好！</div>
        <div style="display:flex;gap:10px;justify-window.content:center;margin-top:16px">
          <button class="mm-btn primary" data-act="retry">🔁 再来一次</button>
          <button class="mm-btn" data-act="skip">先干正事</button>
        </div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="retry"]').onclick = () => { window.playAreaMusic(); overlay.remove(); openQuickMatch(cfg, onComplete); };
      overlay.querySelector('[data-act="skip"]').onclick = () => { window.playAreaMusic(); overlay.remove(); if (onComplete) onComplete(false); };
    }
  }
  renderQ();
}
