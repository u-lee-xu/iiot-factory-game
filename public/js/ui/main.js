// ═══════════════════════════════════════════════════════════════════
// ui/main.js — main 模块（拆自 app.js）
// import core/*；其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { escHtml, starStr, taskKey, taskXP } from '../core/utils.js';
import { playSound } from '../core/sound.js';

export function renderFactory() {
  if (!window.content) return;
  const container = document.getElementById('factoryContainer');
  container.innerHTML = '';

  window.content.factory.rows.forEach((row, ri) => {
    // area row
    const rowDiv = document.createElement('div');
    rowDiv.className = 'factory-row';
    row.areas.forEach(areaKey => {
      const lv = window.content.levels.find(l => l.factoryArea === areaKey);
      if (!lv) return;
      const prog = levelProgress(lv.id);
      const prevLv = window.content.levels.find(l => l.id === lv.id - 1);
      const canAccess = lv.id === 1 || (prevLv && levelProgress(prevLv.id).completed);
      let cls = 'area locked';
      if (prog.completed) cls = 'area completed';
      else if (canAccess) cls = 'area active';
      if (lv.id === window.currentLevelId) cls += ' current';

      const div = document.createElement('div');
      div.className = cls;
      div.style.setProperty('--color', lv.color || '#00bcd4');
      div.onclick = () => selectLevel(lv.id);
      div.innerHTML = `
        <span class="lock-icon">${canAccess || prog.completed ? '' : '🔒'}</span>
        <span class="icon">${lv.areaIcon}</span>
        <span class="a-name">${lv.areaName}</span>
        <span class="a-stars">${starStr(areaStars(lv.id))}</span>
      `;
      rowDiv.appendChild(div);
    });
    container.appendChild(rowDiv);

    // pipe row (between factory rows)
    if (ri < window.content.factory.rows.length - 1) {
      const pipeDiv = document.createElement('div');
      pipeDiv.className = 'pipe-row';
      for (let i = 0; i < 4; i++) {
        const cell = document.createElement('div');
        cell.className = 'pipe-cell';
        const a1 = row.areas[i];
        const a2 = window.content.factory.rows[ri + 1].areas[i];
        const lv1 = window.content.levels.find(l => l.factoryArea === a1);
        const done = lv1 && levelProgress(lv1.id).completed;
        cell.innerHTML = `<div class="h-line ${done ? 'done' : ''}"></div><div class="v-line ${done ? 'done' : ''}"></div><div class="arrow ${done ? 'done' : ''}"></div>`;
        pipeDiv.appendChild(cell);
      }
      container.appendChild(pipeDiv);
    }
  });
}

export function selectLevel(lvId, skipIntro) {
  const lv = window.content.levels.find(l => l.id === lvId);
  if (!lv) return;
  window.currentLevelId = lvId;
  window.setArea(lvId); window.playAreaMusic();
  const renderAll = () => { renderFactory(); renderMission(); renderHeader(); };
  // 直接从厂区地图进入某个任务时跳过“幕intro”（任务前言会单独讲解），
  // 避免与蓝色任务前言两个弹窗叠加；进入关卡本身仍保留幕intro
  if (skipIntro) { renderAll(); return; }
  // 幕intro 也排进登录弹窗队列，保证全局一次只弹一个（不与成就/欢迎/前言叠加）
  enqueueLoginPopup(done => showLevelIntro(lv, () => { renderAll(); done(); }));
}

