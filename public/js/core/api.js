// ═══════════════════════════════════════════════════════════════════
// core/api.js — api 模块（拆自 app.js）
// import core/*；其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════


export async function api(path, options) {
  const headers = {'Content-Type':'application/json','Authorization':'Bearer '+window.token};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch(window.API + path, { signal: controller.signal, headers: { ...headers, ...(options?.headers || {}) }, ...options });
    clearTimeout(timer);
    if (r.status === 401) { sessionStorage.clear(); location.href = 'index.html'; return null; }
    return await r.json();
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') window.showToast('请求超时', 'error');
    else if (!e.message?.includes('sessionStorage')) window.showToast('网络请求失败', 'error');
    return null;
  }
}

export async function loadGameContent() {
  const result = await api('/api/game/content');
  if (result && result.ok) window.content = result.data;
}

export async function loadKnowledgeTags() {
  try {
    const tagsRes = await fetch('/data/knowledge-tags.json');
    const tagsData = await tagsRes.json();
    tagsData.tags.forEach(t => { window.KNOWLEDGE_TAGS[t.id] = t; });
  } catch (e) {
    console.warn('Failed to load knowledge tags', e);
  }
}

export async function loadState() {
  const res = await api('/api/student/me');
  if (res && res.ok) {
    window.gameState.check = res.data.check || {};
    window.gameState.stars = res.data.stars || {};
    window.gameState.achievements = res.data.achievements || {};
    window.gameState.teacherAwards = res.data.teacherAwards || {};
    window.gameState.newlyAwardedLogin = res.data.newlyAwardedLogin || [];
    window.gameState.hasPassword = !!res.data.hasPassword;
    window.gameState.coins = res.data.coins || 0;
    window.gameState.inventory = res.data.inventory || {};
    window.gameState.salaryInfo = res.data.salaryInfo || {};
    if (res.data.salaryInfo && res.data.salaryInfo.justClaimed) {
      setTimeout(() => window.showToast('💰 上班打卡 +' + res.data.salaryInfo.rate + ' 金币（今日工资）', 'success'), 1200);
    }
  }
}

export async function saveState() {
  await api('/api/student/me', {
    method: 'PUT',
    body: JSON.stringify({ check: window.gameState.check, stars: window.gameState.stars, achievements: window.gameState.achievements })
  });
}
