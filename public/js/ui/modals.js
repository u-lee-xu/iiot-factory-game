// ═══════════════════════════════════════════════════════════════════
// ui/modals.js — modals 模块（拆自 app.js）
// import core/*；其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { playSound } from '../core/sound.js';

export function checkLevelUp() {
  const xp = window.calcTotalXP();
  const rank = window.getRank(xp);
  if (window.prevRank && window.prevRank.title !== rank.title) {
    playSound('levelup');
    showLevelUp(rank);
  }
  window.prevRank = rank;
}

export function showLevelUp(rank) {
  const overlay = document.getElementById('levelUpOverlay');
  document.getElementById('levelUpRank').textContent = rank.emoji;
  document.getElementById('levelUpLabel').innerHTML = `🏅 ${rank.title}<br><span style="font-size: 14px;color:var(--dim);margin-top:6px;display:inline-block">厂长拍了拍你的肩膀</span>`;
  overlay.classList.add('show');
  setTimeout(() => overlay.classList.remove('show'), 3000);
}

export function showWelcomeDialog(msg, done) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center';
  const box = document.createElement('div');
  box.style.cssText = 'background:#12121a;border:2px solid var(--amber);border-radius:8px;padding:24px 32px;max-width:460px;width:90%;box-shadow:0 0 40px rgba(255,176,0,.15)';
  box.innerHTML = `
    <div style="font-size:15px;line-height:1.8;color:var(--text);margin-bottom:20px">${msg}</div>
    <button style="display:block;margin:0 auto;padding:8px 28px;background:var(--amber);color:#000;border:none;border-radius:4px;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit">知道了</button>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  box.querySelector('button').onclick = () => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .3s';
    setTimeout(() => { overlay.remove(); if (done) setTimeout(done, 50); }, 300);
    playSound('click');
  };
  playSound('boot');
}

export function showLevelIntro(lv, onStart) {
  // Check if already seen this level intro this session
  const seenKey = 'levelIntroSeen_' + lv.id;
  const isReturning = sessionStorage.getItem(seenKey) === 'true';
  
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center';
  
  const box = document.createElement('div');
  box.style.cssText = 'background:#12121a;border:2px solid var(--amber);border-radius:8px;padding:0;max-width:520px;width:90%;box-shadow:0 0 60px rgba(255,176,0,.2);overflow:hidden';
  
  const introText = lv.narrative.intro;
  const mood = isReturning ? 'neutral' : 'thinking';
  const moodEmoji = { proud: '😎', stern: '😤', awkward: '😅', thinking: '🤔', neutral: '👨‍💼' }[mood];
  const moodLine = window.getRandomMoodLine(mood);
  
  box.innerHTML = `
    <div class="director-box director-mood-${mood}" style="margin:0;border-radius:0;border:none;border-bottom:1px solid var(--border);padding:16px 20px">
      <div class="director-portrait">${moodEmoji}</div>
      <div class="director-bubble">
        <div class="director-name">厂长</div>
        <div class="director-mood-line" style="font-size:13px;color:var(--accent);margin-bottom:4px;font-style:italic">${moodLine}</div>
        <div class="director-text" id="levelIntroText" style="font-size:15px;line-height:1.7;color:var(--text)"></div>
      </div>
    </div>
    <div style="padding:16px 20px;text-align:center;border-top:1px solid var(--border);background:rgba(0,0,0,.2)">
      <button id="levelIntroBtn" style="display:block;margin:0 auto;padding:10px 32px;background:var(--amber);color:#000;border:none;border-radius:4px;font-size:15px;font-weight:bold;cursor:pointer;font-family:inherit;opacity:0.5" disabled>
        ${isReturning ? '跳过 → 开始任务' : '正在交代任务...'}
      </button>
    </div>
  `;
  
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  
  const textEl = box.querySelector('#levelIntroText');
  const btn = box.querySelector('#levelIntroBtn');
  
  window.typewrite(textEl, introText, isReturning ? 5 : 25, () => {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = isReturning ? '跳过 → 开始任务' : '收到，开始任务';
    playSound('click');
  });
  
  btn.onclick = () => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .3s';
    setTimeout(() => overlay.remove(), 300);
    playSound('click');
    sessionStorage.setItem(seenKey, 'true');
    if (onStart) onStart();
  };
}

export function showLevelComplete(lv, done) {
  const xpEarned = window.calculateLevelXP(lv.id);
  const totalXP = window.calcTotalXP();
  const rank = window.getRank(totalXP);
  const nextRank = window.RANKS.find(r => r.min > totalXP);
  const maxXP = nextRank ? nextRank.min : 8000;
  const minXP = rank.min;
  const pct = nextRank ? Math.round((totalXP - minXP) / (maxXP - minXP) * 100) : 100;
  
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.9);z-index:9999;display:flex;align-items:center;justify-content:center';
  
  const box = document.createElement('div');
  box.style.cssText = 'background:#12121a;border:2px solid var(--green);border-radius:8px;padding:0;max-width:520px;width:90%;box-shadow:0 0 60px rgba(0,230,118,.25);overflow:hidden;text-align:center';
  
  const moodEmoji = '😎';
  const moodLine = window.getRandomMoodLine('proud');
  
  box.innerHTML = `
    <div class="director-box director-mood-proud" style="margin:0;border-radius:0;border:none;border-bottom:1px solid var(--border);padding:16px 20px;text-align:left">
      <div class="director-portrait">${moodEmoji}</div>
      <div class="director-bubble">
        <div class="director-name">厂长</div>
        <div class="director-mood-line" style="font-size:13px;color:var(--green);margin-bottom:4px;font-style:italic">${moodLine}</div>
        <div class="director-text" id="levelCompleteText" style="font-size:15px;line-height:1.7;color:var(--text)"></div>
      </div>
    </div>
    <div style="padding:20px;background:rgba(0,230,118,.05);border-top:1px solid var(--border);border-bottom:1px solid var(--border)">
      <div style="font-size:14px;color:var(--dim);margin-bottom:8px">本关获得经验</div>
      <div style="font-size:36px;font-weight:bold;color:var(--green);margin-bottom:16px">+${xpEarned} XP</div>
      <div style="font-size:14px;color:var(--dim);margin-bottom:8px">总经验：<span style="color:var(--amber)">${totalXP}</span> / ${maxXP === 8000 ? 'MAX' : maxXP}</div>
      <div style="height:8px;background:#1a1a24;border-radius:4px;overflow:hidden;margin-top:8px">
        <div style="width:${Math.min(pct,100)}%;height:100%;background:linear-gradient(90deg,var(--amber),var(--green));transition:width .8s"></div>
      </div>
      <div style="font-size:13px;color:var(--dim);margin-top:6px">段位：${rank.emoji} ${rank.title} (${Math.min(pct,100)}%)</div>
    </div>
    <div style="padding:16px 20px;text-align:center">
      <button id="levelCompleteBtn" style="display:block;margin:0 auto;padding:10px 32px;background:var(--green);color:#000;border:none;border-radius:4px;font-size:15px;font-weight:bold;cursor:pointer;font-family:inherit">
        返回工厂查看
      </button>
    </div>
  `;
  
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  
  const textEl = box.querySelector('#levelCompleteText');
  const btn = box.querySelector('#levelCompleteBtn');
  
  const completeText = lv.narrative.complete || '关卡完成，产线又亮了一盏灯。';
  window.typewrite(textEl, completeText, 25, () => {
    playSound('success');
  });
  
  if (sessionStorage.getItem('mapFlow') === '1') {
    btn.textContent = '🗺️ 回厂区继续';
    btn.onclick = () => { playSound('click'); window.goMap(); };
  } else {
    btn.onclick = () => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity .3s';
      setTimeout(() => { overlay.remove(); if (done) setTimeout(done, 50); }, 300);
      playSound('click');
    };
  }
}