export function renderMission() {
  const lv = window.content.levels.find(l => l.id === window.currentLevelId);
  if (!lv) return;

  const title = document.getElementById('missionTitle');
  title.innerHTML = `<span class="lv-tag">L${lv.id}</span> ${lv.name}`;

  const story = document.getElementById('missionStory');
  const prog = levelProgress(lv.id);
  if (!prog.completed) {
    story.style.display = 'block';
    story.textContent = lv.narrative.intro;
    story.style.borderLeftColor = lv.color || '#00bcd4';
    story.style.setProperty('--color', lv.color || '#00bcd4');
  } else if (lv.narrative.complete) {
    story.style.display = 'block';
    story.textContent = '✅ ' + lv.narrative.complete;
    story.style.borderLeftColor = 'var(--green)';
    
    // Check if just completed (was not completed before this render)
    const wasCompleted = sessionStorage.getItem('levelCompleteShown_' + lv.id) === 'true';
    if (!wasCompleted) {
      sessionStorage.setItem('levelCompleteShown_' + lv.id, 'true');
      window.pendingLevelComplete = lv;
    }
  } else {
    story.style.display = 'none';
  }

  document.getElementById('taskProgress').textContent = `进度 ${prog.done}/${prog.total}`;

  const list = document.getElementById('taskList');
  list.innerHTML = '';
  // 构建"块最后一个任务 -> 复习翻牌"映射
  const tl = getTermLevel(lv.id);
  const reviewAfter = {};
  if (tl) tl.warmups.forEach(w => {
    const last = w.blockTasks[w.blockTasks.length - 1];
    if (last) {
      if (!reviewAfter[last]) reviewAfter[last] = [];
      reviewAfter[last].push(w);
    }
  });
  lv.tasks.forEach(t => {
    const done = isTaskDone(t.id);
    const _ck = window.gameState.check[taskKey(t.id)];
    const isHalf = done && _ck && _ck.half;
    const li = document.createElement('li');
    li.className = 'task-item' + (done ? ' done' : '') + (t.auto ? ' auto' : '') + (t.hidden ? ' hidden' : '');
    li.innerHTML = `
      <span class="cb">${done ? '✓' : ''}</span>
      <span class="task-title">${t.title}</span>
      <span class="task-xp">${taskXP(t) > 0 ? '+' + taskXP(t) + 'XP' : ''}</span>
      ${isHalf ? '<span class="task-half" title="经验减半，点任务可重刷拿满分">⚡</span>' : ''}
      ${done ? '<span class="task-ops"><span class="task-redo" title="重做本关拿满分">↻</span><span class="task-undo" title="撤销完成">✕</span></span>' : ''}
      <div class="task-tags">${(t.tags || []).map(tagId => {
        const tag = window.KNOWLEDGE_TAGS?.[tagId];
        return tag ? `<span class="task-tag category-${tag.category}">${tag.label}</span>` : '';
      }).join('')}</div>
    `;
    if (!t.auto) {
      li.onclick = () => {
        if (t.hidden && !done) {
          // check if all non-hidden tasks are done
          const nonHidden = lv.tasks.filter(x => !x.hidden);
          const allDone = nonHidden.every(x => isTaskDone(x.id));
          if (!allDone) { window.showToast('先完成所有普通任务再挑战隐藏', 'info'); return; }
        }
        // 已完成的任务点击 = 重做（重刷拿满分），未完成 = 直接做
        openTaskModal(window.currentLevelId, t.id);
      };
      const redo = li.querySelector('.task-redo');
      if (redo) redo.onclick = (e) => { e.stopPropagation(); openTaskModal(window.currentLevelId, t.id); };
      const undo = li.querySelector('.task-undo');
      if (undo) undo.onclick = (e) => { e.stopPropagation(); toggleTask(t.id); };
    }
    list.appendChild(li);
    // 块最后一个任务后，紧跟一行对应的复习翻牌
    if (reviewAfter[t.id]) {
      reviewAfter[t.id].forEach(w => {
      const unlocked = w.blockTasks.every(tid => isTaskDone(tid));
      const wType = w.type || 'memory';
      const isQuick = wType === 'quick';
      const isMatch = wType === 'match';
      const isStorm = wType === 'storm';
      const isAlarm = wType === 'alarm';
      const isTyping = wType === 'typing';
      const isShooter = wType === 'shooter';
      const isRacing = wType === 'racing';
      const isSnake = wType === 'snake', isFlappy = wType === 'flappy', isMole = wType === 'mole';
      const isPacman = wType === 'pacman', isTank = wType === 'tank', isBreakout = wType === 'breakout';
      const isSorter = wType === 'sorter';
      const isForge = wType === 'forge';
      const isLl = wType === 'll';
      const isPipe = wType === 'pipe';
      const isM3 = wType === 'm3';
      const isTd = wType === 'td';
      const isT48 = wType === 't48';
      const isMaze = wType === 'maze';
      const isHack = wType === 'hack';
      const isTyc = wType === 'tyc';
      const isLzr = wType === 'lzr';
      const isBossS = wType === 'boss';
      const row = document.createElement('li');
      row.className = 'review-inline' + (unlocked ? ' unlocked' : ' locked') + (isTyping ? ' ty-only-desktop' : '') + (isShooter && w.advanced ? ' pc-only' : '');
      const _emoji = isQuick ? '⚡' : isMatch ? '🔗' : isStorm ? '🌪️' : isAlarm ? '🚨' : isTyping ? '🔫' : isShooter ? '🛸' : isRacing ? '🏎️' : isSnake ? '🐍' : isFlappy ? '🦅' : isMole ? '🔨' : isPacman ? '👾' : isTank ? '🎯' : isBreakout ? '🧱' : isSorter ? '📦' : isForge ? '🔥' : isLl ? '🔗' : isPipe ? '🔧' : isM3 ? '🍬' : isTd ? '🛡️' : isT48 ? '🔢' : isMaze ? '🌐' : isHack ? '🕹️' : isTyc ? '🏭' : isLzr ? '🔦' : isBossS ? '🎯' : '🃏';
      const _special = isQuick || isMatch || isStorm || isAlarm || isTyping || isShooter || isRacing || isSnake || isFlappy || isMole || isPacman || isTank || isBreakout || isSorter || isForge || isLl || isPipe || isM3 || isTd || isT48 || isMaze || isHack || isTyc || isLzr || isBossS;
      const _name = _special ? escHtml(w.name) : '翻牌 · ' + escHtml(w.name);
      let _meta;
      if (isQuick) _meta = w.size + ' 题';
      else if (isMatch) _meta = w.size + ' 组';
      else if (isStorm) _meta = (w.waves || 0) + ' 波';
      else if (isAlarm) _meta = (w.devices || 0) + ' 台';
      else if (isTyping) _meta = (w.words ? w.words.length : 0) + ' 词';
      else if (isShooter) _meta = (w.waves || 4) + ' 波编队' + (w.advanced ? ' · 进阶' : '');
      else if (isRacing) _meta = '坚持 45s 通关';
      else if (isSnake) _meta = '吃网络三件套';
      else if (isFlappy) _meta = '躲断线黑洞';
      else if (isMole) _meta = '点掉异常数据';
      else if (isPacman) _meta = '吃镜像层';
      else if (isTank) _meta = '守卫 Broker';
      else if (isBreakout) _meta = '消设备故障';
      else if (isSorter) _meta = (w.waves || 3) + ' 波分类';
      else if (isForge) _meta = '合成' + (w.target||'TB');
      else if (isLl) _meta = (w.pairs||[]).length + ' 组配对';
      else if (isPipe) _meta = (w.cols||4) + '×' + (w.rows||4) + ' 管道';
      else if (isM3) _meta = (w.waves||3) + ' 波消消乐';
      else if (isTd) _meta = (w.waves||3) + ' 波防线';
      else if (isT48) _meta = '合成' + (w.target||'TB');
      else if (isMaze) _meta = '迷宫寻路';
      else if (isHack) _meta = (w.nodes||[]).length + ' 个节点';
      else if (isTyc) _meta = '目标' + (w.target||50000);
      else if (isLzr) _meta = '光束路由';
      else if (isBossS) _meta = (w.shots||5) + ' 发';
      else if (w.rounds) _meta = w.rounds.map(function(r){return r * 2;}).join('→') + ' 张';
      else _meta = (w.size * 2) + ' 张';
      row.innerHTML = '<span class="ri-emoji">' + (unlocked ? _emoji : '🔒') + '</span><span class="ri-name">' + _name + miniTierBadge(w.id) + '</span><span class="ri-meta">' + _meta + ' · ' + (unlocked ? '可玩' : '完成本块任务解锁') + '</span>';
      row.onclick = () => {
        if (!unlocked) { window.showToast('还没有解锁，先完成对应任务', 'error'); return; }
        if (isQuick) openQuickMatch(w, (win)=>{ gzAfter(win,'⚡ 快打完成'); });
        else if (isMatch) openMatchGame(w, (win)=>{ gzAfter(win,'🔗 连线完成'); });
        else if (isStorm) openStormDefense(w, (win)=>{ gzAfter(win,'🌪️ 数据风暴守住了'); });
        else if (isAlarm) openAlarmRush(w, (win)=>{ gzAfter(win,'🚨 产线守住了'); });
        else if (isTyping) openTypingDefense(w, (win)=>{ gzAfter(win,'🔫 术语防线守住了'); });
        else if (isShooter) openShooter(w, (win)=>{ gzAfter(win,'🛸 数据蜂群清空！'); });
        else if (isRacing) openDataRacing(w, (win)=>{ gzAfter(win,'🏎️ 数据狂飙通关！'); });
        else if (isSnake) openSnake(w, (win)=>{ gzAfter(win,'🐍 网线畅通！'); });
        else if (isFlappy) openFlappy(w, (win)=>{ gzAfter(win,'🦅 云端到达！'); });
        else if (isMole) openMole(w, (win)=>{ gzAfter(win,'🔨 异常全清！'); });
        else if (isPacman) openPacman(w, (win)=>{ gzAfter(win,'👾 镜像吃光！'); });
        else if (isTank) openTank(w, (win)=>{ gzAfter(win,'🎯 Broker 保住了！'); });
        else if (isBreakout) openBreakout(w, (win)=>{ gzAfter(win,'🧱 故障全消！'); });
        else if (isSorter) openSorter(w, (win)=>{ gzAfter(win,'📦 全部归位！'); });
        else if (isForge) openForge(w, (win)=>{ gzAfter(win,'🔥 合成成功！'); });
        else if (isLl) openLianLian(w, (win)=>{ gzAfter(win,'🔗 全部配对！'); });
        else if (isPipe) openPipe(w, (win)=>{ gzAfter(win,'🔧 数据通路接通！'); });
        else if (isM3) openMatch3(w, (win)=>{ gzAfter(win,'🍬 三连清场！'); });
        else if (isTd) openTowerDefense(w, (win)=>{ gzAfter(win,'🛡️ 车间防线守住！'); });
        else if (isT48) openTile2048(w, (win)=>{ gzAfter(win,'🔢 合成'+ (w.target||'TB') +'！'); });
        else if (isMaze) openMaze(w, (win)=>{ gzAfter(win,'🌐 数据包送达！'); });
        else if (isHack) openHacknet(w, (win)=>{ gzAfter(win,'🕹️ 全网络拿下！'); });
        else if (isTyc) openTycoon(w, (win)=>{ gzAfter(win,'🏭 产值达标！'); });
        else if (isLzr) openLaser(w, (win)=>{ gzAfter(win,'🔦 光束连通！'); });
        else if (isBossS) openBoss(w, (win)=>{ gzAfter(win,'🎯 故障砸掉了！'); });
        else openMemoryMatch(w, (win)=>{ gzAfter(win,'🧠 翻牌完成'); });
      };
      list.appendChild(row);
      });
    }
  });
  // 番外：记忆大师挑战（本关通关后解锁，放在列表最后）
  if (tl && tl.bonus) {
    const lvDone = levelProgress(lv.id).completed;
    const row = document.createElement('li');
    row.className = 'review-inline review-bonus' + (lvDone ? ' unlocked' : ' locked');
    row.innerHTML = '<span class="ri-emoji">' + (lvDone ? '🏆' : '🔒') + '</span><span class="ri-name">记忆大师挑战 · 5 层递进</span><span class="ri-meta">' + (lvDone ? '可玩' : '通关本关解锁') + '</span>';
    row.onclick = () => {
      if (!lvDone) { window.showToast('通关本关后才能挑战记忆大师', 'error'); return; }
      openMemoryMatch(tl.bonus, (win)=>{ gzAfter(win,'🏆 记忆大师完成！'); });
    };
    list.appendChild(row);
  }
}

