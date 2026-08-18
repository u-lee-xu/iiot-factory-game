const db = require('./db');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: '未登录' });
  }
  const token = header.slice(7);
  db.cleanupExpiredSessions();
  const session = db.validateSession(token);
  if (!session) {
    return res.status(401).json({ ok: false, error: '登录已过期，请重新登录' });
  }
  req.session = session;
  next();
}

function requireTeacher(req, res, next) {
  if (req.session.role !== 'teacher') {
    return res.status(403).json({ ok: false, error: '仅教师可执行此操作' });
  }
  next();
}

// 可选：检查是否必须修改密码（不阻断请求，仅在 res.locals 标记）
async function checkMustChangePassword(req, res, next) {
  if (req.session.role === 'teacher') {
    req.mustChangePassword = await db.checkTeacherMustChangePassword();
  } else {
    const student = db.findStudent(req.session.name);
    req.mustChangePassword = student?.must_change_password === 1 || await db.isDefaultPassword(student?.password);
  }
  next();
}

module.exports = { requireAuth, requireTeacher, checkMustChangePassword };
