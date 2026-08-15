// ═══════════════════════════════════════════════════════════════════
// ui/header.js — header 模块（拆自 app.js）
// import core/*；其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════


export function renderHeader() {
  const xp = window.calcTotalXP();
  const rank = window.getRank(xp);
  const nextRank = window.RANKS.find(r => r.min > xp);
  const maxXP = nextRank ? nextRank.min : 8000;
  const minXP = rank.min;
  const pct = nextRank ? Math.round((xp - minXP) / (nextRank.min - minXP) * 100) : 100;

  document.getElementById('playerDisplay').textContent = window.myName;
  document.getElementById('rankDisplay').textContent = rank.title;
  document.getElementById('xpFill').style.width = Math.min(pct, 100) + '%';
  document.getElementById('xpLabel').textContent = xp + ' / ' + (nextRank ? nextRank.min + '' : 'MAX');
  var _wa = document.getElementById('walletAmt');
  if (_wa) _wa.textContent = (window.gameState.coins || 0);
  
  // Update director mini-avatar mood
  updateDirectorAvatar();
}

export function updateDirectorAvatar(mood) {
  if (mood) window.directorMood = mood;
  const avatar = document.getElementById('directorAvatar');
  if (!avatar) return;
  const emojiMap = { proud: '😎', stern: '😤', awkward: '😅', thinking: '🤔', neutral: '👨‍💼' };
  avatar.textContent = emojiMap[window.directorMood] || '👨‍💼';
  avatar.className = 'director-avatar director-mood-' + window.directorMood;
  // Auto-reset to neutral after 3s
  clearTimeout(avatar._resetTimer);
  avatar._resetTimer = setTimeout(() => {
    window.directorMood = 'neutral';
    avatar.textContent = '👨‍💼';
    avatar.className = 'director-avatar director-mood-neutral';
  }, 3000);
}
