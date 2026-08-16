// ═══════════════════════════════════════════════════════════════════
// room-task-host.js — room.html 的任务宿主：在房间页内打开真实任务模态
//   房间作底板：任务模态遮罩用 backdrop-filter 让房间透出（模糊压暗），
//   关闭/完成模态后直接回到房间，从机制上杜绝"空白壳"。
//   复用 core/* + interactions/* 模块渲染真实任务，不依赖 student.html。
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction, getInteraction } from './core/interactions.js';
import { typewrite, generateTeach, getRandomMoodLine, getDirectorMood, addDirectorBox, showWrongExplain, shakeScreen, glowCorrect } from './core/fx.js';
import { escHtml, taskKey, taskXP } from './core/utils.js';
import { playSound, playMusic } from './core/sound.js';
import { setupKbdNav, kbdCleanup, setupGlobalEnter } from './core/kbd.js';
import { renderTypeTerminal } from './ui/main.js';

// 注册全部任务类型（import 副作用触发 registerInteraction）
import './interactions/quiz.js';
import './interactions/chain_quiz.js';
import './interactions/fill_blank.js';
import './interactions/install_wizard.js';
import './interactions/sort.js';
import './interactions/scenario_match.js';
import './interactions/drag_classify.js';
import './interactions/ethics.js';
import './interactions/diagnosis_tree.js';
import './interactions/code_review.js';
import './interactions/boss_fight.js';
import './interactions/progress_bar.js';
import './interactions/log_forensics.js';
import './interactions/default.js';

// —— 挂 window 公共函数（interactions/renderTypeTerminal 经 window 调用）——
window.getInteraction = getInteraction;
window.generateTeach = generateTeach;
window.getRandomMoodLine = getRandomMoodLine;
window.getDirectorMood = getDirectorMood;
window.addDirectorBox = addDirectorBox;
window.showWrongExplain = showWrongExplain;
window.shakeScreen = shakeScreen;
window.glowCorrect = glowCorrect;
window.typewrite = typewrite;
window.escHtml = escHtml;
window.taskXP = taskXP;
window.playSound = playSound;
window.playMusic = playMusic;
window.setupKbdNav = setupKbdNav;
window.kbdCleanup = kbdCleanup;
window.setupGlobalEnter = setupGlobalEnter;
window.renderTypeTerminal = renderTypeTerminal;

// —— 状态（与 app.js 对齐）——
let _ctx = null;
let _streak = 0, _errors = 0;
Object.defineProperty(window, 'streak', { get: () => _streak, set: v => { _streak = v; }, configurable: true });
Object.defineProperty(window, 'errors', { get: () => _errors, set: v => { _errors = v; }, configurable: true });
window.currentLevelId = null;
window.currentTaskId = null;
window.__passActive = false;
window.selfTeachTypes = ['terminal', 'quiz', 'chain_quiz', 'fill_blank', 'drag_classify', 'install_wizard', 'progress_bar'];
window.directorMoodLines = {
  proud: ["漂亮！这波操作教科书级别","不愧是我看好的人，稳！","这手速、这准度，有前途","厂里就缺你这种干实事的","完美通过，工位升级已安排上"],
  stern: ["别急，先看清提示再输","心静不下来，命令输不对","车间设备不等人，重新来过","基础不牢，地动山摇啊","再仔细看一遍厂长说的"],
  awkward: ["兄弟，这是装 SSH 的关卡不是查目录…","命令输对了，但关卡搞错了呀","你这是在给服务器按摩吗？","厂长看着你乱输挺心累的","建议先收起教学再动手"],
  guide: ["先听厂长把方法讲清楚，再动手不迟","这个任务的重点，厂长先给你划出来","跟紧厂长，一步一个脚印","记住要点，后面全靠它"],
  thinking: ["卡住了？看看上面的提示栏","第一步通常是最关键的","不用急，厂长给你留着灯","回想一下上一关咋过的"],
  neutral: ["厂长把这个任务交给你了","机器不会等——赶紧处理","按部就班来，稳住"]
};
window.KNOWLEDGE_TAGS = {};

