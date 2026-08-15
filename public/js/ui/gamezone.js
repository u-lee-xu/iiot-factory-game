// ═══════════════════════════════════════════════════════════════════
// ui/gamezone.js — gamezone 模块（拆自 app.js）
// import core/*；其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';

// 词库解析：warmup 用 pairsFrom 引用词库池
//   {unit:id}  单小节池 | {act:true} 幕池 | {all:true} 综合池（全书）
function resolveTermPairs(w, lv, all){
  const fr = w.pairsFrom;
  if (!fr) return w.pairs || [];
  if (fr.unit){ const u=(lv.units||[]).find(x=>x.id===fr.unit); return (u && u.pairs) || []; }
  // act/all 合并池：只收 term/hint 结构（memory/ll/snake/quick 等用）；left/right 匹配词条仅 match 用，不混入
  const arr=[]; const push=(p)=>{ if(p.term && p.hint && !arr.some(q=>q.term===p.term)) arr.push(p); };
  if (fr.act){ (lv.units||[]).forEach(u=>(u.pairs||[]).forEach(push)); return arr; }
  if (fr.all){ (all||[]).forEach(l=>(l.units||[]).forEach(u=>(u.pairs||[]).forEach(push))); return arr; }
  return w.pairs || [];
}
export function loadTermCards() {
  return fetch('/data/term-cards.json').then(r => r.json()).then(d => {
    // 加载后统一把引用解析成 pairs，各游戏读取不变
    (d.levels||[]).forEach(lv=>{
      (lv.warmups||[]).forEach(w=>{ if (w.pairsFrom) w.pairs = resolveTermPairs(w, lv, d.levels); });
    });
    window.TERM_CARDS = d;
    try { if (typeof window.evaluateAchievements === 'function') window.evaluateAchievements(false); } catch (e) {}
  }).catch(() => { window.TERM_CARDS = null; });
}

export function getTermLevel(levelId) {
  if (!window.TERM_CARDS) return null;
  return window.TERM_CARDS.levels.find(l => l.levelId === levelId) || null;
}

export function termWarmupDone(key) { return localStorage.getItem('term_' + key) === '1'; }

export function markTermWarmupDone(key) { localStorage.setItem('term_' + key, '1'); }

export function countUnlockedGameTypes() {
  try {
    if (!window.TERM_CARDS || !window.TERM_CARDS.levels) return 0;
    const set = new Set();
    window.TERM_CARDS.levels.forEach(lv => {
      (lv.warmups || []).forEach(w => {
        const bt = w.blockTasks;
        if (Array.isArray(bt) && bt.length && bt.every(tid => window.isTaskDone(tid))) set.add(w.type || 'memory');
      });
    });
    return set.size;
  } catch (e) { return 0; }
}

// 解锁判断：普通游戏需完成全部 blockTasks；幕级/综合复习游戏(_review/all_review)放宽到 80%
export function isUnlocked(w){
  const bt = w.blockTasks || [];
  if (!Array.isArray(bt) || !bt.length) return false;
  const done = bt.filter(tid => window.isTaskDone(tid)).length;
  const review = /_review$/.test(w.id || '') || (w.id === 'all_review');
  if (review) return done >= Math.ceil(bt.length * 0.8);
  return done >= bt.length;
}

export function gzEmoji(w) {
  const t = w.type || 'memory';
  return t==='quick'?'⚡':t==='match'?'🔗':t==='storm'?'🌪️':t==='alarm'?'🚨':t==='typing'?'🔫':t==='shooter'?'🛸':t==='racing'?'🏎️':t==='snake'?'🐍':t==='flappy'?'🦅':t==='mole'?'🔨':t==='pacman'?'👾':t==='tank'?'🎯':t==='breakout'?'🧱':t==='sorter'?'📦':t==='forge'?'🔥':t==='ll'?'🔗':t==='pipe'?'🔧':t==='m3'?'🍬':t==='td'?'🛡️':t==='t48'?'🔢':t==='maze'?'🌐':t==='hack'?'🕹️':t==='tyc'?'🏭':t==='lzr'?'🔦':t==='boss'?'🎯':'🃏';
}

