// ═══════════════════════════════════════════════════════════════════
// games/tyc — 拆自 app.js（openTycoon）
// 依赖 core/utils、core/sound；其余公共函数经 window（app.js 挂载）
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playMusic, playSound } from '../core/sound.js';

export function openTycoon(cfg, onComplete) {
  window.applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!window.tutSeen('tyc')) {
    window.showGameTutorial('tyc', '🏭 工厂大亨·数据经营', [
      '<b>点大按钮</b>产出数据；买机器让它<b>自动产出</b>',
      '机器按 ISA-95 层级解锁：传感器→PLC→SCADA→MES→ERP，越高级产得越快',
      '<b>数据累计到目标值即过关</b>，越高档机器越划算'
    ], function(){ openTycoon(cfg, onComplete); });
    return;
  }
  playMusic(window.gameSong('tyc') || 'match');
  const TIERS = (cfg.tiers || [
    {name:'传感器', emoji:'🌡️', base:1, cost:10},
    {name:'PLC', emoji:'⚙️', base:6, cost:50},
    {name:'SCADA', emoji:'🖥️', base:35, cost:250},
    {name:'MES', emoji:'🗂️', base:180, cost:1200},
    {name:'ERP', emoji:'🏢', base:900, cost:6000}
  ]).map((t,i)=>({name:t.name, emoji:t.emoji, base:t.base, cost:t.cost}));
  const TARGET = cfg.target || 50000;
  let data = 0, total = 0, click = 1, ended = false, resultWin = false;
  let levels = TIERS.map(()=>0);
  let last = performance.now(), raf = 0;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="tyc-box">
      <div class="mm-head"><div><div class="mm-title">🏭 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="tyc-stats"><span>🎯 目标 <b>${TARGET.toLocaleString()}</b></span><span>⏱ <b id="tycTime">0</b>s</span></div>
      <div class="tyc-main"><button class="tyc-click" id="tycClick">📊</button></div>
      <div class="tyc-data" id="tycData">0 / ${TARGET.toLocaleString()}</div>
      <div class="tyc-rate" id="tycRate">每秒产出 0</div>
      <div class="tyc-shop" id="tycShop"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const dataEl = document.getElementById('tycData'), rateEl = document.getElementById('tycRate'), timeEl = document.getElementById('tycTime');
  const clickBtn = document.getElementById('tycClick'), shopEl = document.getElementById('tycShop');
  let elapsed = 0;

  function renderShop() {
    shopEl.innerHTML = '';
    TIERS.forEach((t,i) => {
      const cost = Math.ceil(t.cost * Math.pow(1.6, levels[i]));
      const item = document.createElement('div');
      item.className = 'tyc-item';
      item.innerHTML = '<div><div class="nm">' + t.emoji + ' ' + escHtml(t.name) + ' <b>x'+levels[i]+'</b></div><div class="ct">每级每秒 +'+t.base+' · 成本 '+cost.toLocaleString()+'</div></div><button data-i="'+i+'" '+(data>=cost?'':'disabled')+'>买入</button>';
      item.querySelector('button').onclick = () => { if (data>=cost){ data-=cost; levels[i]++; playSound('click'); renderShop(); } };
      shopEl.appendChild(item);
    });
  }
  clickBtn.onclick = () => { data += click; total += click; playSound('click'); flashData(); renderShop(); };
  function flashData() {
    dataEl.textContent = Math.floor(data).toLocaleString() + ' / ' + TARGET.toLocaleString();
    if (total >= TARGET) endGame(true);
  }
  function frame(now) {
    const dt = Math.min(0.05,(now-last)/1000); last = now;
    if (!ended) {
      const rate = TIERS.reduce((a,t,i)=>a + t.base*levels[i], 0);
      data += rate*dt; total += rate*dt;
      rateEl.textContent = '每秒产出 ' + Math.round(rate);
      dataEl.textContent = Math.floor(data).toLocaleString() + ' / ' + TARGET.toLocaleString();
      renderShop();
      if (total >= TARGET) endGame(true);
      raf = requestAnimationFrame(frame);
    }
  }
  function endGame(isWin) {
    if (ended) return;
    ended = true; resultWin = isWin;
    cancelAnimationFrame(raf);
    if (isWin) { window.recordGameWin('tyc'); window.miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=window.getGameStats(); _gs.tycBest=Math.max(_gs.tycBest||0, Math.round(total)); _gs.tycWins=(_gs.tycWins||0)+(isWin?1:0); window.saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'数据产值达标，工厂转起来了！':'还没达标')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">总数据 <b style="color:var(--amber)">'+Math.round(total).toLocaleString()+'</b> · 用时 <b style="color:var(--amber)">'+Math.round(elapsed)+'</b>s</div>'+
        '<div style="display:flex;gap:10px;justify-window.content:center;margin-top:16px"><button class="mm-btn" onclick="window.tycAgain()">🔁 再经营一轮</button><button class="mm-btn primary" onclick="window.tycDone()">收下奖励</button></div>';
      window.focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.tycAgain = () => { overlay.remove(); openTycoon(cfg, onComplete); };
  window.tycDone = () => { overlay.remove(); window.playAreaMusic(); if (onComplete) onComplete(resultWin); };
  function closeGame(manual) {
    if (ended) return;
    ended = true; cancelAnimationFrame(raf);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); window.playAreaMusic(); }
  }
  renderShop();
  raf = requestAnimationFrame(frame);
}