// —— 任务前言（厂长教学 + 打字 + 开始）——
function showTaskPreface(task, onStart) {
  const teachText = window.generateTeach(task);
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.8);z-index:10001;display:flex;align-items:center;justify-content:center';
  const box = document.createElement('div');
  box.style.cssText = 'background:#12121a;border:2px solid var(--cyan,#00bcd4);border-radius:8px;padding:0;width:min(92vw,560px);box-shadow:0 0 60px rgba(0,188,212,.2);overflow:hidden;max-height:86vh;display:flex;flex-direction:column';
  box.innerHTML =
    '<div class="director-box director-mood-thinking" style="margin:0;border-radius:0;border:none;border-bottom:1px solid var(--border,#2c3552);padding:16px 20px;display:flex;gap:12px;align-items:flex-start">' +
      '<div class="director-portrait" style="font-size:36px;line-height:1;flex-shrink:0;width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:#1a1a24;border-radius:4px">👨‍💼</div>' +
      '<div class="director-bubble" style="flex:1;min-width:0"><div class="director-name" style="font-size:16px;color:var(--amber,#ffb340);margin-bottom:2px">厂长</div>' +
      '<div class="director-text" id="roomTaskPrefaceText" style="font-size:15px;line-height:1.7;color:var(--text,#e8eaf0);white-space:pre-wrap"></div></div>' +
    '</div>' +
    '<div style="padding:16px 20px;text-align:center;border-top:1px solid var(--border,#2c3552);background:rgba(0,0,0,.2)">' +
      '<button id="roomTaskPrefaceBtn" style="padding:10px 32px;background:var(--cyan,#00bcd4);color:#000;border:none;border-radius:4px;font-size:15px;font-weight:bold;cursor:pointer;font-family:inherit;opacity:0.5" disabled>正在讲解...</button>' +
    '</div>';
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  overlay.id = 'roomPrefOv';   // 供 closeModal 统一清理（防止退出任务后前言残留挡住场景）
  const textEl = box.querySelector('#roomTaskPrefaceText');
  const btn = box.querySelector('#roomTaskPrefaceBtn');
  typewrite(textEl, String(teachText || '').replace(/^厂长[:：]\s*/, ''), 20, () => {
    btn.disabled = false; btn.style.opacity = '1'; btn.textContent = '收到，开始操作'; playSound('click');
  });
  // 兜底：即使打字动画异常卡住，5 秒后按钮也放行（保证玩家能进入任务）
  setTimeout(function(){ if (btn.disabled) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = '收到，开始操作'; } }, 5000);
  const onPrefaceKey = function(e){ if(e.key==='Enter'){ const b=box.querySelector('#roomTaskPrefaceBtn'); if(b && !b.disabled){ b.click(); } } };
  window.addEventListener('keydown', onPrefaceKey);
  window.__roomPrefCleanup = onPrefaceKey;   // 供 closeModal 移除监听
  btn.onclick = () => {
    window.removeEventListener('keydown', onPrefaceKey);
    overlay.style.opacity = '0'; overlay.style.transition = 'opacity .3s';
    setTimeout(() => overlay.remove(), 300);
    playSound('click');
    if (onStart) onStart();
  };
  return overlay;
}

