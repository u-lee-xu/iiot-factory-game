// ═══════════════════════════════════════════════════════════════════
// core/kbd.js — PC 键盘导航（无鼠标操作）
//   ↑/↓/←/→ 移动光标（.kbd-focus 发光外框）
//   空格 = 选中当前聚焦项（触发其 click）
//   回车 = 点提交按钮（#modalFoot .btn-primary/.btn-success 等）
// 单实例：window.__kbdCleanup 记录上次监听，新任务自动清旧，避免堆积
// ═══════════════════════════════════════════════════════════════════
export function kbdCleanup(){
  try{ if(window.__kbdCleanup){ window.__kbdCleanup(); window.__kbdCleanup=null; } }catch(e){}
}

export function setupKbdNav(scope, selector, opts){
  kbdCleanup();   // 先清旧监听（任务切换时）
  const cfg = opts || {};
  let idx = -1;
  function items(){ return [...(scope||document).querySelectorAll(selector)]; }
  function focus(i){
    const list=items();
    list.forEach((el,k)=>{ if(el){ el.classList.toggle('kbd-focus', k===i); } });
    if(list[i]){ try{ list[i].scrollIntoView({block:'nearest'}); }catch(e){} }
  }
  function submit(){
    const sb=(cfg.submitSelector && document.querySelector(cfg.submitSelector)) ||
             document.querySelector('#modalFoot .btn-primary, #modalFoot .btn-success');
    if(sb){ try{ sb.click(); }catch(e){} return true; }
    return false;
  }
  function onKey(e){
    const list=items();
    if(!list.length) return;
    if(e.key==='ArrowDown'||e.key==='ArrowRight'){ e.preventDefault(); idx=(idx+1)%list.length; focus(idx); }
    else if(e.key==='ArrowUp'||e.key==='ArrowLeft'){ e.preventDefault(); idx=(idx-1+list.length)%list.length; focus(idx); }
    else if(e.key===' '){ if(idx>=0&&list[idx]){ e.preventDefault(); list[idx].click(); } }
    else if(e.key==='Enter'){ e.preventDefault(); submit(); }
  }
  window.addEventListener('keydown', onKey);
  const list=items();
  if(list.length){ focus(0); idx=0; }
  window.__kbdCleanup = function(){ window.removeEventListener('keydown', onKey); };
}
