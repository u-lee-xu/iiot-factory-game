const express = require('express');
const router = express.Router();
const db = require('../db');

// 学生登录密码开关（可通过环境变量 PASSWORD_ENABLED=false 关闭，默认开启）
const PASSWORD_ENABLED = process.env.PASSWORD_ENABLED !== 'false';

router.post('/login', async (req, res) => {
  const { name, password } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ ok: false, error: '请输入姓名' });
  }

  const trimmed = name.trim();
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || '';

  // 教师登录
  if (trimmed === 'teacher') {
    const teacherPw = await db.getTeacherPassword();
    const ok = await db.verifyPassword(teacherPw, password);
    if (!ok) {
      db.recordLoginAudit('teacher', 'teacher', ip, userAgent, false);
      return res.status(401).json({ ok: false, error: '教师密码错误' });
    }

    // 检查是否必须修改密码
    const mustChange = await db.checkTeacherMustChangePassword();

    db.invalidateStudentSessions('teacher'); // 兼容旧逻辑
    const token = await db.createSession('teacher', 'teacher');
    db.recordLoginAudit('teacher', 'teacher', ip, userAgent, true);

    return res.json({ ok: true, role: 'teacher', token, mustChangePassword: mustChange });
  }

  // 学生登录
  const student = db.findStudent(trimmed);
  if (!student) {
    db.recordLoginAudit(trimmed, 'student', ip, userAgent, false);
    return res.status(404).json({ ok: false, error: '该姓名不存在，请联系老师添加' });
  }

  let passwordOk = true;
  if (PASSWORD_ENABLED) {
    passwordOk = await db.verifyPassword(student.password, password);
    if (!passwordOk) {
      const msg = await db.isDefaultPassword(student.password)
        ? '密码错误，初始密码为 123456'
        : '密码错误';
      db.recordLoginAudit(trimmed, 'student', ip, userAgent, false);
      return res.status(401).json({ ok: false, error: msg });
    }
  }

  db.recordLoginAudit(trimmed, 'student', ip, userAgent, true);
  db.incrementLoginCount(trimmed);
  // 记录登录日期/连续天数，并按连续天数发放登录签到成就（幂等）
  const loginRec = db.recordLogin(trimmed);
  if (loginRec && !loginRec.alreadyToday) {
    const achIds = db.loginAchievementIds(loginRec.streak, loginRec.firstTime);
    if (achIds.length) db.awardAchievements(trimmed, achIds);
  }
  await db.invalidateStudentSessions(trimmed);   // 单点登录：同一账号旧会话作废
  const token = await db.createSession('student', trimmed);

  // 检查学生是否必须修改密码
  const mustChange = student.must_change_password === 1 || (await db.isDefaultPassword(student.password));

  res.json({
    ok: true,
    role: 'student',
    token,
    passwordEnabled: PASSWORD_ENABLED,
    mustChangePassword: mustChange,
    data: {
      name: trimmed,
      check: JSON.parse(student.check_data || '{}'),
      stars: JSON.parse(student.stars_data || '{}')
    }
  });
});

// 获取当前用户信息（用于前端验证 token 有效性）
router.get('/me', async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return res.status(401).json({ ok: false, error: '未登录' });

  const session = db.validateSession(token);
  if (!session) return res.status(401).json({ ok: false, error: '会话已过期，请重新登录' });

  // 更新最后活动时间
  db.updateSessionActivity(token);

  if (session.role === 'teacher') {
    const mustChange = await db.checkTeacherMustChangePassword();
    return res.json({ ok: true, role: 'teacher', name: 'teacher', passwordEnabled: PASSWORD_ENABLED, mustChangePassword: mustChange });
  }

  const student = db.findStudent(session.name);
  if (!student) return res.status(404).json({ ok: false, error: '账号不存在' });

  const mustChange = student.must_change_password === 1 || (await db.isDefaultPassword(student.password));
  res.json({
    ok: true,
    role: 'student',
    name: session.name,
    passwordEnabled: PASSWORD_ENABLED,
    mustChangePassword: mustChange,
    data: {
      name: session.name,
      check: JSON.parse(student.check_data || '{}'),
      stars: JSON.parse(student.stars_data || '{}')
    }
  });
});

// 修改密码（学生/教师通用）
router.put('/password', async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return res.status(401).json({ ok: false, error: '未登录' });

  const session = db.validateSession(token);
  if (!session) return res.status(401).json({ ok: false, error: '会话已过期，请重新登录' });

  const { oldPassword, newPassword } = req.body || {};
  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 8) {
    return res.status(400).json({ ok: false, error: '新密码至少 8 位' });
  }

  if (session.role === 'teacher') {
    // 教师修改密码（需验证旧密码，除非是首次强制修改）
    const teacherPw = await db.getTeacherPassword();
    const mustChange = await db.checkTeacherMustChangePassword();

    if (!mustChange) {
      if (!oldPassword || !(await db.verifyPassword(teacherPw, oldPassword))) {
        return res.status(400).json({ ok: false, error: '原密码错误' });
      }
    }

    try {
      await db.setTeacherPassword(newPassword.trim());
    } catch (e) {
      return res.status(400).json({ ok: false, error: e.message });
    }
    return res.json({ ok: true, message: '教师密码已修改' });
  }

  // 学生修改密码
  const student = db.findStudent(session.name);
  if (!student) return res.status(404).json({ ok: false, error: '账号不存在' });

  const mustChange = student.must_change_password === 1 || (await db.isDefaultPassword(student.password));

  if (!mustChange) {
    if (!oldPassword || !(await db.verifyPassword(student.password, oldPassword))) {
      return res.status(400).json({ ok: false, error: '原密码错误' });
    }
  }

  try {
    await db.updateStudentPassword(session.name, newPassword.trim());
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }

  res.json({ ok: true, message: '密码已修改' });
});

module.exports = router;
module.exports.PASSWORD_ENABLED = PASSWORD_ENABLED;
