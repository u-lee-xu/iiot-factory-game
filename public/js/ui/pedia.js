// ═══════════════════════════════════════════════════════════════════
// ui/pedia.js — pedia 模块（拆自 app.js）
// import core/*；其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';

export function getPedia() {
  try { return JSON.parse(localStorage.getItem('term_pedia') || '{}'); } catch (e) { return {}; }
}

export function savePedia(p) { localStorage.setItem('term_pedia', JSON.stringify(p)); }

export function getPediaCount() {
  const p = getPedia();
  return Object.values(p).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
}

export function unlockPedia(levelId, ids) {
  const p = getPedia();
  const key = '' + levelId;
  const cur = new Set(p[key] || []);
  ids.forEach(id => cur.add(id));
  p[key] = Array.from(cur);
  savePedia(p);
}

export function pediaCount(levelId) {
  const tl = window.getTermLevel(levelId);
  if (!tl) return { got: 0, total: 0 };
  const all = new Set();
  tl.warmups.forEach(w => (w.pairs || []).forEach(pr => { if (pr && pr.id) all.add(pr.id); }));
  ((tl.bonus && tl.bonus.levels) || []).forEach(l => (l.pairs || []).forEach(pr => { if (pr && pr.id) all.add(pr.id); }));
  const got = new Set(getPedia()['' + levelId] || []);
  let gotCount = 0;
  all.forEach(id => { if (got.has(id)) gotCount++; });
  return { got: gotCount, total: all.size };
}

export function openPedia() {
  document.getElementById('pdOverlay').classList.add('show');
  renderPedia();
}

export function closePedia() {
  if (window._mapFlowFeature) { window.goMap(); return; }
  document.getElementById('pdOverlay').classList.remove('show');
}

export function renderPedia() {
  const tl = window.getTermLevel(window.currentLevelId);
  const body = document.getElementById('pdBody');
  if (!tl) {
    body.innerHTML = '<div class="lb-empty">当前关卡暂无图鉴内容</div>';
    document.getElementById('pdProgress').textContent = '';
    return;
  }
  const pediaSet = new Set(getPedia()['' + window.currentLevelId] || []);
  const all = new Map();
  tl.warmups.forEach(w => (w.pairs || []).forEach(pr => { if (pr && pr.id) all.set(pr.id, pr); }));
  ((tl.bonus && tl.bonus.levels) || []).forEach(l => (l.pairs || []).forEach(pr => { if (pr && pr.id) all.set(pr.id, pr); }));
  const entries = Array.from(all.values());
  const gotCount = entries.filter(pr => pediaSet.has(pr.id)).length;
  document.getElementById('pdProgress').textContent = (tl.emoji || '📖') + ' ' + (tl.name || ('第 ' + window.currentLevelId + ' 关')) + ' · 已收集 ' + gotCount + '/' + entries.length;
  let html = '';
  if (gotCount === entries.length) {
    html += '<div class="pd-full">🎉 图鉴集齐！这些词汇你已经全部脸熟，后面学起来事半功倍</div>';
  }
  html += '<div class="pd-grid">';
  entries.forEach(pr => {
    const got = pediaSet.has(pr.id);
    if (got) {
      html += '<div class="pd-card">' +
        '<div class="pd-emoji">' + pr.emoji + '</div>' +
        '<div class="pd-term">' + escHtml(pr.term) + '</div>' +
        '<div class="pd-hint">' + escHtml(pr.hint) + '</div>' +
        (pr.cmd ? '<div class="pd-cmd">$ ' + escHtml(pr.cmd) + '</div>' : '') +
        (pr.cat ? '<span class="pd-cat">' + escHtml(pr.cat) + '</span>' : '') +
      '</div>';
    } else {
      html += '<div class="pd-card locked">' +
        '<div class="pd-emoji">🔒</div>' +
        '<div style="font-size:14px;color:var(--dim);margin-top:8px">？？？</div>' +
        '<div style="font-size:12px;color:var(--dim);margin-top:6px">完成翻牌解锁</div>' +
      '</div>';
    }
  });
  html += '</div>';
  body.innerHTML = html;
}