export function openTaskModal(lvId, taskId, onOpen) {
  const lv = window.content.levels.find(l => l.id === lvId);
  if (!lv) return;
  const task = lv.tasks.find(t => t.id === taskId);
  if (!task) return;

  window.currentTaskId = taskId;

  // 任务主题色（用于全屏任务页背景光晕）
  const _overlay = document.getElementById('modalOverlay');
  const _taskColor = lv.color || '#00bcd4';
  _overlay.style.setProperty('--task-color', _taskColor);
  try {
    const _rgb = [parseInt(_taskColor.slice(1,3),16), parseInt(_taskColor.slice(3,5),16), parseInt(_taskColor.slice(5,7),16)];
    _overlay.style.setProperty('--task-rgb', _rgb.join(','));
  } catch(e){}
  const _subEl = document.getElementById('modalSub');
  if (_subEl) _subEl.textContent = (lv.areaName||'') + (lv.name ? ' · '+lv.name : '');

  // Show task preface dialogue first, then open modal with interaction
  window.showTaskPreface(task, () => {
    const overlay = document.getElementById('modalOverlay');
    overlay.style.display = '';
    overlay.classList.remove('show');
    document.getElementById('modalTitle').textContent = task.title;
    const body = document.getElementById('modalBody');
    body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--dim)">加载中…</div>';
    document.getElementById('modalFoot').innerHTML = '';
    overlay.classList.add('show');

    // 如果该类型自带讲解则直接委托渲染
    if (window.selfTeachTypes.indexOf(task.type) >= 0) {
      const handler = getInteraction(task.type);
      if (handler) {
        handler.render(body, task);
      }
    } else {
      // 通用模式：直接渲染交互（教学已在前置弹窗完成）
      const handler = getInteraction(task.type);
      if (!handler) {
        body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--dim)">⚠️ 未知任务类型: ' + task.type + '</div>';
        if (typeof onOpen === 'function') onOpen();
        return;
      }
      handler.render(body, task);
    }
    // 任务道具（商城买的：提示卡 / 免错金牌）
    window.__passActive = false;
    addTaskItemBar(task);
    if (typeof onOpen === 'function') onOpen();
  });
}

