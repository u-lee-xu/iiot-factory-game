// ═══════════════════════════════════════════════════════════════════
// ui/achievements.js — achievements 模块（拆自 app.js）
// import core/*；其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { dstr } from '../core/utils.js';
import { playSound } from '../core/sound.js';

export function getGameStats() {
  try { return JSON.parse(localStorage.getItem('game_stats') || '{}'); } catch (e) { return {}; }
}

export function saveGameStats(s) { localStorage.setItem('game_stats', JSON.stringify(s)); }

export function bumpGameStats(patch) {
  const s = getGameStats();
  Object.assign(s, patch);
  saveGameStats(s);
}

export function miniTier(id) { if (!id) return 0; try { return parseInt(localStorage.getItem('mini_clear_' + id) || '0', 10); } catch (e) { return 0; } }

export function miniMarkClear(id) { if (!id) return; try { var n = miniTier(id); localStorage.setItem('mini_clear_' + id, String(n + 1)); } catch (e) {} }

export function miniTierBadge(id) {
  var t = miniTier(id);
  if (t >= 2) return ' <span style="color:var(--cyan)">∞ 无限战</span>';
  if (t === 1) return ' <span style="color:var(--green)">✓ 已通关</span>';
  return '';
}

export function applyMiniTier(cfg) {
  if (!cfg) return cfg;
  var t = miniTier(cfg.id);
  cfg._tier = t;
  cfg._hard = t >= 1;      // 二周目：加难
  cfg._endless = t >= 2;   // 三周目：不限时无限战
  return cfg;
}

export function focusResultPrimary(overlay){ setTimeout(function(){ var b=overlay&&overlay.querySelector('.mm-btn.primary'); if(b) b.focus(); }, 50); }

export function recordGameWin(type) {
  const t = type || 'mm';
  const gs = getGameStats();
  gs.gamesWin = (gs.gamesWin || 0) + 1;
  if (t === 'mm') gs.mmWins = (gs.mmWins || 0) + 1;
  else if (t === 'qk') gs.qkWins = (gs.qkWins || 0) + 1;
  else if (t === 'match') gs.matchWins = (gs.matchWins || 0) + 1;
  else if (t === 'typing') gs.typingWins = (gs.typingWins || 0) + 1;
  else if (t === 'shooter') gs.shooterWins = (gs.shooterWins || 0) + 1;
  else if (t === 'racing') gs.racingWins = (gs.racingWins || 0) + 1;
  else if (t === 'snake') gs.snakeWins = (gs.snakeWins || 0) + 1;
  else if (t === 'flappy') gs.flappyWins = (gs.flappyWins || 0) + 1;
  else if (t === 'mole') gs.moleWins = (gs.moleWins || 0) + 1;
  else if (t === 'pacman') gs.pacmanWins = (gs.pacmanWins || 0) + 1;
  else if (t === 'tank') gs.tankWins = (gs.tankWins || 0) + 1;
  else if (t === 'breakout') gs.breakoutWins = (gs.breakoutWins || 0) + 1;
  else if (t === 'sorter') gs.sorterWins = (gs.sorterWins || 0) + 1;
  else if (t === 'forge') gs.forgeWins = (gs.forgeWins || 0) + 1;
  else if (t === 'll') gs.llWins = (gs.llWins || 0) + 1;
  else if (t === 'pipe') gs.pipeWins = (gs.pipeWins || 0) + 1;
  else if (t === 'm3') gs.m3Wins = (gs.m3Wins || 0) + 1;
  else if (t === 'td') gs.tdWins = (gs.tdWins || 0) + 1;
  else if (t === 't48') gs.t48Wins = (gs.t48Wins || 0) + 1;
  else if (t === 'maze') gs.mazeWins = (gs.mazeWins || 0) + 1;
  else if (t === 'hack') gs.hackWins = (gs.hackWins || 0) + 1;
  else if (t === 'tyc') gs.tycWins = (gs.tycWins || 0) + 1;
  else if (t === 'lzr') gs.lzrWins = (gs.lzrWins || 0) + 1;
  else if (t === 'boss') gs.bossWins = (gs.bossWins || 0) + 1;
  const lv = window.currentLevelId;
  if (lv) {
    gs.lvlWins = gs.lvlWins || {};
    const k = '' + lv;
    gs.lvlWins[k] = (gs.lvlWins[k] || 0) + 1;
  }
  saveGameStats(gs);
  evaluateAchievements(true);
}

