const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../auth');
const { getContent } = require('./game');

// 判断某关卡是否全部非 auto 任务完成
function levelCompleted(check, level) {
  let done = 0, total = 0;
  (level.tasks || []).forEach(t => {
    if (t.auto) return;
    total++;
    if (check['' + t.id]) done++;
  });
  return total > 0 && done >= total;
}

router.get('/me', requireAuth, (req, res) => {
  if (req.session.role !== 'student') {
    return res.status(403).json({ ok: false, error: '仅学生可访问' });
  }
  const student = db.findStudent(req.session.name);
  if (!student) {
    return res.status(404).json({ ok: false, error: '账号不存在' });
  }
  res.json({
    ok: true,
    data: {
      name: student.name,
      check: JSON.parse(student.check_data),
      stars: JSON.parse(student.stars_data),
      achievements: JSON.parse(student.achievements || '{}'),
      levelFinishTimes: JSON.parse(student.level_finish_times || '{}'),
      hasPassword: !!student.password
    }
  });
});

router.put('/me', requireAuth, (req, res) => {
  if (req.session.role !== 'student') {
    return res.status(403).json({ ok: false, error: '仅学生可访问' });
  }
  const { check, stars, achievements } = req.body || {};
  const student = db.findStudent(req.session.name);
  if (!student) {
    return res.status(404).json({ ok: false, error: '账号不存在' });
  }

  const currentCheck = check || JSON.parse(student.check_data);
  const currentStars = stars || JSON.parse(student.stars_data);
  const oldCheck = JSON.parse(student.check_data);

  db.updateStudentData(req.session.name, currentCheck, currentStars);

  const patch = {};
  if (achievements) patch.achievements = achievements;

  // 检测新完成关卡，记录首次完成时间（用于先锋判定）
  const contentRes = getContent();
  if (contentRes.ok && contentRes.data && contentRes.data.levels) {
    const finishTimes = JSON.parse(student.level_finish_times || '{}');
    let changed = false;
    contentRes.data.levels.forEach(lv => {
      if (finishTimes[lv.id]) return;
      if (!levelCompleted(oldCheck, lv) && levelCompleted(currentCheck, lv)) {
        finishTimes[lv.id] = new Date().toISOString();
        changed = true;
      }
    });
    if (changed) patch.levelFinishTimes = finishTimes;
  }

  if (Object.keys(patch).length) db.updateStudentMeta(req.session.name, patch);
  res.json({ ok: true });
});

// 学生设置/修改登录密码
router.put('/password', requireAuth, (req, res) => {
  if (req.session.role !== 'student') {
    return res.status(403).json({ ok: false, error: '仅学生可操作' });
  }
  const { oldPassword, newPassword } = req.body || {};
  const student = db.findStudent(req.session.name);
  if (!student) {
    return res.status(404).json({ ok: false, error: '账号不存在' });
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
    return res.status(400).json({ ok: false, error: '新密码至少 4 位' });
  }
  if (student.password) {
    if (!oldPassword || oldPassword !== student.password) {
      return res.status(400).json({ ok: false, error: '原密码错误' });
    }
  }
  db.updateStudentPassword(req.session.name, newPassword.trim());
  res.json({ ok: true });
});

module.exports = router;