export function gzMeta(w) {
  const t = w.type || 'memory';
  if (t==='quick') return (w.size||0) + ' 题';
  if (t==='match') return (w.size||0) + ' 组';
  if (t==='storm') return (w.waves||0) + ' 波';
  if (t==='alarm') return (w.devices||0) + ' 台';
  if (t==='typing') return ((w.words||[]).length) + ' 词';
  if (t==='shooter') return (w.waves||4) + ' 波编队';
  if (t==='racing') return '坚持 45s 通关';
  if (t==='snake') return '吃网络三件套';
  if (t==='flappy') return '躲断线黑洞';
  if (t==='mole') return '点掉异常数据';
  if (t==='pacman') return '吃镜像层';
  if (t==='tank') return '守卫 Broker';
  if (t==='breakout') return '消设备故障';
  if (t==='sorter') return (w.waves||3) + ' 波分类';
  if (t==='forge') return '合成' + (w.target||'TB');
  if (t==='ll') return ((w.pairs||[]).length) + ' 组配对';
  if (t==='pipe') return (w.cols||4) + '×' + (w.rows||4) + ' 管道';
  if (t==='m3') return (w.waves||3) + ' 波消消乐';
  if (t==='td') return (w.waves||3) + ' 波防线';
  if (t==='t48') return '合成' + (w.target||'TB');
  if (t==='maze') return '迷宫寻路';
  if (t==='hack') return ((w.nodes||[]).length) + ' 个节点';
  if (t==='tyc') return '目标' + (w.target||50000);
  if (t==='lzr') return '光束路由';
  if (t==='boss') return (w.shots||5) + ' 发';
  if (w.rounds) return w.rounds.map(r=>r*2).join('→') + ' 张';
  return (w.size*2) + ' 张';
}

export function gzName(w) {
  const t = w.type || 'memory';
  const special = t==='quick'||t==='match'||t==='storm'||t==='alarm'||t==='typing'||t==='shooter'||t==='racing'||t==='snake'||t==='flappy'||t==='mole'||t==='pacman'||t==='tank'||t==='breakout'||t==='sorter'||t==='forge'||t==='ll'||t==='pipe'||t==='m3'||t==='td'||t==='t48'||t==='maze'||t==='hack'||t==='tyc'||t==='lzr'||t==='boss';
  return special ? escHtml(w.name) : '翻牌 · ' + escHtml(w.name);
}

