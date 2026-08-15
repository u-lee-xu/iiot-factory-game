// ═══════════════════════════════════════════════════════════════════
// games/hack — 拆自 app.js（openHacknet）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openHacknet(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('hack')) {
    window.showGameTutorial('hack', '🕹️ 黑客终端·网络溯源', [
      '屏幕上是一张<b>网络地图</b>，你要逐个<b>攻破节点</b>',
      '在下方<b>终端输入命令</b>（如 ping / ip addr / ssh…），命令对就拿下节点',
      '输错命令会<b>掉命</b>（提示会帮你）；拿下全部节点即过关'
    ], function(){ openHacknet(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('hack') || 'match');
  const nodes = (cfg.nodes || []).filter(n=>n && n.name);
  if (!nodes.length) { window.showToast('没有攻破目标', 'error'); return; }
  const LIVES = cfg._hard ? 2 : (cfg.lives || 3);
  let lives = LIVES, idx = 0, ended = false, resultWin = false;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="hk-box">
      <div class="mm-head"><div><div class="mm-title">🕹️ ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="hk-stats"><span>❤️ <b id="hkLives">${LIVES}</b></span><span>📡 节点 <b id="hkIdx">0</b>/${nodes.length}</span></div>
      <div class="hk-map" id="hkMap"></div>
      <div class="hk-term" id="hkTerm"></div>
      <div class="hk-input"><input id="hkInput" autocomplete="off" spellcheck="false" placeholder="输入命令…"><button class="ll-btn" id="hkGo">执行</button></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const mapEl = document.getElementById('hkMap'), termEl = document.getElementById('hkTerm');
  const livesEl = document.getElementById('hkLives'), idxEl = document.getElementById('hkIdx');
  const input = document.getElementById('hkInput');
  function log(html){ termEl.innerHTML += html + '<br>'; termEl.scrollTop = termEl.scrollHeight; }
  function norm(c){ return c.trim().toLowerCase().replace(/\s+/g,' '); }
  function renderMap() {
    mapEl.innerHTML = '';
    nodes.forEach((n,i) => {
      if (i>0) mapEl.insertAdjacentHTML('beforeend', '<span class="hk-link">→</span>');
      const d = document.createElement('div');
      d.className = 'hk-node' + (i<idx ? ' hacked' : i===idx ? ' cur' : '');
      d.innerHTML = '<span class="hk-emo">' + (n.emoji||'🖥️') + '</span>' + escHtml(n.name);
      mapEl.appendChild(d);
    });
  }
  function renderPrompt() {
    const n = nodes[idx];
    log('<span class="prompt">root@nuc:~$</span> 目标 <b>' + escHtml(n.name) + '</b>：' + escHtml(n.prompt || ''));
    log('<span style="color:var(--dim)">提示：' + escHtml(n.hint || '') + '</span>');
    idxEl.textContent = (idx+1);
  }
  function check() {
    const cmd = input.value; input.value = '';
    if (!cmd.trim()) return;
    log('<span class="prompt">root@nuc:~$</span> ' + escHtml(cmd));
    const n = nodes[idx];
    const ok = (n.expect || []).some(e => norm(e) === norm(cmd));
    if (ok) {
      log('<span style="color:#6f6">✅ 节点 ' + escHtml(n.name) + ' 已拿下！</span>');
      playSound('success');
      idx++;
      if (idx >= nodes.length) { endGame(true); return; }
      renderMap(); renderPrompt();
    } else {
      lives--; livesEl.textContent = lives;
      log('<span class="err">❌ 命令不对，攻击被拦截（-1 命）</span>');
      playSound('error'); window.shakeScreen();
      if (lives <= 0) { endGame(false); return; }
      log('<span style="color:var(--amber)">💡 ' + escHtml(n.tryHint || n.hint || '再想想该敲什么命令') + '</span>');
    }
  }
  input.addEventListener('keydown', e => { if (e.key==='Enter'){ e.preventDefault(); if (!ended) check(); } });
  document.getElementById('hkGo').onclick = () => { if (!ended) check(); };

  function endGame(isWin) {
    if (ended) return;
    ended = true; resultWin = isWin;
    input.disabled = true;
    if (isWin) { window.recordGameWin('hack'); window.miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=window.getGameStats(); _gs.hackBest=Math.max(_gs.hackBest||0, idx); _gs.hackWins=(_gs.hackWins||0)+(isWin?1:0); window.saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'全网络溯源完成！':'被反制了')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">拿下 <b style="color:var(--amber)">'+idx+'</b>/'+nodes.length+' 个节点</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.hkAgain()">🔁 再攻一轮</button><button class="mm-btn primary" onclick="window.hkDone()">收下奖励</button></div>';
      window.focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.hkAgain = () => { overlay.remove(); openHacknet(cfg, onComplete); };
  window.hkDone = () => { overlay.remove(); window.playAreaMusic(); if (onComplete) onComplete(resultWin); };
  function closeGame(manual) {
    if (ended) return;
    ended = true;
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); window.playAreaMusic(); }
  }
  renderMap(); renderPrompt();
  input.focus();
}
