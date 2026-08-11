const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireTeacher } = require('../auth');

router.use(requireAuth, requireTeacher);

router.get('/students', (req, res) => {
  const students = db.listStudents().map(s => {
    const w = db.getWallet(s.name);
    return {
      name: s.name,
      password: s.password || '',
      hasPassword: !db.isDefaultPassword(s.password),
      check: JSON.parse(s.check_data),
      stars: JSON.parse(s.stars_data),
      created_at: s.created_at,
      loginCount: s.login_count || 0,
      lastLoginDate: s.last_login_date || '',
      loginStreak: s.login_streak || 0,
      coins: w ? w.coins : 0,
      inventory: w ? w.inventory : {},
      monthSalaryTotal: w ? w.monthSalaryTotal : 0
    };
  });
  res.json({ ok: true, data: students });
});

router.post('/students', (req, res) => {
  const { names } = req.body || {};
  if (!Array.isArray(names) || names.length === 0) {
    return res.status(400).json({ ok: false, error: '请提供学生姓名列表' });
  }
  const results = { added: [], exists: [] };
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const student = db.createStudent(name);
    if (student) results.added.push(name);
    else results.exists.push(name);
  }
  res.json({ ok: true, ...results });
});

router.get('/student/:name', (req, res) => {
  const s = db.findStudent(req.params.name);
  if (!s) return res.status(404).json({ ok: false, error: '学生不存在' });
  res.json({ ok: true, data: {
    name: s.name,
    password: s.password || '',
    hasPassword: !db.isDefaultPassword(s.password),
    isDefaultPassword: db.isDefaultPassword(s.password),
    check: JSON.parse(s.check_data || '{}'),
    stars: JSON.parse(s.stars_data || '{}'),
    achievements: JSON.parse(s.achievements || '{}'),
    teacherAwards: JSON.parse(s.teacher_awards || '{}'),
    levelFinishTimes: JSON.parse(s.level_finish_times || '{}'),
    created_at: s.created_at,
    loginCount: s.login_count || 0,
    lastLoginDate: s.last_login_date || '',
    loginStreak: s.login_streak || 0,
    coins: (db.getWallet(s.name) || {}).coins || 0,
    inventory: (db.getWallet(s.name) || {}).inventory || {},
    monthSalaryTotal: (db.getWallet(s.name) || {}).monthSalaryTotal || 0
  }});
});

router.delete('/student/:name', (req, res) => {
  const ok = db.deleteStudent(req.params.name);
  if (!ok) return res.status(404).json({ ok: false, error: '学生不存在' });
  res.json({ ok: true });
});

router.put('/student/:name/grade', (req, res) => {
  const { levelId, teacherStars } = req.body || {};
  if (levelId == null || teacherStars == null) {
    return res.status(400).json({ ok: false, error: '缺少 levelId 或 teacherStars' });
  }
  if (teacherStars < 0 || teacherStars > 5) {
    return res.status(400).json({ ok: false, error: '师评分数需在 0-5 之间' });
  }
  const result = db.updateStudentStars(req.params.name, String(levelId), teacherStars);
  if (!result) return res.status(404).json({ ok: false, error: '学生不存在' });
  res.json({ ok: true, data: { stars: result } });
});

// 教师设置/重置学生密码（password 留空则清除密码）
router.put('/student/:name/password', (req, res) => {
  const { password } = req.body || {};
  const pw = String(password || '').trim();
  if (pw && pw.length < 4) {
    return res.status(400).json({ ok: false, error: '密码至少 4 位，留空则清除密码' });
  }
  const ok = db.updateStudentPassword(req.params.name, pw);
  if (!ok) return res.status(404).json({ ok: false, error: '学生不存在' });
  res.json({ ok: true, data: { password: pw, hasPassword: !db.isDefaultPassword(pw) } });
});

router.post('/student/:name/achievements', (req, res) => {
  const { achievementIds } = req.body || {};
  if (!Array.isArray(achievementIds) || achievementIds.length === 0) {
    return res.status(400).json({ ok: false, error: '请选择要发放的成就' });
  }
  const ids = achievementIds.map(String).filter(Boolean);
  const result = db.awardTeacherAchievements(req.params.name, ids);
  if (!result) return res.status(404).json({ ok: false, error: '学生不存在' });
  res.json({ ok: true, data: result });
});

// 教师发放金币（奖励）
router.post('/student/:name/coins', (req, res) => {
  const { amount } = req.body || {};
  const n = parseInt(amount, 10);
  if (!n || isNaN(n)) return res.status(400).json({ ok: false, error: '请输入金币数量' });
  const s = db.findStudent(req.params.name);
  if (!s) return res.status(404).json({ ok: false, error: '学生不存在' });
  const cur = db.getWallet(req.params.name);
  db.setCoins(req.params.name, (cur ? cur.coins : 0) + n);
  res.json({ ok: true, data: { coins: db.getWallet(req.params.name).coins } });
});

// Bug 反馈列表（教师查看，用于按反馈次数发成就）
router.get('/bug-reports', (req, res) => {
  res.json({ ok: true, data: db.listBugReports() });
});
router.delete('/bug-reports/:id', (req, res) => {
  db.deleteBugReport(Number(req.params.id));
  res.json({ ok: true });
});

router.post('/student/:name/reset', (req, res) => {
  const ok = db.resetStudent(req.params.name);
  if (!ok) return res.status(404).json({ ok: false, error: '学生不存在' });
  res.json({ ok: true });
});

module.exports = router;