export function achievementContext() {
  const ctx = {
    doneCount: 0, total: 0, levelDone: {}, allLevels: true,
    xp: window.calcTotalXP(), isPioneer: false, anyLevel3Star: false, anyLevel5Star: false
  };
  // 小游戏表现统计
  const gs = getGameStats();
  ctx.mmStreak = gs.mmStreak || 0;
  ctx.qkCombo = gs.qkCombo || 0;
  ctx.gamesWin = gs.gamesWin || 0;
  ctx.mmMatched = gs.mmMatched || 0;
  ctx.mmWins = gs.mmWins || 0;
  ctx.qkWins = gs.qkWins || 0;
  ctx.matchWins = gs.matchWins || 0;
  ctx.typingWins = gs.typingWins || 0;
  ctx.shooterWins = gs.shooterWins || 0;
  ctx.shooterMaxLevel = gs.shooterMaxLevel || 0;
  ctx.shooterPickups = gs.shooterPickups || 0;
  ctx.sorterWins = gs.sorterWins || 0;
  ctx.sorterCombo = gs.sorterCombo || 0;
  ctx.sorterBest = gs.sorterBest || 0;
  ctx.forgeWins = gs.forgeWins || 0;
  ctx.forgeBest = gs.forgeBest || 0;
  ctx.forgeCombo = gs.forgeCombo || 0;
  ctx.llWins = gs.llWins || 0;
  ctx.llBest = gs.llBest || 0;
  ctx.pipeWins = gs.pipeWins || 0;
  ctx.pipeBest = gs.pipeBest || 0;
  ctx.m3Wins = gs.m3Wins || 0;
  ctx.m3Best = gs.m3Best || 0;
  ctx.tdWins = gs.tdWins || 0;
  ctx.tdBest = gs.tdBest || 0;
  ctx.t48Wins = gs.t48Wins || 0;
  ctx.t48Best = gs.t48Best || 0;
  ctx.mazeWins = gs.mazeWins || 0;
  ctx.mazeBest = gs.mazeBest || 0;
  ctx.hackWins = gs.hackWins || 0;
  ctx.hackBest = gs.hackBest || 0;
  ctx.tycWins = gs.tycWins || 0;
  ctx.tycBest = gs.tycBest || 0;
  ctx.lzrWins = gs.lzrWins || 0;
  ctx.lzrBest = gs.lzrBest || 0;
  ctx.bossWins = gs.bossWins || 0;
  ctx.bossBest = gs.bossBest || 0;
  ctx.gameTypes = window.countUnlockedGameTypes();
  ctx.lvlWins = gs.lvlWins || {};
  ctx.pediaCount = window.getPediaCount();
  window.content.levels.forEach(lv => {
    const prog = window.levelProgress(lv.id);
    ctx.doneCount += prog.done;
    ctx.total += prog.total;
    ctx.levelDone[lv.id] = prog.completed;
    if (!prog.completed) ctx.allLevels = false;
  });
  if (window.leaderboardCache && window.leaderboardCache.pioneers) {
    ctx.isPioneer = Object.values(window.leaderboardCache.pioneers).indexOf(window.myName) >= 0;
  }
  Object.keys(window.gameState.stars || {}).forEach(lvId => {
    const v = window.areaStars(lvId);
    if (v >= 3) ctx.anyLevel3Star = true;
    if (v >= 4.5) ctx.anyLevel5Star = true;
  });
  return ctx;
}