export function renderGameZone(body) {
  if (!window.TERM_CARDS || !window.content) { body.innerHTML = '<div class="lb-empty">加载中…</div>'; return; }
  window.gzList = [];
  // 按游戏类型分组排序：同一类型排一起，方便按类型测试、不重不漏
  const TYPE_ORDER = [
    ['memory','🧠','翻牌配对'],
    ['quick','⚡','快打'],
    ['typing','🔫','术语防御战'],
    ['shooter','🛸','数据蜂群'],
    ['td','🛡️','车间防线'],
    ['snake','🐍','网线贪吃蛇'],
    ['pacman','👾','容器吃豆人'],
    ['ll','🔗','连连看'],
    ['match','🔗','连线匹配'],
    ['sorter','📦','数据分类'],
    ['forge','🔥','数据熔炉'],
    ['t48','🔢','2048·数据融合'],
    ['racing','🏎️','数据狂飙'],
    ['flappy','🦅','云端跳跃'],
    ['mole','🔨','边缘打地鼠'],
    ['storm','🌪️','数据风暴'],
    ['alarm','🚨','值班抢险'],
    ['maze','🌐','数据迷宫'],
    ['hack','🕹️','黑客终端'],
    ['tyc','🏭','工厂大亨'],
    ['pipe','🔧','管道工'],
    ['lzr','🔦','激光反射'],
    ['tank','🎯','消息守卫'],
    ['breakout','🧱','AI打砖块'],
    ['m3','🍬','消消乐'],
    ['boss','💥','厂长Boss战']
  ];
  // 先收集: 类型 -> [游戏]
  const byType = {};
  window.content.levels.forEach(lv => {
    const tl = getTermLevel(lv.id);
    if (!tl) return;
    (tl.warmups || []).forEach(w => {
      const t = w.type || 'memory';
      if (!byType[t]) byType[t] = [];
      byType[t].push({ lvId: lv.id, w: w });
    });
    if (tl.bonus) {
      const t='memory';
      if (!byType['__bonus']) byType['__bonus'] = [];
      byType['__bonus'].push({ lvId: lv.id, bonus: true });
    }
  });
  let html = '';
  // 遍历固定类型顺序（未列出的类型放最后）
  const ordered = TYPE_ORDER.map(x=>x[0]).filter(t=>byType[t]);
  const rest = Object.keys(byType).filter(t=>t!=='__bonus' && !ordered.includes(t)).sort();
  const allTypes = ordered.concat(rest);
  allTypes.forEach(t => {
    const items = byType[t] || [];
    const label = (TYPE_ORDER.find(x=>x[0]===t) || [t, gzEmoji(byType[t]&&byType[t][0]?byType[t][0].w:{}), t])[2];
    const emoji = (TYPE_ORDER.find(x=>x[0]===t) || [t,'🎮',t])[1];
    const rows = [];
    items.forEach(it => {
      const idx = window.gzList.length;
      window.gzList.push(it);
      if (it.bonus) {
        const lvDone = window.levelProgress(it.lvId).completed;
        rows.push('<div class="gz-row' + (lvDone ? '' : ' locked') + '" data-idx="' + idx + '" onclick="gzPlay(' + idx + ')">' +
          '<span class="gz-emoji">' + (lvDone ? '🏆' : '🔒') + '</span>' +
          '<span class="gz-name">记忆大师挑战 · 5 层递进</span>' +
          '<span class="gz-meta">第'+it.lvId+'幕 · ' + (lvDone ? '可玩' : '通关本关解锁') + '</span></div>');
        return;
      }
      const w = it.w;
      const unlocked = isUnlocked(w);
      const advTag = w.advanced ? ' · <span style="color:var(--cyan)">进阶</span>' : '';
      const tBadge = window.miniTierBadge(w.id);
      rows.push('<div class="gz-row' + (unlocked ? '' : ' locked') + (w.advanced ? ' pc-only' : '') + '" data-idx="' + idx + '" onclick="gzPlay(' + idx + ')">' +
        '<span class="gz-emoji">' + (unlocked ? gzEmoji(w) : '🔒') + '</span>' +
        '<span class="gz-name">' + gzName(w) + tBadge + '</span>' +
        '<span class="gz-meta">第'+it.lvId+'幕' + advTag + ' · ' + (unlocked ? (w._tier>=1?'可挑战':'可玩') : '未解锁') + '</span></div>');
    });
    if (!rows.length) return;
    html += '<div class="gz-section">' + emoji + ' ' + label + ' <span class="sec-count">' + rows.length + '</span></div>' + rows.join('');
  });
  // 记忆大师挑战统一放最后
  if (byType['__bonus']) {
    const rows=[];
    byType['__bonus'].forEach(it=>{
      const idx = window.gzList.length; window.gzList.push(it);
      const lvDone = window.levelProgress(it.lvId).completed;
      rows.push('<div class="gz-row' + (lvDone ? '' : ' locked') + '" data-idx="' + idx + '" onclick="gzPlay(' + idx + ')">' +
        '<span class="gz-emoji">' + (lvDone ? '🏆' : '🔒') + '</span>' +
        '<span class="gz-name">记忆大师挑战 · 5 层递进</span>' +
        '<span class="gz-meta">第'+it.lvId+'幕 · ' + (lvDone ? '可玩' : '通关本关解锁') + '</span></div>');
    });
    if (rows.length) html += '<div class="gz-section">🏆 记忆大师挑战 <span class="sec-count">'+rows.length+'</span></div>' + rows.join('');
  }
  body.innerHTML = html || '<div class="lb-empty">还没有可玩的小游戏，先去闯关吧！</div>';
}

