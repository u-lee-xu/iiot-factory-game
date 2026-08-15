// ═══════════════════════════════════════════════════════════════════
// ui/leaderboard.js — leaderboard 模块（拆自 app.js）
// import core/*；其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { _fmtTime, escHtml } from '../core/utils.js';

export async function refreshLeaderboard() {
  try {
    const res = await window.api('/window.api/game/leaderboard');
    if (res && res.ok) window.leaderboardCache = res.data;
  } catch (e) { /* 网络失败静默，打开面板时重试 */ }
}

export function openGameRecords(){ document.getElementById('recBody').innerHTML = renderGameRecords(); document.getElementById('recOverlay').classList.add('show'); }

export function closeGameRecords(){ document.getElementById('recOverlay').classList.remove('show'); }

export function renderGameRecords(){
  const gs = window.getGameStats() || {};
  const s = (k,d)=>(k in gs ? gs[k] : d);
  let h = '';
  h += '<div class="rec-card"><div class="rc-name">🔫 术语防御战</div>'+
    '<div class="rc-row">游玩 <b>'+s('typingPlays',0)+'</b> 次 · 通关 <b>'+s('typingWins',0)+'</b> 次</div>'+
    '<div class="rc-row">最高分 <b>'+s('typingBest',0)+'</b> · 最远到第 <b>'+s('typingWaves',0)+'</b> 波</div>'+
    '<div class="rc-row">坚持最长 <b>'+s('typingTime',0)+'</b> 秒 · 最高连击 <b>'+s('typingCombo',0)+'</b></div></div>';
  h += '<div class="rec-card"><div class="rc-name">🃏 翻牌</div>'+
    '<div class="rc-row">完成 <b>'+s('mmWins',0)+'</b> 次 · 最高连对 <b>'+s('mmStreak',0)+'</b></div>'+
    '<div class="rc-row">累计配对 <b>'+s('mmMatched',0)+'</b> 对</div></div>';
  h += '<div class="rec-card"><div class="rc-name">⚡ 快打</div>'+
    '<div class="rc-row">完成 <b>'+s('qkWins',0)+'</b> 次 · 最高连击 <b>'+s('qkCombo',0)+'</b></div></div>';
  h += '<div class="rec-card"><div class="rc-name">🔗 连线</div>'+
    '<div class="rc-row">完成 <b>'+s('matchWins',0)+'</b> 次</div></div>';
  h += '<div class="rec-card"><div class="rc-name">🛸 数据蜂群</div>'+
    '<div class="rc-row">游玩 <b>'+s('shooterPlays',0)+'</b> 次 · 通关 <b>'+s('shooterWins',0)+'</b> 次</div>'+
    '<div class="rc-row">🚀 最强火力 <b>'+s('shooterMaxLevel',1)+'</b> 级 · 拾取道具 <b>'+s('shooterPickups',0)+'</b> 个</div>'+
    '<div class="rc-row">最高分 <b>'+s('shooterBest',0)+'</b> · 最远到第 <b>'+s('shooterWaves',0)+'</b> 波</div></div>';
  h += '<div class="rec-card"><div class="rc-name">🎮 小游戏总计</div>'+
    '<div class="rc-row">累计完成 <b>'+s('gamesWin',0)+'</b> 个小游戏</div></div>';
  return h;
}

export function openLeaderboard() {
  document.getElementById('lbOverlay').classList.add('show');
  if (!window.leaderboardCache) refreshLeaderboard();
  switchLbTab('rank');
}

export function openAchievements() {
  document.getElementById('lbOverlay').classList.add('show');
  switchLbTab('ach');
}

export function closeLb() {
  if (window._mapFlowFeature) { window.goMap(); return; }
  document.getElementById('lbOverlay').classList.remove('show');
}

export function switchLbTab(tab) {
  window.lbTab = tab;
  document.getElementById('tabRank').classList.toggle('active', tab === 'rank');
  document.getElementById('tabAch').classList.toggle('active', tab === 'ach');
  if (tab === 'ach') renderAchievements(document.getElementById('lbBody'));
  else renderLeaderboard(document.getElementById('lbBody'));
}