export function closeModal() {
  const el = document.getElementById('modalOverlay');
  if (!el) return;
  el.classList.remove('show');
  window.currentTaskId = null;
  window.playAreaMusic();
}

export function closeTaskModal(){
  closeModal();
  if (sessionStorage.getItem('mapFlow') === '1') { window.goMap(); }
}

export function findTaskAnswer(task) {
  var cfg = task.config || {}, parts = [];
  if (cfg.command) parts.push('命令：' + (Array.isArray(cfg.command) ? cfg.command.join(' 或 ') : cfg.command));
  function pick(opts, ans){
    var idxs = (ans === undefined) ? [] : (Array.isArray(ans) ? ans : [ans]);
    idxs.forEach(function(i){ var o = opts[Number(i)]; if (o === undefined) return; parts.push(typeof o === 'string' ? o : (o.text || o.label || '')); });
  }
  function pickCorrect(opts){ opts.forEach(function(o){ if (o && typeof o === 'object' && o.correct) parts.push((o.label ? o.label + '：' : '') + (o.text || '')); }); }
  if (Array.isArray(cfg.options)) {
    if (cfg.answer !== undefined) pick(cfg.options, cfg.answer);
    else pickCorrect(cfg.options);
  }
  if (Array.isArray(cfg.questions)) cfg.questions.forEach(function(q){
    var opts = q.options || [];
    if (q.answer !== undefined || q.answers !== undefined) pick(opts, q.answer !== undefined ? q.answer : q.answers);
    else pickCorrect(opts);
  });
  if (cfg.answer !== undefined && !Array.isArray(cfg.options)) parts.push('答案：' + (Array.isArray(cfg.answer) ? cfg.answer.join(' / ') : cfg.answer));
  if (cfg.answers !== undefined) parts.push('答案：' + (Array.isArray(cfg.answers) ? cfg.answers.join(' / ') : cfg.answers));
  if (Array.isArray(cfg.steps)) cfg.steps.forEach(function(st){
    var opts = st.options || [];
    if (st.answer !== undefined || st.correctNumber) pick(opts, st.answer !== undefined ? st.answer : st.correctNumber);
    else pickCorrect(opts);
    if (st.correctNumber && !Array.isArray(opts)) parts.push(st.title + '：' + st.correctNumber.join(' / '));
  });
  return parts.filter(Boolean).join('\n');
}

