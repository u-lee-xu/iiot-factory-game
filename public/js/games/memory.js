// ═══════════════════════════════════════════════════════════════════
// games/memory — 拆自 app.js（openMemoryMatch）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openMemoryMatch(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('memory')) {
    window.showGameTutorial('memory', '🧠 翻牌配对', [
      '翻开两张牌，把<b>术语</b>和它的<b>解释</b>配成一对',
      '配对成功就消除，全部配完过关；<b>连对</b>有连击加成',
      '牌堆里可能藏着<b>特殊卡</b>：⏱ 时间、💎 幸运、🛡 护身',
      '多关玩法：过一关，卡片更多（4→6→8 张）'
    ], function(){ openMemoryMatch(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('memory'));
  // 堆叠式（cfg.levels 存在时）
  if (cfg.levels) { window.openStackedMatch(cfg, onComplete); return; }
  // 多关递进（cfg.rounds = 每关卡片对数，如 [2,3,4] → 4/6/8 张）：
  // 中途自动进下一关、不弹结算；失败或全部通关后统一出整场总结算
  if (cfg.rounds && cfg.rounds.length) {
    let sizes = cfg.rounds.slice();
    if (cfg._hard) sizes = sizes.map(function(r){ return Math.min(r + 1, 6); });   // 二周目：每关加一档
    const base = Object.assign({}, cfg);
    delete base.rounds;
    let ri = 0;
    const run = { rounds: [], totalMoves: 0, totalMatches: 0, failed: false, failRound: 0 };
    function showRunSummary(allWin) {
      window.playAreaMusic();
      const totalPairsAll = sizes.reduce(function(a, b){ return a + b; }, 0);
      function roundCards(i){ return sizes[i] * 2 + (sizes[i] >= 3 ? 2 : 0); }   // ≥3对时含1组事件卡
      const totalCards = sizes.reduce(function(a, b, i){ return a + roundCards(i); }, 0);
      const ov = document.createElement('div');
      ov.className = 'mm-overlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
      const rowsHtml = run.rounds.map(function(r){
        return '<div style="font-size:14px;color:var(--dim);margin-top:5px">第 ' + r.index + ' 关（' + (r.size * 2 + (r.size >= 3 ? 2 : 0)) + ' 张）：' + (r.win ? '✅ 用 ' + r.moves + ' 步 · ' + '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars) : '❌ 失败') + '</div>';
      }).join('');
      const headHtml = allWin
        ? '<div class="big">🎉</div><div style="font-size:22px;font-weight:bold;color:var(--green);margin-top:6px">全部 ' + sizes.length + ' 关通关！</div>'
        : '<div class="big">💥</div><div style="font-size:22px;font-weight:bold;color:var(--red);margin-top:6px">第 ' + run.failRound + '/' + sizes.length + ' 关失败</div>';
      const statHtml = allWin
        ? '<div style="font-size:15px;color:var(--dim);margin-top:8px">总步数 <b style="color:var(--amber)">' + run.totalMoves + '</b> · 配对 <b style="color:var(--amber)">' + run.totalMatches + '/' + totalPairsAll + '</b> 对</div>'
        : '<div style="font-size:15px;color:var(--dim);margin-top:8px">已通过 ' + (run.failRound - 1) + ' 关 · 配对 ' + run.totalMatches + ' 对</div>';
      const btns = allWin
        ? '<button class="mm-btn" data-act="again">🔁 再来一次</button><button class="mm-btn primary" data-act="done">收下奖励</button>'
        : '<button class="mm-btn primary" data-act="retry">🔁 再来一次</button><button class="mm-btn" data-act="skip">跳过，先干正事</button>';
      ov.innerHTML = '<div class="mm-box" style="width:min(480px,92vw)"><div class="mm-head"><div><div class="mm-title">🧠 ' + escHtml(base.name) + '</div><div class="mm-sub">连续 ' + sizes.length + ' 关 · 共 ' + totalCards + ' 张卡</div></div></div><div class="pd-body" style="text-align:center">' + headHtml + statHtml + rowsHtml + '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px">' + btns + '</div></div></div>';
      document.body.appendChild(ov);
      if (allWin) { window.recordGameWin('mm'); window.miniMarkClear(base.id); }
      const bind = function(act, fn){ const el = ov.querySelector('[data-act="' + act + '"]'); if (el) el.onclick = fn; };
      bind('done', () => { window.playAreaMusic(); ov.remove(); if (onComplete) onComplete(true); });
      bind('again', () => { ov.remove(); openMemoryMatch(cfg, onComplete); });
      bind('retry', () => { ov.remove(); openMemoryMatch(cfg, onComplete); });
      bind('skip', () => { window.playAreaMusic(); ov.remove(); if (onComplete) onComplete(false); });
      window.focusResultPrimary(ov);
    }
    (function go() {
      if (ri >= sizes.length) {
        if (cfg._endless) { sizes.push(sizes[sizes.length - 1] + 1); run.rounds = []; run.totalMoves = 0; run.totalMatches = 0; }   // 无限战：继续加牌，重新累计
        else { showRunSummary(true); return; }
      }
      const sub = Object.assign({}, base, {
        size: sizes[ri],
        name: base.name + (sizes.length > 1 ? ' · 第 ' + (ri + 1) + '/' + sizes.length + ' 关 · ' + (sizes[ri] * 2 + (sizes[ri] >= 3 ? 2 : 0)) + ' 张' : ''),
        _silent: true,   // 中途不弹结算，过关自动进下一关
        events: sizes[ri] >= 3   // 只有 4 张的小关不塞事件卡，保持干净；6/8 张的大关保留事件卡彩蛋
      });
      if (cfg._endless) { sub.timed = true; sub.timeLimit = Math.max(18, 55 - ri * 3); }   // 无限战：逐关缩时
      openMemoryMatch(sub, function(win, stats){
        const st = stats || { moves: 0, matched: 0, stars: 0 };
        run.rounds.push({ index: ri + 1, size: sizes[ri], win: !!win, moves: st.moves, matched: st.matched, stars: st.stars });
        run.totalMoves += st.moves; run.totalMatches += st.matched;
        if (win) { ri++; go(); }
        else { run.failed = true; run.failRound = ri + 1; showRunSummary(false); }
      });
    })();
    return;
  }
  if (cfg._hard && !cfg.timed) { cfg.timed = true; cfg.timeLimit = cfg.timeLimit || 90; }   // 单关二周目：加限时
  const pairs = cfg.pairs.slice(0, cfg.size);
  let streak = 0;
  let bestStreak = 0;
  const cards = [];
  pairs.forEach((p, i) => {
    cards.push({ pairId: i, kind: 'term', text: p.term, emoji: p.emoji });
    cards.push({ pairId: i, kind: 'hint', text: p.hint, emoji: p.emoji });
  });
  // 事件卡：特殊道具卡，配成一对后触发效果（增加惊喜与节奏）
  const EVENT_POOL = [
    { id: 'time', emoji: '⏱', term: '时间卡', hint: '限时 +5 秒 / 免记 1 步', effect: 'time' },
    { id: 'score', emoji: '💎', term: '幸运卡', hint: '少记 2 步', effect: 'score' },
    { id: 'shield', emoji: '🛡', term: '护身卡', hint: '下次配错不扣时间/不记步数', effect: 'shield' }
  ];
  const deckEvents = [];
  if (cfg.events !== false) {
    const want = (Array.isArray(cfg.events) && cfg.events.length) ? cfg.events.slice() : [null];
    const pool = EVENT_POOL.slice();
    want.forEach(id => {
      const evt = id ? pool.find(e => e.id === id) : pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      if (!evt) return;
      deckEvents.push(evt);
      cards.push({ pairId: 'E_' + evt.id, kind: 'term', text: evt.term, emoji: evt.emoji, event: evt });
      cards.push({ pairId: 'E_' + evt.id, kind: 'hint', text: evt.hint, emoji: evt.emoji, event: evt });
    });
  }
  const totalPairs = cfg.size + deckEvents.length;
  // Fisher-Yates 洗牌
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="mm-box mm-fill">
      <div class="mm-head">
        <div>
          <div class="mm-title">🧠 ${escHtml(cfg.name)}</div>
          <div class="mm-sub">${escHtml(cfg.subtitle || '')}</div>
        </div>
        <div class="mm-close" title="关闭">✕</div>
      </div>
      <div class="mm-stats">
        ${cfg.timed ? '<span>⏱ <b class="mm-timer">' + (cfg.timeLimit || 0) + '</b>s</span>' : ''}
        <span>步数 <b class="mm-moves">0</b></span>
        <span>配对 <b class="mm-matched">0</b>/${totalPairs}</span>
        <span>🔥 <b class="mm-combo" style="color:#ff7a00"></b></span>
      </div>
      ${cfg.timed ? '<div class="mm-timerbar"><div class="mm-timerbar-fill high" style="width:100%"></div></div>' : ''}
      <div class="mm-grid"></div>
      <div class="mm-foot">${escHtml(cfg.tip || '记不住没关系，混个脸熟就行！')}</div>
    </div>`;
  document.body.appendChild(overlay);

  const grid = overlay.querySelector('.mm-grid');
  const cols = Math.ceil(Math.sqrt(cards.length));
  const rows = Math.ceil(cards.length / cols);
  const gap = 10;
  function fitCard(){
    const aw = grid.clientWidth - (cols - 1) * gap;
    const ah = grid.clientHeight - (rows - 1) * gap;
    const size = Math.max(36, Math.floor(Math.min(aw / cols, ah / rows)));
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', ' + size + 'px)';
    grid.style.gridTemplateRows = 'repeat(' + rows + ', ' + size + 'px)';
  }
  fitCard();
  requestAnimationFrame(fitCard);

  const timerEl = overlay.querySelector('.mm-timer');
  const movesEl = overlay.querySelector('.mm-moves');
  const matchedEl = overlay.querySelector('.mm-matched');
  const comboEl = overlay.querySelector('.mm-combo');

  let timeLeft = cfg.timeLimit || 0;
  let mmTimeTotal = Math.max(cfg.timeLimit || 0, 1);
  let moves = 0, matched = 0;
  let flipped = [], lock = false, finished = false;
  let timer = null;
  let shield = false;   // 护身卡：下次配错不扣时间

  if (cfg.timed) {
    let mmLastTick = 99;
    timer = setInterval(() => {
      timeLeft -= 0.1;
      if (timerEl) timerEl.textContent = Math.max(Math.ceil(timeLeft), 0);
      const mmSec = Math.ceil(timeLeft);
      if (mmSec <= 5 && mmSec > 0 && mmSec !== mmLastTick) { playSound('tick'); mmLastTick = mmSec; }
      const bar = overlay.querySelector('.mm-timerbar-fill');
      if (bar) {
        const pct = Math.max(0, Math.min(100, (timeLeft / mmTimeTotal) * 100));
        bar.style.width = pct + '%';
        bar.className = 'mm-timerbar-fill ' + (pct > 50 ? 'high' : pct > 25 ? 'mid' : 'low');
      }
      if (timeLeft <= 0 && !finished) { clearInterval(timer); finish(false); }
    }, 100);
  }

  function isCardMatched(i) { return grid.children[i] && grid.children[i].classList.contains('matched'); }
  function applyEvent(evt) {
    if (evt.effect === 'time') {
      if (cfg.timed) {
        timeLeft = Math.min(cfg.timeLimit || 60, timeLeft + 5);
        if (timerEl) timerEl.textContent = Math.max(Math.ceil(timeLeft), 0);
        const bar = overlay.querySelector('.mm-timerbar-fill');
        if (bar) {
          const pct = Math.max(0, Math.min(100, (timeLeft / mmTimeTotal) * 100));
          bar.style.width = pct + '%';
          bar.className = 'mm-timerbar-fill ' + (pct > 50 ? 'high' : pct > 25 ? 'mid' : 'low');
        }
        window.showToast('⏱ 时间 +5 秒！', 'success');
      } else {
        moves = Math.max(0, moves - 1);
        if (movesEl) movesEl.textContent = moves;
        window.showToast('⏱ 少记 1 步，更容易拿三星', 'success');
      }
    } else if (evt.effect === 'score') {
      moves = Math.max(0, moves - 2);
      if (movesEl) movesEl.textContent = moves;
      window.showToast('💎 少记 2 步，评价更稳', 'success');
    } else if (evt.effect === 'shield') {
      shield = true;
      window.showToast('🛡 护身卡就绪：下次配错不扣时间/不记步数', 'info');
    }
  }

  function flipCard(card) {
    if (lock || finished) return;
    if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
    if (flipped.length >= 2) return;
    card.classList.add('flipped');
    playSound('click');
    flipped.push(card);
    if (flipped.length === 2) {
      moves++;
      movesEl.textContent = moves;
      lock = true;
      const [a, b] = flipped;
      const da = cards[+a.dataset.idx], db = cards[+b.dataset.idx];
      if (da.pairId === db.pairId && da.kind !== db.kind) {
        setTimeout(() => {
          a.classList.add('matched');
          b.classList.add('matched');
          matched++;
          matchedEl.textContent = matched;
          playSound('success');
          streak++;
          bestStreak = Math.max(bestStreak, streak);
          if (comboEl) comboEl.textContent = streak >= 2 ? 'x' + streak : '';
          window.bumpGameStats({ mmStreak: bestStreak, mmMatched: (window.getGameStats().mmMatched || 0) + 1 });
          // —— 配对连击特效：彩屑粒子 + 连击环 + 飘字 ——
          try {
            const box = grid.getBoundingClientRect();
            const ax = a.getBoundingClientRect(), bx = b.getBoundingClientRect();
            const cx = (ax.left+ax.right+bx.left+bx.right)/4 - box.left;
            const cy = (ax.top+ax.bottom+bx.top+bx.bottom)/4 - box.top;
            // 彩屑粒子
            for (let k=0;k<14;k++){
              const p2=document.createElement('span');
              p2.className='mm-burst';
              const colors=['#00e676','#ffd700','#7ee8fa','#ff5252','#b388ff'];
              p2.style.cssText='left:'+(cx)+'px;top:'+(cy)+'px;--mx:'+((Math.random()*120-60))+'px;--my:'+((Math.random()*-100-20))+'px;background:'+colors[k%colors.length];
              grid.appendChild(p2);
              setTimeout(()=>{ try{p2.remove();}catch(e){} }, 600);
            }
            // 连击环（≥2 连）
            if (streak >= 2){
              const ring=document.createElement('div');
              ring.className='mm-combo-ring';
              ring.style.cssText='left:'+(cx-26)+'px;top:'+(cy-26)+'px';
              grid.appendChild(ring);
              setTimeout(()=>{ try{ring.remove();}catch(e){} }, 600);
              const fl=document.createElement('div');
              fl.className='mm-combo-float';
              fl.textContent = '🔥 连击 x'+streak+' +'+Math.min(10,5+streak*2)+'';
              fl.style.cssText='left:'+(cx)+'px;top:'+(cy-46)+'px';
              grid.appendChild(fl);
              setTimeout(()=>{ try{fl.remove();}catch(e){} }, 900);
            }
          } catch(e){}
          flipped = [];
          lock = false;
          if (da.event) applyEvent(da.event);
          if (matched === totalPairs) { clearInterval(timer); finish(true); }
        }, 320);
      } else {
        setTimeout(() => {
          a.classList.add('wrong');
          b.classList.add('wrong');
          streak = 0;
          if (comboEl) comboEl.textContent = '';
          playSound('error');
          if (cfg.timed) {
            if (shield) {
              shield = false;
              window.showToast('🛡 护身生效，这次不扣时间', 'info');
            } else {
              timeLeft = Math.max(0, timeLeft - 2.5);
              if (timerEl) timerEl.textContent = Math.max(Math.ceil(timeLeft), 0);
              const bar = overlay.querySelector('.mm-timerbar-fill');
              if (bar) {
                const pct = Math.max(0, Math.min(100, (timeLeft / mmTimeTotal) * 100));
                bar.style.width = pct + '%';
                bar.className = 'mm-timerbar-fill ' + (pct > 50 ? 'high' : pct > 25 ? 'mid' : 'low');
              }
              window.showToast('❌ 记错了，时间 -2.5s', 'error');
            }
          } else if (shield) {
            shield = false;
            moves = Math.max(0, moves - 1);
            if (movesEl) movesEl.textContent = moves;
            window.showToast('🛡 护身生效，这次不记步数', 'info');
          }
          setTimeout(() => {
            a.classList.remove('flipped', 'wrong');
            b.classList.remove('flipped', 'wrong');
            flipped = [];
            lock = false;
          }, 650);
        }, 480);
      }
    }
  }

  cards.forEach((c, idx) => {
    const card = document.createElement('div');
    card.className = 'mm-card';
    card.dataset.idx = idx;
    card.innerHTML = '<div class="mm-inner"><div class="mm-face mm-back"><span>❔</span></div><div class="mm-face mm-front"><div class="mm-emoji">' + c.emoji + '</div><div class="mm-text">' + escHtml(c.text) + '</div></div></div>';
    card.addEventListener('click', () => flipCard(card));
    grid.appendChild(card);
  });
  overlay.querySelector('.mm-close').onclick = () => {
    if (finished) return;
    clearInterval(timer);
    closeOverlay();
  };

  function closeOverlay() {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .3s';
    setTimeout(() => { window.playAreaMusic(); overlay.remove(); if (onComplete) onComplete(false); }, 300);
  }

  function finish(win) {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    const stars = win ? (moves <= totalPairs ? 3 : moves <= totalPairs * 1.5 ? 2 : 1) : 0;
    const stats = { moves: moves, matched: matched, totalPairs: totalPairs, stars: stars };
    if (win) {
      // 配对成功即收入图鉴
      const ids = cfg.pairs.map(pr => pr.id).filter(Boolean);
      if (ids.length) window.unlockPedia(window.currentLevelId, ids);
      // 全部配对：卡片依次点亮 + 结果横幅
      grid.querySelectorAll('.mm-card').forEach((c, i) => {
        setTimeout(() => c.classList.add('celebrate'), i * 45);
      });
      playSound('fanfare');
      if (cfg._silent) {
        // 连续关卡中途：简短庆祝后直接进下一关，不弹结算
        setTimeout(() => { overlay.remove(); if (onComplete) onComplete(true, stats); }, 600);
        return;
      }
      setTimeout(() => {
        grid.style.display = 'none';
        const foot = overlay.querySelector('.mm-foot');
        if (foot) foot.style.display = 'none';
        const res = document.createElement('div');
        res.className = 'mm-result';
        res.innerHTML = `
          <div class="big">🎉</div>
          <div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:6px">${escHtml(cfg.name)} 完成！</div>
          <div class="xp">+${cfg.xp || 0} XP</div>
          <div style="font-size:14px;color:var(--dim)">用 ${moves} 步配对 ${matched} 对 · 评价 ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
          <div style="font-size:13px;color:var(--cyan);margin-top:4px">厂长：术语全部入库！再看到它们就不会陌生了</div>
          <div class="note">热身奖励不计入排行榜，重在混个脸熟</div>
          <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
            <button class="mm-btn" data-act="again">🔁 再玩一次</button>
            <button class="mm-btn primary" data-act="done">${cfg._doneText || '收下奖励继续'}</button>
          </div>`;
        overlay.appendChild(res);
        overlay.querySelector('[data-act="again"]').onclick = () => { window.playAreaMusic(); overlay.remove(); openMemoryMatch(cfg, onComplete); };
        const _done = () => { window.playAreaMusic(); overlay.remove(); if (!cfg._noRecord) { window.recordGameWin('mm'); window.miniMarkClear(cfg.id); } if (onComplete) onComplete(true, stats); };
        overlay.querySelector('[data-act="done"]').onclick = _done;
      }, 700);
    } else {
      playSound('fail');
      if (cfg._silent) {
        // 连续关卡中途失败：交回结果，由外层统一出整场总结算
        setTimeout(() => { overlay.remove(); if (onComplete) onComplete(false, stats); }, 350);
        return;
      }
      // 超时/未完成
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `
        <div class="big">⏰</div>
        <div style="font-size:20px;font-weight:bold;color:var(--red);margin-top:6px">时间到，还差 ${totalPairs - matched} 对</div>
        <div style="font-size:14px;color:var(--dim);margin-top:8px">混个脸熟就行，再试一次吧！</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="mm-btn primary" data-act="retry">🔁 再来一次</button>
          <button class="mm-btn" data-act="skip">跳过，先干正事</button>
        </div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="retry"]').onclick = () => { window.playAreaMusic(); overlay.remove(); openMemoryMatch(cfg, onComplete); };
      overlay.querySelector('[data-act="skip"]').onclick = () => { window.playAreaMusic(); overlay.remove(); if (onComplete) onComplete(false, stats); };
    }
  }
}
