const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireTeacher } = require('../auth');

router.use(requireAuth, requireTeacher);

router.get('/students', (req, res) => {
  const students = db.listStudents().map(s => ({
    name: s.name,
    password: s.password || '',
    hasPassword: !!s.password,
    check: JSON.parse(s.check_data),
    stars: JSON.parse(s.stars_data),
    created_at: s.created_at
  }));
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
  res.json({ ok: true, data: { password: pw, hasPassword: !!pw } });
});

router.post('/student/:name/reset', (req, res) => {
  const ok = db.resetStudent(req.params.name);
  if (!ok) return res.status(404).json({ ok: false, error: '学生不存在' });
  res.json({ ok: true });
});

module.exports = router;