export function showTaskHintPopup(msg) {
  var ov = document.createElement('div');
  ov.className = 'mm-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9600;display:flex;align-items:center;justify-content:center';
  ov.innerHTML = '<div class="mm-box" style="width:min(480px,92vw);max-height:80vh"><div class="mm-head"><div><div class="mm-title">📝 提示卡</div><div class="mm-sub">厂长再讲一遍，别急</div></div><div class="mm-close" onclick="__closeOverlay(this)">✕</div></div><div class="pd-body" style="white-space:pre-wrap;font-size:14px;line-height:1.7;color:var(--text)">' + escHtml(msg) + '</div><div style="text-align:center;padding:14px"><button class="mm-btn primary" onclick="__closeOverlay(this)">知道了</button></div></div>';
  document.body.appendChild(ov);
}

export function useTaskHint(task) {
  var inv = window.gameState.inventory || {};
  if (!(inv['hint_card'] > 0)) return;
  api('/api/student/consume-item', { method:'POST', body:JSON.stringify({itemId:'hint_card'}) }).then(function(r){
    if (r && r.ok) {
      window.gameState.inventory['hint_card']--; if (window.gameState.inventory['hint_card'] <= 0) delete window.gameState.inventory['hint_card'];
      renderHeader();
      var ans = findTaskAnswer(task);
      var teach = generateTeach(task) || '厂长：再想想，答案在任务标题和提示里。';
      showTaskHintPopup(teach + (ans ? '\n\n✅ 答案参考：\n' + ans : ''));
      var btn = document.getElementById('taskHintBtn'); if (btn) { btn.style.opacity = '.4'; btn.disabled = true; }
    } else window.showToast((r && r.error) || '使用失败', 'error');
  });
}

export function useTaskPass() {
  var inv = window.gameState.inventory || {};
  if (!(inv['pass_card'] > 0)) return;
  api('/api/student/consume-item', { method:'POST', body:JSON.stringify({itemId:'pass_card'}) }).then(function(r){
    if (r && r.ok) {
      window.gameState.inventory['pass_card']--; if (window.gameState.inventory['pass_card'] <= 0) delete window.gameState.inventory['pass_card'];
      renderHeader();
      window.__passActive = true;
      var btn = document.getElementById('taskPassBtn'); if (btn) { btn.style.opacity = '.4'; btn.disabled = true; }
      window.showToast('🛡 免错金牌已启用：本关答错也拿满经验', 'success');
    } else window.showToast((r && r.error) || '使用失败', 'error');
  });
}

export function addTaskItemBar(task) {
  var inv = window.gameState.inventory || {};
  var hasHint = (inv['hint_card'] || 0) > 0;
  var hasPass = (inv['pass_card'] || 0) > 0;
  if (!hasHint && !hasPass) return;
  var foot = document.getElementById('modalFoot');
  if (!foot) return;
  var bar = document.createElement('div');
  bar.style.cssText = 'margin-top:10px;display:flex;gap:8px;flex-wrap:wrap';
  if (hasHint) bar.innerHTML += '<button class="btn" id="taskHintBtn" title="消耗1张：显示答案参考">📝 提示卡×' + inv['hint_card'] + '</button>';
  if (hasPass) bar.innerHTML += '<button class="btn" id="taskPassBtn" title="本关答错也按满经验结算">🛡 免错金牌×' + inv['pass_card'] + '</button>';
  foot.appendChild(bar);
  if (hasHint) document.getElementById('taskHintBtn').onclick = function(){ useTaskHint(task); };
  if (hasPass) document.getElementById('taskPassBtn').onclick = function(){ useTaskPass(); };
}

export function completeTask(taskId, xp) {
  try {
    // 经验减半：命令猜错多次时 xp 低于满值，存 half 标记（影响实际总分，可重刷拿满分）
    const tFull = (window.content.levels.find(l => l.tasks.some(t => t.id === taskId)) || {}).tasks;
    const tFullXp = tFull ? taskXP(tFull.find(t => t.id === taskId)) : xp;
    if (window.__passActive && xp < tFullXp) { window.__passActive = false; xp = tFullXp; }   // 免错金牌：答错也拿满经验
    if (xp < tFullXp) window.gameState.check[taskId] = { half: true };
    else window.gameState.check[taskId] = true;
    closeModal();
    renderFactory();
    renderMission();
    renderHeader();
    window.showToast('+' + xp + 'XP', 'success');
    checkLevelUp();
    saveState();
    evaluateAchievements(true);
    refreshLeaderboard().then(() => evaluateAchievements(true));
    // 记录最近完成的任务（回厂区地图弹庆祝 toast）
    try {
      const _lv = window.content.levels.find(l => l.tasks.some(t => t.id === taskId));
      const _t = _lv && _lv.tasks.find(t => t.id === taskId);
      sessionStorage.setItem('lastCompleted', JSON.stringify({ title: (_t&&_t.title)||'', xp }));
    } catch(e){}
    // 地图流程：本层全部打完 → 弹通关庆祝；整层未完 → 完成后自动回房间/厂区，
    // 避免停在 body.map-flow 隐藏旧版页后只剩空壳的"空白界面"
    if (sessionStorage.getItem('mapFlow') === '1') {
      const lv = window.content.levels.find(l => l.tasks.some(t => t.id === taskId));
      if (lv && levelProgress(lv.id).completed) {
        showLevelComplete(lv, null);
      } else {
        // 点击领取后立即显示"正在返回"过渡，盖住弹窗关闭后露出的空白任务页壳子，
        // 再延迟 goMap（XP toast 仍可见，且过渡期间不闪空白）
        var _t = document.getElementById('transit');
        if (_t) { var _e = document.getElementById('trText'); if (_e) _e.innerHTML = '正在返回 <b>房间</b>…'; _t.classList.add('show'); }
        setTimeout(function(){ window.goMap(); }, 900);
      }
    }
  } catch (e) {
    console.error('completeTask error:', e);
    window.showToast('保存失败，请重试', 'error');
  }
}