// —— 打开任务 ——
function openTaskModal(lvId, taskId) {
  if (!_ctx || !_ctx.content) return;
  const lv = _ctx.content.levels.find(l => String(l.id) === String(lvId));
  if (!lv) return;
  const task = lv.tasks.find(t => String(t.id) === String(taskId));
  if (!task) return;
  window.currentLevelId = lvId;
  window.currentTaskId = taskId;
  const titleEl = document.getElementById('modalTitle');
  if (titleEl) titleEl.textContent = task.title;
  const subEl = document.getElementById('modalSub');
  if (subEl) subEl.textContent = (lv.areaName || '') + (lv.name ? ' · ' + lv.name : '');
  showTaskPreface(task, () => {
    const overlay = document.getElementById('modalOverlay');
    const body = document.getElementById('modalBody');
    const foot = document.getElementById('modalFoot');
    body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--dim,#9aa3bd)">加载中…</div>';
    foot.innerHTML = '';
    overlay.classList.add('show');
    const handler = window.getInteraction(task.type);
    if (handler) { try{ handler.render(body, task); }catch(e){ console.error('任务渲染失败', e); body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--dim,#9aa3bd)">任务渲染失败</div>'; } }
    else body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--dim,#9aa3bd)">未知任务类型: ' + escHtml(task.type) + '</div>';
  });
}

// —— 关闭 ——
function closeModal() {
  try{ kbdCleanup(); }catch(e){}
  // 清理任务前言 overlay（若玩家在"开始"前退出，避免残留遮罩挡住房间场景/点击）
  try{
    const _ov=document.getElementById('roomPrefOv'); if(_ov) _ov.remove();
    if(window.__roomPrefCleanup){ window.removeEventListener('keydown', window.__roomPrefCleanup); window.__roomPrefCleanup=null; }
  }catch(e){}
  const el = document.getElementById('modalOverlay');
  if (!el) return;
  el.classList.remove('show');
  window.currentTaskId = null;
}
window.closeModal = closeModal;
window.closeTaskModal = closeModal;

// —— 完成 ——
async function completeTask(taskId, xp) {
  try {
    const lv = (_ctx.content.levels.find(l => (l.tasks || []).some(t => String(t.id) === String(taskId))));
    const tFull = lv ? lv.tasks.find(t => String(t.id) === String(taskId)) : null;
    const full = tFull ? taskXP(tFull) : xp;
    if (window.__passActive && xp < full) { window.__passActive = false; xp = full; }
    if (!_ctx.me.check) _ctx.me.check = {};
    if (xp < full) _ctx.me.check[String(taskId)] = { half: true };
    else _ctx.me.check[String(taskId)] = true;
    try {
      await fetch(_ctx.API + '/api/student/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _ctx.token },
        body: JSON.stringify({ check: _ctx.me.check })
      });
    } catch(e){ console.error('存档失败', e); }
    finishTaskFlow(taskId, xp);
  } catch(e){ console.error('completeTask error:', e); }
}

function finishTaskFlow(taskId, xp) {
  closeModal();
  // 刷新宿主房间状态（room.html 传入 refresh → renderRoom）
  try{ if (typeof _ctx.refresh === 'function') _ctx.refresh(taskId); }catch(e){}
  try{ if (typeof _ctx.onAfterComplete === 'function') _ctx.onAfterComplete(taskId); }catch(e){}
  try{ if (typeof _ctx.onAfterCompleteAsync === 'function') _ctx.onAfterCompleteAsync(taskId); }catch(e){}
  // 关卡完成庆祝
  try {
    const lv = _ctx.content.levels.find(l => (l.tasks || []).some(t => String(t.id) === String(taskId)));
    if (lv) {
      const tasks = (lv.tasks || []).filter(t => !t.auto);
      const done = tasks.filter(t => _ctx.me.check[String(t.id)]).length;
      if (done >= tasks.length && tasks.length > 0) {
        setTimeout(() => { try{ window.showToast('🎉 本层「' + (lv.name || lv.areaName) + '」全部完成！', 'success'); }catch(e){} }, 400);
      }
    }
  } catch(e){}
}
window.completeTask = completeTask;

// —— 宿主挂载 ——
export function setupRoomTaskHost(ctx) {
  _ctx = ctx;
  window.content = ctx.content;
  window.gameState = { check: ctx.me.check || {}, achievements: ctx.me.achievements || {}, teacherAwards: ctx.me.teacherAwards || {} };
  window.openTaskModal = openTaskModal;
  const x = document.querySelector('#modalOverlay .modal-close');
  if (x) x.onclick = closeModal;
  // Esc 关闭任务（输入框内不劫持；小游戏 .mm-overlay 让游戏自己处理）
  window.addEventListener('keydown', function(e){
    if (e.key !== 'Escape') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (document.querySelector('.mm-overlay')) return;
    const m = document.getElementById('modalOverlay');
    if (m && m.classList.contains('show')) { e.preventDefault(); closeModal(); }
  });
  setupGlobalEnter();
  window.__openRoomTask = openTaskModal;
  return { openTaskModal, closeModal };
}

// 立即暴露给普通 script（room.html init 完成后调用 setup）
window.__roomTaskHost = {
  setup: setupRoomTaskHost,
  openTask: openTaskModal,
  ready: true
};