export function evaluateAchievements(showPopups) {
  if (!window.content) return;
  const ctx = achievementContext();
  const newly = [];
  window.ACHIEVEMENTS.forEach(a => {
    if (!window.gameState.achievements[a.id] && a.test(ctx)) {
      window.gameState.achievements[a.id] = new Date().toISOString();
      newly.push(a);
    }
  });
  if (window.PASSWORD_ENABLED) document.getElementById('passwordBtn').style.display = '';
  if (newly.length) {
    renderAchBar();
    window.saveState();
    // 合并写 seen：保留教师发放/登录签到成就的"已看"标记，避免被系统成就覆盖丢失导致重复弹
    setSeenAch(Object.assign({}, getSeenAch(), window.gameState.achievements));
    if (showPopups) {
      window.achQueue = window.achQueue.concat(newly);
      drainAchQueue();
    }
  }
  return newly;
}

export function markPopupToday(t){ try{ localStorage.setItem('popup_day_'+t, dstr()); }catch(e){} }

export function enqueueLoginPopup(job){ window.loginPopQueue.push(job); drainLoginPopups(); }

export function drainLoginPopups(){
  if (window.loginPopActive) return;
  const job = window.loginPopQueue.shift();
  if (!job) return;
  window.loginPopActive = true;
  job(function(){ window.loginPopActive = false; setTimeout(drainLoginPopups, 300); });
}

export function enqueueAchievementsJob(){
  enqueueLoginPopup(function(done){
    let lastEmptyAt = 0;
    function settle(){
      if (window.achQueue.length === 0 && !window.achShowing) {
        if (!lastEmptyAt) lastEmptyAt = Date.now();
        if (Date.now() - lastEmptyAt > 1000) return done();
      } else { lastEmptyAt = 0; }
      setTimeout(settle, 250);
    }
    settle();
    drainAchQueue();
  });
}

export function drainAchQueue(onAllDone) {
  // 串行：同一时刻只弹一个成就，防止多处 evaluateAchievements 并发 drain 造成成就叠弹
  if (window.achDraining) return;
  if (window.achQueue.length === 0) { if (onAllDone) onAllDone(); return; }
  window.achDraining = true;
  const a = window.achQueue.shift();
  showAchievementUnlock(a, () => { window.achDraining = false; setTimeout(() => drainAchQueue(onAllDone), 300); }, a.__source);
}

export function getSeenAch(){ try{ return JSON.parse(localStorage.getItem(window.ACH_SEEN_KEY)||'{}'); }catch(e){ return {}; } }

export function setSeenAch(o){ try{ localStorage.setItem(window.ACH_SEEN_KEY, JSON.stringify(o||{})); }catch(e){} }

export function detectNewServerAchievements(){
  const seen = getSeenAch();
  const fresh = [];
  // 教师手动发放的成就（teacherAwards）
  Object.keys(window.gameState.teacherAwards || {}).forEach(id => { if (!seen[id]) fresh.push({ id, source: 'teacher' }); });
  // 系统自动发放的登录签到成就（login_*）：只提示“服务端当天新授予”的，
  // 不再遍历所有历史 login 成就——避免 seen 快照丢失(换设备/清缓存)后每次进入都重复弹窗
  (window.gameState.newlyAwardedLogin || []).forEach(id => { if (!seen[id]) fresh.push({ id, source: 'auto' }); });
  // 快照：所有成就（含教师发放）
  const snap = Object.assign({}, window.gameState.achievements || {}, window.gameState.teacherAwards || {});
  setSeenAch(snap);
  if (!fresh.length) return;
  window.achQueue = window.achQueue.concat(fresh.map(f => {
    const a = window.ACHIEVEMENTS.find(x => x.id === f.id);
    return a ? Object.assign({}, a, { __source: f.source }) : null;
  }).filter(Boolean));
  drainAchQueue();
}