export function toggleTask(taskId) {
  delete window.gameState.check[taskId];
  renderFactory();
  renderMission();
  renderHeader();
  saveState();
}

export function renderTypeTerminal(container, task, cfg) {
  let attempts = 0;
  let streak = 0;          // 连续正确次数
  let errors = 0;          // 连续错误次数
  let hintUsed = false;    // 是否用过提示
  const hints = cfg.hints || ['再试一次，看看任务标题', '命令格式错了，检查空格和参数', '正确答案: ' + cfg.command];
  const cmdHistory = [];
  let historyIdx = -1;

  const bootMsgs = [
    '[    BIOS] 正在启动系统自检…',
    '[      OK] CPU: 4核 Intel Xeon @ 2.4GHz',
    '[      OK] 内存: 8192MB 已检测',
    '[  NETDEV] 正在初始化网络接口…',
    '[      OK] ens33: 链路已建立 (192.168.1.100)',
    '[  SYSTEM] 锐智工控系统 v3.2 准备就绪',
    ''
  ];

  const teachText = generateTeach(task);

  container.innerHTML = `
    <div id="termTeachArea"></div>
    <div class="term-root" id="termRoot" style="display:none">
      <div class="term-header">
        <span class="term-dots"><span class="term-dot red"></span><span class="term-dot yellow"></span><span class="term-dot green"></span></span>
        <span>锐智终端 v2.0</span>
        <span id="termStatus">就绪</span>
      </div>
      <div class="term-task-title" id="termTaskTitle">${escHtml(cfg.prompt || '输入命令完成任务')}</div>
      <div class="term-body" id="termBody">
        <div class="term-line term-info" id="bootMsgs"></div>
        <div id="termHistory"></div>
        <div class="term-line" id="termCursorLine"><span class="term-prompt">root@锐智:~$ </span><span class="term-cursor-blink"></span></div>
      </div>
      <div class="term-input-row" id="termInputRow" style="display:none">
        <span class="prompt">root@锐智:~$</span>
        <input type="text" id="termInput" spellcheck="false" autocomplete="off" placeholder="输入命令">
      </div>
    </div>
    <div style="font-size: 14px;color:var(--dim);margin-top:6px" id="termHint"></div>
  `;

  const teachArea = document.getElementById('termTeachArea');
  document.getElementById('modalFoot').innerHTML = `
    <button class="btn" onclick="closeModal()">取消</button>
  `;
  // 初始 mood：首次进关卡 -> thinking
  const initialMood = getDirectorMood(task, { firstTime: true });
  addDirectorBox(teachArea, teachText, () => startBoot(), initialMood);

  function startBoot() {
  document.getElementById('termRoot').style.display = 'block';

  const body = document.getElementById('termBody');
  const history = document.getElementById('termHistory');
  const cursorLine = document.getElementById('termCursorLine');
  const input = document.getElementById('termInput');
  const inputRow = document.getElementById('termInputRow');
  const hint = document.getElementById('termHint');
  const bootEl = document.getElementById('bootMsgs');

  // Boot sequence
  playSound('boot');
  let bIdx = 0;
  bootEl.textContent = '';
  function bootTick() {
    if (bIdx < bootMsgs.length) {
      bootEl.textContent += bootMsgs[bIdx] + '\n';
      body.scrollTop = body.scrollHeight;
      bIdx++;
      setTimeout(bootTick, 120);
    } else {
      errors++;
      streak = 0;
      // Boot complete - show prompt as permanent hint
      hint.textContent = cfg.prompt || '输入命令开始…';
      hint.style.color = 'var(--amber)';
      cursorLine.style.display = 'none';
      inputRow.style.display = 'flex';
      input.focus();
    }
  }
  bootTick();

  function appendOutput(html) {
    history.innerHTML += `<div class="term-line">${html}</div>`;
    body.scrollTop = body.scrollHeight;
  }

  function doCheck() {
    const cmd = input.value.trim();
    if (!cmd) return;
    playSound('click');
    attempts++;
    cmdHistory.push(cmd);
    historyIdx = cmdHistory.length;

    // Echo the command
    cursorLine.style.display = 'none';
    appendOutput(`<span class="term-prompt">root@锐智:~$ </span><span class="term-cmd">${cmd.replace(/</g,'&lt;')}</span>`);

    const expected = Array.isArray(cfg.command) ? cfg.command : [cfg.command];
    const match = expected.some(e => cmd.toLowerCase() === e.toLowerCase() || cmd.toLowerCase().replace(/\s+/g,' ') === e.toLowerCase().replace(/\s+/g,' '));

    if (match) {
      streak++;
      errors = 0;
      // Fade in output character by character
      const outputLines = (cfg.output || '命令执行成功').split('\n');
      let lineIdx = 0;
      function showLine() {
        if (lineIdx < outputLines.length) {
          const line = outputLines[lineIdx];
          const cls = line.includes('ping statistics') || line.includes('packets transmitted') || line.includes('OK)')
            ? 'term-success' : 'term-out';
          appendOutput(`<span class="${cls}">${line}</span>`);
          lineIdx++;
          setTimeout(showLine, lineIdx === 1 ? 200 : 60);
        } else {
      errors++;
      streak = 0;
          // Done
          appendOutput('');
          playSound('success');
          input.disabled = true;
          input.style.display = 'none';
          inputRow.style.display = 'none';

          // Show the claim button
          const foot = document.getElementById('modalFoot');
          foot.innerHTML = '';
          const claimBtn = document.createElement('button');
          claimBtn.className = 'btn btn-success';
          claimBtn.textContent = '✓ 领取 XP +' + taskXP(task);
          foot.appendChild(claimBtn);
          claimBtn.addEventListener('click', function(ev) {
            ev.preventDefault();
            completeTask(task.id, taskXP(task));
          });

          window.showToast('命令正确！', 'success');
        }
      }
      showLine();
    } else {
      errors++;
      streak = 0;
      // Check for intermediate commands (same base cmd, wrong args, or --help)
      const baseCmd = cmd.split(' ')[0];
      const expectedBases = expected.map(e => e.split(' ')[0]);
      const isRelated = expectedBases.includes(baseCmd);
      const wantsHelp = cmd.includes('--help') || cmd === baseCmd + ' -h' || cmd === baseCmd + ' --h' || cmd === baseCmd + ' -?';

      if (isRelated && wantsHelp) {
        // Realistic help text by command
        const helpMap = {
          'uname': `用法：uname [选项]...\n显示系统信息。\n\n选项：\n  -a, --all                显示所有信息\n  -s, --kernel-name        显示内核名称\n  -n, --nodename           显示网络节点主机名\n  -r, --kernel-release     显示内核发行版\n  -v, --kernel-version     显示内核版本\n  -m, --machine            显示机器硬件架构\n  -p, --processor          显示处理器类型\n  -i, --hardware-platform  显示硬件平台\n  -o, --operating-system   显示操作系统\n      --help               显示此帮助信息`,
          'ip': `用法：ip [选项] 对象 [命令]\n       ip address {show|add|del} [dev 设备名]\n\n对象：\n  address      网络设备地址\n  link         网络设备\n  route        路由表\n\nip address show 选项：\n  -s, -stats   显示统计信息\n  -4           仅 IPv4\n  -6           仅 IPv6`,
          'ping': `用法：ping [选项] 目标主机\n\n选项：\n  -c <次数>    发送指定次数的报文后停止\n  -i <间隔>    每次发送间隔（秒）\n  -s <大小>    发送的数据包大小\n  -t <TTL>     设置 TTL 值\n  -4           仅使用 IPv4\n  -6           仅使用 IPv6`,
          'traceroute': `用法：traceroute [选项] 目标 [跳数]\n\n选项：\n  -n            不解析域名到 IP\n  -q <查询数>   每跳查询次数\n  -w <超时>     等待响应时间（秒）\n  -4            仅 IPv4\n  -6            仅 IPv6`,
          'nslookup': `用法：nslookup [域名] [DNS服务器]\n\n示例：\n  nslookup www.baidu.com\n  nslookup www.baidu.com 8.8.8.8`,
          'ssh': `用法：ssh [选项] 用户名@主机地址\n\n选项：\n  -p <端口>    指定端口号\n  -i <密钥>    使用指定密钥文件\n  -v           详细模式（调试用）\n\n示例：\n  ssh root@192.168.1.100\n  ssh -p 2222 admin@10.0.0.1`,
          'curl': `用法：curl [选项] URL\n\n选项：\n  -o <文件>    输出到文件\n  -s           静默模式\n  -I           仅显示响应头\n  -H <头>      自定义请求头\n\n示例：\n  curl ifconfig.me\n  curl -I https://baidu.com`,
          'docker': `用法：docker [命令] [选项]\n\n常用命令：\n  run         运行容器\n  ps          查看容器列表\n  stop        停止容器\n  rm          删除容器\n  pull        下载镜像`,
          'mosquitto_sub': `用法：mosquitto_sub [选项]\n\n选项：\n  -h <主机>    Broker 地址\n  -p <端口>    Broker 端口\n  -t <主题>    订阅主题\n  -v          显示消息详情`,
          'mosquitto_pub': `用法：mosquitto_pub [选项]\n\n选项：\n  -h <主机>    Broker 地址\n  -p <端口>    Broker 端口\n  -t <主题>    发布主题\n  -m <消息>    消息内容`,
          'systemctl': `用法：systemctl [命令] [服务名]\n\n常用命令：\n  status       查看服务状态\n  start        启动服务\n  stop         停止服务\n  restart      重启服务\n  enable       设置开机自启\n\n示例：\n  systemctl status edge-service\n  systemctl restart ssh`,
          'ss': `用法：ss [选项]\n\n选项：\n  -t  仅显示 TCP\n  -l  仅显示监听（LISTEN）端口\n  -n  不解析服务名，显示数字端口\n  -p  显示使用该端口的进程\n\n示例：\n  ss -tlnp            列出所有 TCP 监听端口\n  ss -tln | grep 502  只看 502 端口`
        };
        const helpText = helpMap[baseCmd] || `${baseCmd}: 试试 ${expected[0]} 看看效果`;
        // Type out help line by line
        const helpLines = helpText.split('\n');
        let hIdx = 0;
        function showHelpLine() {
          if (hIdx < helpLines.length) {
            const line = helpLines[hIdx];
            const cls = line.startsWith('用法') ? 'term-info' : line.startsWith('  -') ? 'term-success' : 'term-out';
            appendOutput(`<span class="${cls}">${line}</span>`);
            hIdx++;
            setTimeout(showHelpLine, 30);
          } else {
      errors++;
      streak = 0;
            const idx = Math.min(attempts - 1, hints.length - 1);
            hintUsed = true;
            hint.textContent = '💡 ' + hints[idx];
            hint.style.color = 'var(--amber)';
            playSound('click');
            input.value = '';
            input.focus();
          }
        }
        showHelpLine();
      } else if (isRelated && cmd.split(' ').length < 2) {
        // Base command without arguments - show realistic output
        const baseOutputs = {
          'uname': 'Linux',
          'ip': 'Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\n       ip [ -force ] -batch filename\n\nwhere  OBJECT := { link | address | route | neigh | ... }',
          'ping': 'ping: usage error: Destination address required',
          'traceroute': 'traceroute: usage error: No destination specified',
          'nslookup': '> （进入交互模式，输入 exit 返回）',
          'ssh': 'usage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-B bind_interface] [-b bind_address] [-c cipher_spec] [-D [bind_address:]port] [-E log_file] [-e escape_char] [-F configfile] [-I pkcs11] [-i identity_file] [-J [user@]host[:port]] [-L address] [-l login_name] [-m mac_spec] [-O ctl_cmd] [-o option] [-p port] [-Q query_option] [-R address] [-S ctl_path] [-W host:port] [-w local_tun[:remote_tun]] destination [command]',
          'curl': 'curl: try \'curl --help\' or \'curl --manual\' for more information',
          'docker': 'Usage:  docker [OPTIONS] COMMAND\n\nA self-sufficient runtime for containers\n\nCommon Commands:\n  run         Create and run a new container from an image\n  ps          List containers\n  pull        Download an image from a registry\n  --help      Print usage',
          'mosquitto_sub': 'mosquitto_sub: error: need a topic to subscribe to\nUse mosquitto_sub --help to see usage.',
          'mosquitto_pub': 'mosquitto_pub: error: need a topic and a message\nUse mosquitto_pub --help to see usage.',
          'systemctl': 'Usage: systemctl [OPTIONS...] COMMAND [UNIT...]\n\nQuery or send control commands to the system manager.\n\nCommands:\n  status UNIT    Show runtime status of a unit\n  start UNIT     Start (activate) one or more units\n  stop UNIT      Stop (deactivate) one or more units\n  restart UNIT   Restart one or more units\n  enable UNIT    Enable one or more unit files'
        };
        const realOutput = baseOutputs[baseCmd] || `${baseCmd}: 需要指定参数，试试 ${expected[0]}`;
        const outLines = realOutput.split('\n');
        outLines.forEach((line, li) => {
          appendOutput(`<span class="${li === 0 ? 'term-warn' : 'term-out'}">${line}</span>`);
        });
        const idx = Math.min(attempts - 1, hints.length - 1);
        hint.textContent = '💡 ' + hints[idx];
        hint.style.color = 'var(--amber)';
        input.value = '';
        input.focus();
      } else {
      errors++;
      streak = 0;
        appendOutput(`<span class="term-error">bash: ${cmd}: 命令未找到</span>`);
        const idx = Math.min(attempts - 1, hints.length - 1);
        hint.textContent = '💡 ' + hints[idx];
        hint.style.color = 'var(--amber)';
        shakeScreen();
        input.value = '';
        input.focus();
      }
    }
  }

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      doCheck();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        historyIdx = Math.max(0, historyIdx - 1);
        input.value = cmdHistory[historyIdx];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx < cmdHistory.length - 1) {
        historyIdx++;
        input.value = cmdHistory[historyIdx];
      } else {
      errors++;
      streak = 0;
        historyIdx = cmdHistory.length;
        input.value = '';
      }
    }
  });

  setTimeout(() => input.focus(), 200);
  } // end startBoot
} // end renderTypeTerminal
