// ═══════════════════════════════════════════════════════════════════
// ui/password.js — password 模块（拆自 app.js）
// import core/*；其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════


export function openPasswordModal() {
  const hasPw = !!window.gameState.hasPassword;
  document.getElementById('pwTitle').textContent = hasPw ? '修改登录密码' : '设置登录密码';
  document.getElementById('pwOldField').style.display = hasPw ? 'block' : 'none';
  document.getElementById('pwOld').value = '';
  document.getElementById('pwNew').value = '';
  document.getElementById('pwNew2').value = '';
  document.getElementById('pwErr').textContent = '';
  document.getElementById('pwOverlay').classList.add('show');
  setTimeout(() => document.getElementById('pwNew').focus(), 50);
}

export function closePasswordModal() {
  document.getElementById('pwOverlay').classList.remove('show');
}

export async function savePassword() {
  const oldPassword = document.getElementById('pwOld').value;
  const pw1 = document.getElementById('pwNew').value;
  const pw2 = document.getElementById('pwNew2').value;
  const err = document.getElementById('pwErr');
  if (!pw1 || pw1.length < 4) { err.textContent = '新密码至少 4 位'; return; }
  if (pw1 !== pw2) { err.textContent = '两次输入的新密码不一致'; return; }
  const btn = document.getElementById('pwSaveBtn');
  btn.disabled = true; btn.textContent = '保存中…';
  const res = await window.api('/window.api/student/password', {
    method: 'PUT',
    body: JSON.stringify({ oldPassword, newPassword: pw1 })
  });
  btn.disabled = false; btn.textContent = '确认';
  if (!res || !res.ok) {
    err.textContent = (res && res.error) || '保存失败，请重试';
    return;
  }
  window.gameState.hasPassword = true;
  closePasswordModal();
  window.showToast('密码已设置，下次登录需输入', 'success');
}

export function showPasswordPrompt(done) {
  if (!window.PASSWORD_ENABLED) { if (done) setTimeout(done, 50); return; }
  if (window.gameState.hasPassword) { if (done) setTimeout(done, 50); return; }
  if (document.getElementById('pwPromptOverlay')) { if (done) setTimeout(done, 50); return; }
  const overlay = document.createElement('div');
  overlay.id = 'pwPromptOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-window.content:center';
  const box = document.createElement('div');
  box.style.cssText = 'background:#12121a;border:2px solid var(--amber);border-radius:10px;padding:24px 30px;max-width:430px;width:90%;box-shadow:0 0 40px rgba(255,176,0,.15)';
  box.innerHTML = `
    <div style="font-size:18px;color:var(--amber);font-weight:bold;margin-bottom:12px">🔑 建议修改初始密码</div>
    <div style="font-size:14px;line-height:1.8;color:var(--text);margin-bottom:20px">你的账号还在使用初始密码 123456，任何知道你姓名的人都能用这个密码登录。设置一个自己的密码更安心。</div>
    <div style="display:flex;gap:10px;justify-window.content:center">
      <button id="pwPromptGo" style="padding:9px 24px;background:var(--amber);color:#000;border:none;border-radius:4px;font-size:15px;font-weight:bold;cursor:pointer;font-family:inherit">去设置</button>
      <button id="pwPromptLater" style="padding:9px 24px;background:none;color:var(--dim);border:1px solid var(--border);border-radius:4px;font-size:15px;cursor:pointer;font-family:inherit">稍后再说</button>
    </div>`;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  box.querySelector('#pwPromptGo').onclick = () => { window.playAreaMusic(); overlay.remove(); if (done) setTimeout(done, 50); openPasswordModal(); };
  box.querySelector('#pwPromptLater').onclick = () => { window.playAreaMusic(); overlay.remove(); if (done) setTimeout(done, 50); };
}