export function showAchievementUnlock(ach, cb, source) {
  playSound('levelup');
  const isTeacher = source === 'teacher';
  const srcLabel = isTeacher ? '🎁 老师发放的成就' : source === 'auto' ? '📅 登录签到成就' : '🎖️ 成就解锁';
  const accent = isTeacher ? '#ffd27d' : 'var(--amber)';
  const glow = isTeacher ? 'rgba(255,210,125,.38)' : 'rgba(255,176,0,.28)';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.8);z-index:10001;display:flex;align-items:center;justify-content:center';
  const box = document.createElement('div');
  box.style.cssText = 'background:#12121a;border:2px solid ' + accent + ';border-radius:14px;padding:34px 48px;max-width:430px;width:90%;text-align:center;box-shadow:0 0 80px ' + glow + ';animation:achPop .45s ease;position:relative;overflow:hidden';
  let sparks = '';
  const sc = ['✦','✧','✨','⭐'];
  for (let i = 0; i < 12; i++) {
    sparks += '<span style="position:absolute;left:' + (6 + Math.random() * 88).toFixed(1) + '%;top:' + (4 + Math.random() * 90).toFixed(1) + '%;font-size:' + (10 + Math.random() * 14).toFixed(1) + 'px;color:#ffd27d;opacity:0;animation:achSpark 1.3s ease-out ' + (Math.random() * .5).toFixed(2) + 's;pointer-events:none">' + sc[i % 4] + '</span>';
  }
  box.innerHTML = sparks + '<div style="font-size:64px;line-height:1;animation:achBounce .6s ease">' + ach.emoji + '</div>' +
    '<div style="font-size:13px;color:' + accent + ';margin:14px 0 6px;letter-spacing:2px;font-weight:bold">' + srcLabel + '</div>' +
    '<div style="font-size:24px;font-weight:bold;color:var(--text)">' + ach.name + '</div>' +
    '<div style="font-size:13px;color:var(--dim);margin-top:8px;line-height:1.6">' + ach.desc + '</div>' +
    '<div style="font-size:11px;color:#3a3a48;margin-top:14px">锐智工厂 · 已点亮 ' + Object.keys(window.gameState.achievements || {}).length + '/' + window.ACHIEVEMENTS.length + ' 枚徽章</div>';
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  window.achShowing = true;
  setTimeout(() => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .3s';
    setTimeout(() => {
      window.playAreaMusic(); overlay.remove(); window.achShowing = false;
      // 登录签到成就：提示一次后标记服务端已提示，确保换设备/清缓存也不再重复弹
      if (source === 'auto' && ach && ach.id) {
        try { fetch(window.API + '/api/student/notify-login-ach', { method: 'POST', headers: {'Content-Type':'application/json','Authorization':'Bearer '+window.token}, body: JSON.stringify({ ids: [ach.id] }) }); } catch(e){}
      }
      if (cb) cb();
    }, 300);
  }, 2500);
}

export function renderAchBar() {
  const bar = document.getElementById('achBar');
  if (!bar) return;
  const gotList = window.ACHIEVEMENTS.filter(a => window.gameState.achievements[a.id]);
  if (!gotList.length) {
    bar.innerHTML = '<span class="ach-bar-label">🎖️ 暂无徽章 — 完成任务，点亮工厂的同时点亮徽章</span>';
    return;
  }
  bar.innerHTML = '<span class="ach-bar-label">🎖️ 已点亮 ' + gotList.length + '/' + window.ACHIEVEMENTS.length + ' 枚徽章</span> '
    + gotList.map(a => '<span class="ach-bar-emoji" title="' + a.name + ((window.gameState.teacherAwards && window.gameState.teacherAwards[a.id]) ? '（老师发放）' : '') + '">' + a.emoji + '</span>').join('');
}
