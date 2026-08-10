const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { requireAuth } = require('../auth');

const CONTENT_PATH = path.join(__dirname, '..', 'data', 'game-content.json');
let cached = null;
let mtime = 0;

function getContent() {
  try {
    const stat = fs.statSync(CONTENT_PATH);
    if (!cached || stat.mtimeMs !== mtime) {
      const raw = fs.readFileSync(CONTENT_PATH, 'utf-8');
      cached = JSON.parse(raw);
      mtime = stat.mtimeMs;
    }
    return { ok: true, data: cached };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

router.get('/content', (req, res) => {
  const result = getContent();
  if (!result.ok) return res.status(500).json(result);
  res.json(result);
});

// 排行榜：全班 XP 排名、关卡完成状态、每关首位完成者（先锋）
router.get('/leaderboard', requireAuth, (req, res) => {
  const contentRes = getContent();
  if (!contentRes.ok) return res.status(500).json(contentRes);
  const content = contentRes.data;

  function taskXP(t) {
    if (t.hidden) return 300;
    if (t.type === 'quiz' && t.xp <= 50) return 50;
    if (t.xp === 0) return 0;
    return t.xp || 100;
  }

  function levelCompleted(check, level) {
    let done = 0, total = 0;
    (level.tasks || []).forEach(t => {
      if (t.auto) return;
      total++;
      if (check['' + t.id]) done++;
    });
    return total > 0 && done >= total;
  }

  const rows = db.listStudents().map(s => {
    const check = JSON.parse(s.check_data || '{}');
    let xp = 0, done = 0, total = 0;
    const levelDone = {};
    content.levels.forEach(lv => {
      levelDone[lv.id] = levelCompleted(check, lv);
      (lv.tasks || []).forEach(t => {
        if (t.auto) return;
        total++;
        if (check['' + t.id]) { done++; xp += taskXP(t); }
      });
    });
    return {
      name: s.name,
      xp,
      completion: total ? Math.round(done / total * 100) : 0,
      doneTasks: done,
      totalTasks: total,
      levelDone,
      levelFinish: JSON.parse(s.level_finish_times || '{}'),
      stars: JSON.parse(s.stars_data || '{}'),
      created_at: s.created_at
    };
  });

  // 每关首位完成者（先锋）：按记录时间最早者
  const best = {};
  rows.forEach(r => {
    Object.keys(r.levelFinish).forEach(lvId => {
      if (!best[lvId] || r.levelFinish[lvId] < best[lvId].time) {
        best[lvId] = { name: r.name, time: r.levelFinish[lvId] };
      }
    });
  });
  const pioneers = {};
  Object.keys(best).forEach(k => { pioneers[k] = best[k].name; });

  rows.sort((a, b) => (b.xp - a.xp) || (a.name < b.name ? -1 : 1));
  const myRank = rows.findIndex(r => r.name === req.session.name) + 1;
  const classCompletion = rows.length
    ? Math.round(rows.reduce((s, r) => s + r.completion, 0) / rows.length) : 0;

  res.json({ ok: true, data: { rows, pioneers, myRank, classCompletion } });
});

module.exports = { router, getContent };