export function gzPlay(idx) {
  const it = window.gzList[idx];
  if (!it) return;
  if (it.bonus) {
    const tl = getTermLevel(it.lvId);
    if (!tl || !tl.bonus) return;
    if (!window.levelProgress(it.lvId).completed) { window.showToast('通关本关后才能挑战记忆大师', 'error'); return; }
    window.openMemoryMatch(tl.bonus, (win)=>{ gzAfter(win,'🏆 记忆大师完成！'); });
    return;
  }
  const w = it.w;
  if (!isUnlocked(w)) {
    window.showToast('先完成对应任务解锁这个小游戏', 'error'); return;
  }
  // 词库型游戏：打乱词库顺序，让每次玩的词汇子集不同（游戏按 size 取前 N 对）
  if (w.pairsFrom && Array.isArray(w.pairs) && w.pairs.length > 1) {
    for (let i=w.pairs.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const _t=w.pairs[i]; w.pairs[i]=w.pairs[j]; w.pairs[j]=_t; }
  }
  const t = w.type || 'memory';
  if (t==='quick') window.openQuickMatch(w, (win)=>{ gzAfter(win,'⚡ 快打完成'); });
  else if (t==='match') window.openMatchGame(w, (win)=>{ gzAfter(win,'🔗 连线完成'); });
  else if (t==='storm') window.openStormDefense(w, (win)=>{ gzAfter(win,'🌪️ 数据风暴守住了'); });
  else if (t==='alarm') window.openAlarmRush(w, (win)=>{ gzAfter(win,'🚨 产线守住了'); });
  else if (t==='typing') window.openTypingDefense(w, (win)=>{ gzAfter(win,'🔫 术语防线守住了'); });
  else if (t==='shooter') window.openShooter(w, (win)=>{ gzAfter(win,'🛸 数据蜂群清空！'); });
  else if (t==='racing') window.openDataRacing(w, (win)=>{ gzAfter(win,'🏎️ 数据狂飙通关！'); });
  else if (t==='snake') window.openSnake(w, (win)=>{ gzAfter(win,'🐍 网线畅通！'); });
  else if (t==='flappy') window.openFlappy(w, (win)=>{ gzAfter(win,'🦅 云端到达！'); });
  else if (t==='mole') window.openMole(w, (win)=>{ gzAfter(win,'🔨 异常全清！'); });
  else if (t==='pacman') window.openPacman(w, (win)=>{ gzAfter(win,'👾 镜像吃光！'); });
  else if (t==='tank') window.openTank(w, (win)=>{ gzAfter(win,'🎯 Broker 保住了！'); });
  else if (t==='breakout') window.openBreakout(w, (win)=>{ gzAfter(win,'🧱 故障全消！'); });
  else if (t==='sorter') window.openSorter(w, (win)=>{ gzAfter(win,'📦 全部归位！'); });
  else if (t==='forge') window.openForge(w, (win)=>{ gzAfter(win,'🔥 合成成功！'); });
  else if (t==='ll') window.openLianLian(w, (win)=>{ gzAfter(win,'🔗 全部配对！'); });
  else if (t==='pipe') window.openPipe(w, (win)=>{ gzAfter(win,'🔧 数据通路接通！'); });
  else if (t==='m3') window.openMatch3(w, (win)=>{ gzAfter(win,'🍬 三连清场！'); });
  else if (t==='td') window.openTowerDefense(w, (win)=>{ gzAfter(win,'🛡️ 车间防线守住！'); });
  else if (t==='t48') window.openTile2048(w, (win)=>{ gzAfter(win,'🔢 合成'+ (w.target||'TB') +'！'); });
  else if (t==='maze') window.openMaze(w, (win)=>{ gzAfter(win,'🌐 数据包送达！'); });
  else if (t==='hack') window.openHacknet(w, (win)=>{ gzAfter(win,'🕹️ 全网络拿下！'); });
  else if (t==='tyc') window.openTycoon(w, (win)=>{ gzAfter(win,'🏭 产值达标！'); });
  else if (t==='lzr') window.openLaser(w, (win)=>{ gzAfter(win,'🔦 光束连通！'); });
  else if (t==='boss') window.openBoss(w, (win)=>{ gzAfter(win,'🎯 故障砸掉了！'); });
  else window.openMemoryMatch(w, (win)=>{ gzAfter(win,'🧠 翻牌完成'); });
}

export function refreshGameZone() {
  // 过关后立即重绘游戏专区列表，让「✓ 已通关/∞ 无限战」标记即时出现，无需刷新
  const ov = document.getElementById('gzOverlay');
  const body = document.getElementById('gzBody');
  if (ov && body && ov.classList.contains('show')) {
    renderGameZone(body);
  }
}

export function gzAfter(win, msg) {
  if (win) window.showToast(msg, 'success');
  refreshGameZone();
  try {
    // 关卡页里嵌的小游戏行（复习翻牌等）也要即时更新「已通关」标记
    if (typeof window.renderMission === 'function' && document.getElementById('taskList')) window.renderMission();
  } catch (e) {}
}

export function buildGameZone() {
  if (document.getElementById('gzOverlay')) return;
  const ov = document.createElement('div');
  ov.className = 'gz-overlay';
  ov.id = 'gzOverlay';
  ov.innerHTML = `
    <div class="gz-box">
      <div class="pd-head">
        <div><div class="pd-title">🎮 游戏专区</div><div class="pd-sub">解锁后直接来玩，通关的也能反复刷分</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          <button class="mm-btn" onclick="closeGameZone()" style="font-size:12px;padding:6px 12px">🗺️ 返回厂区地图</button>
          <div class="pd-close" onclick="closeGameZone()">✕</div>
        </div>
      </div>
      <div class="pd-body" id="gzBody"></div>
    </div>`;
  document.body.appendChild(ov);
}

export function openGameZone() {
  buildGameZone();
  renderGameZone(document.getElementById('gzBody'));
  document.getElementById('gzOverlay').classList.add('show');
}

export function closeGameZone() {
  // 地图流程：关闭=回厂区地图，避免露出旧版页面
  if (window._mapFlowFeature) { window.goMap(); return; }
  const ov = document.getElementById('gzOverlay');
  if (ov) ov.classList.remove('show');
}