export function renderLeaderboard(body) {
  const d = window.leaderboardCache;
  if (!d || !window.content) { body.innerHTML = '<div class="lb-empty">加载中…</div>'; return; }
  let html = `
    <div class="lb-summary">
      <div>班级完成率 <b>${d.classCompletion}%</b></div>
      <div>我的名次 <b>${d.myRank > 0 ? d.myRank : '—'}</b> / ${d.rows.length}</div>
      <div>班级人数 <b>${d.rows.length}</b></div>
    </div>
    <div class="lb-list">`;
  d.rows.forEach((r, i) => {
    const rank = window.getRank(r.xp);
    const isMe = r.name === window.myName;
    const pioneerLvs = Object.keys(d.pioneers).filter(k => d.pioneers[k] === r.name);
    html += `
      <div class="lb-row${isMe ? ' me' : ''}">
        <div class="lb-no">${i + 1}</div>
        <div class="lb-name">${escHtml(r.name)}${((r.name===window.myName) && (window.gameState.inventory||{}).title_badge>0) ? '<span class="lb-pioneer" title="厂级先锋称号"> 🏅</span>' : ''}${pioneerLvs.length ? '<span class="lb-pioneer" title="先锋：第' + pioneerLvs.join('、第') + '关"> 🚩</span>' : ''}</div>
        <div class="lb-rank">${rank.emoji} ${rank.title}</div>
        <div class="lb-xp">${r.xp} XP</div>
        <div class="lb-bar"><div class="lb-bar-fill" style="width:${r.completion}%"></div><span>${r.completion}%</span></div>
      </div>`;
  });
  html += '</div>';
  // ⏱ 我的通关记录（每关首通时间）
  const _me = d.rows.find(r => r.name === window.myName);
  const _mf = _me ? (_me.levelFinish || {}) : {};
  html += '<div class="lb-pioneers"><div class="lb-pioneers-title">⏱ 我的通关记录（首通时间）</div>';
  (window.content.levels || []).forEach(lv => {
    const t = _mf[lv.id];
    html += '<div class="lb-pioneer-line">第 ' + lv.id + ' 关 ' + escHtml(lv.areaName || '') + '：<b>' + (t ? _fmtTime(t) : '未通关') + '</b></div>';
  });
  html += '</div>';
  const pioneerKeys = Object.keys(d.pioneers);
  if (pioneerKeys.length && window.content.levels) {
    html += '<div class="lb-pioneers"><div class="lb-pioneers-title">🚩 关卡先锋（班级首位完成）</div>';
    window.content.levels.forEach(lv => {
      const pp = d.pioneers[lv.id];
      html += `<div class="lb-pioneer-line">第 ${lv.id} 关 ${escHtml(lv.areaName || '')}：<b>${pp ? escHtml(pp) : '—'}</b>${pp === window.myName ? ' <span style="color:var(--amber)">(我!)</span>' : ''}</div>`;
    });
    html += '</div>';
  }
  body.innerHTML = html;
}

export function renderAchievements(body) {
  const ctx = window.achievementContext();
  let html = '<div class="ach-grid">';
  window.ACHIEVEMENTS.forEach(a => {
    const got = !!window.gameState.achievements[a.id];
    const can = a.test(ctx);
    html += `
      <div class="ach-cell ${got ? 'got' : (can ? 'can' : '')}">
        <div class="ach-emoji">${got ? a.emoji : '🔒'}</div>
        <div class="ach-name">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
        ${got ? '<div class="ach-tag">已解锁</div>' : (can ? '<div class="ach-tag can">可解锁</div>' : '')}
    ${window.gameState.teacherAwards && window.gameState.teacherAwards[a.id] ? '<div class="ach-tag" style="color:#ffd27d">🎁 老师发放</div>' : ''}
      </div>`;
  });
  html += '</div>';
  body.innerHTML = html;
}
