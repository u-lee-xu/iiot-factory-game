// ═══════════════════════════════════════════════════════════════════
// core/kbd.js — PC 键盘导航（无鼠标操作）
//   setupKbdNav：↑/↓/←/→ 移动光标（.kbd-focus 发光），空格 = 触发点击（选中/放置）
//   回车：统一走 setupGlobalEnter —— 优先级 回厂区继续 > 知道了再试一次 > 任务主提交
//   输入框（terminal/fill_blank）里回车不劫持，避免与命令提交冲突
// ═══════════════════════════════════════════════════════════════════
export function kbdCleanup(){
  try{ if(window.__kbdCleanup){ window.__kbdCleanup(); window.__kbdCleanup=null; } }catch(e){}
}

// 统一回车确认（全局只挂一次）
export function setupGlobalEnter(){
  if(window.__globalEnterBound) return;
  window.__globalEnterBound = true;
  window.addEventListener('keydown', function(e){
    if(e.key!=='Enter') return;
    // 输入框内回车不劫持（terminal/fill_blank 提交命令用）
    const t=e.target;
    if(t && (t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable)) return;
    // 1) 关卡结算「回厂区继续」（独立 overlay，最高优先）
    const lc=document.getElementById('levelCompleteBtn');
    if(lc && lc.offsetParent!==null){ e.preventDefault(); lc.click(); return; }
    // 2) 答错提示「知道了，再试一次」
    const retry=document.querySelector('.modal-overlay.show .director-box .btn-primary');
    if(retry){ e.preventDefault(); retry.click(); return; }
    // 3) 任务主提交/确认（提交/领取XP/确认分类）
    const sb=document.querySelector('#modalFoot .btn-primary, #modalFoot .btn-success');
    if(sb){ e.preventDefault(); sb.click(); }
  });
}

export function setupKbdNav(scope, selector, opts){
  kbdCleanup();   // 先清旧监听（任务切换时）
  setupGlobalEnter();   // 确保全局回车已挂
  const cfg = opts || {};
  let idx = -1;
  function items(){ return [...(scope||document).querySelectorAll(selector)]; }
  function focus(i, show){
    idx = i;
    const list=items();
    // 先清掉旧光圈（点击/初始不显示，避免与点击高亮叠加）
    list.forEach((el,k)=>{ if(el){ el.classList.remove('kbd-focus'); } });
    if(show && list[i]){
      list[i].classList.add('kbd-focus');
      try{ list[i].scrollIntoView({block:'nearest'}); }catch(e){}
    }
  }
  function onKey(e){
    const list=items();
    if(!list.length) return;
    if(e.key==='ArrowDown'||e.key==='ArrowRight'){ e.preventDefault(); focus((idx+1)%list.length, true); }
    else if(e.key==='ArrowUp'||e.key==='ArrowLeft'){ e.preventDefault(); focus((idx-1+list.length)%list.length, true); }
    else if(e.key===' '){ if(idx>=0&&list[idx]){ e.preventDefault(); list[idx].click(); } }
    // 回车交给 setupGlobalEnter 处理（避免与 知道了再试一次/回厂区继续 冲突）
  }
  // 点击/点选项 → 键盘焦点跟过去（触屏虽不显示光圈，但索引同步，键盘/回车仍一致）
  function onDocClick(e){
    const t=e.target;
    if(!t||!t.closest) return;
    const it=t.closest(selector);
    if(it && scope && scope.contains(it)){
      const list=items();
      const i=list.indexOf(it);
      if(i>=0) focus(i, false);   // 点击不显示键盘光圈（避免与点击高亮叠加）
    }
  }
  document.addEventListener('click', onDocClick, true);
  window.addEventListener('keydown', onKey);
  const list=items();
  if(list.length){ focus(0, false); }   // 初始不显示光圈，键盘导航时才显示
  window.__kbdCleanup = function(){
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('click', onDocClick, true);
  };
}
