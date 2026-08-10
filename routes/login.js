const express = require('express');
const router = express.Router();
const db = require('../db');

// 学生登录密码开关（临时暂停：false 时不校验学生密码，方便先测翻牌）
const PASSWORD_ENABLED = false;

router.post('/login', (req, res) => {
  const { name, password } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ ok: false, error: '请输入姓名' });
  }

  const trimmed = name.trim();

  if (trimmed === 'teacher') {
    const correctPw = db.getTeacherPassword();
    if (password !== correctPw) {
      return res.status(401).json({ ok: false, error: '教师密码错误' });
    }
    const token = db.createSession('teacher', 'teacher');
    return res.json({ ok: true, role: 'teacher', token });
  }

  const student = db.findStudent(trimmed);
  if (!student) {
    return res.status(404).json({ ok: false, error: '该姓名不存在，请联系老师添加' });
  }

  if (PASSWORD_ENABLED && student.password && password !== student.password) {
    return res.status(401).json({ ok: false, error: '密码错误' });
  }

  const token = db.createSession('student', trimmed);
  res.json({
    ok: true, role: 'student', token,
    data: {
      name: trimmed,
      check: JSON.parse(student.check_data),
      stars: JSON.parse(student.stars_data)
    }
  });
});

module.exports = router;
