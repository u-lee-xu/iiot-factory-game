// ═══════════════════════════════════════════════════════════════════
// core/utils.js — 纯工具函数（无 DOM / 无状态依赖）
// 从 app.js 抽出；供各模块 import；window 挂载由 app.js 统一负责
// ═══════════════════════════════════════════════════════════════════

export function escHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

export function dstr(){ const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }

export function _fmtTime(iso){
  try{
    const d=new Date(iso); if(isNaN(d.getTime())) return String(iso||'');
    const p=n=>String(n).padStart(2,'0');
    return (d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
  }catch(e){ return String(iso||''); }
}

export function starStr(v) {
  if (v <= 0) return '';
  const f = Math.floor(v);
  let s = '';
  for (let i = 0; i < f; i++) s += '★';
  for (let i = f; i < 5; i++) s += '☆';
  return s;
}

export function taskKey(taskId) {
  return '' + taskId;
}

export function taskXP(task) {
  if (task.hidden) return 300;
  if (task.type === 'quiz' && task.xp <= 50) return 50;
  if (task.xp === 0) return 0;
  return task.xp || 100;
}
