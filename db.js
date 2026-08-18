const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'game.db');
const DEFAULT_PASSWORD = '123456';
const TEACHER_DEFAULT_PASSWORD = 'admin123';
const BCRYPT_ROUNDS = 12;

// 密码策略常量
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REQUIRE_UPPER = true;
const PASSWORD_REQUIRE_LOWER = true;
const PASSWORD_REQUIRE_NUMBER = true;
const PASSWORD_REQUIRE_SPECIAL = false;

// 密码哈希（bcrypt）
async function hashPassword(pw) {
  return await bcrypt.hash(String(pw), BCRYPT_ROUNDS);
}

// 验证密码（bcrypt 优先，兼容旧 SHA256 与明文）
async function verifyPassword(stored, input) {
  if (!stored) return input === DEFAULT_PASSWORD;
  // 是 bcrypt 哈希（$2a/$2b/$2y$ 开头）才用 bcrypt 验证
  if (/^\$2[aby]\$/.test(String(stored))) {
    try { return await bcrypt.compare(String(input), stored); } catch (e) { return false; }
  }
  // 旧 SHA256 哈希
  if (isHashed(stored)) return crypto.createHash('sha256').update(String(input)).digest('hex') === stored;
  // 明文（旧库 / teacher 默认密码 admin123）
  return stored === input;
}

// 判断是否为旧版 SHA256 哈希
function isHashed(pw) {
  return typeof pw === 'string' && pw.length === 64 && /^[0-9a-f]{64}$/.test(pw);
}

// 判断是否为默认密码
async function isDefaultPassword(pw) {
  if (!pw) return true;
  try {
    return await bcrypt.compare(DEFAULT_PASSWORD, pw);
  } catch {
    return isHashed(pw) && crypto.createHash('sha256').update(DEFAULT_PASSWORD).digest('hex') === pw;
  }
}

// 密码强度校验
function validatePasswordStrength(pw) {
  const errors = [];
  if (!pw || pw.length < PASSWORD_MIN_LENGTH) {
    errors.push(`密码长度至少 ${PASSWORD_MIN_LENGTH} 位`);
  }
  if (PASSWORD_REQUIRE_UPPER && !/[A-Z]/.test(pw)) {
    errors.push('必须包含大写字母');
  }
  if (PASSWORD_REQUIRE_LOWER && !/[a-z]/.test(pw)) {
    errors.push('必须包含小写字母');
  }
  if (PASSWORD_REQUIRE_NUMBER && !/[0-9]/.test(pw)) {
    errors.push('必须包含数字');
  }
  if (PASSWORD_REQUIRE_SPECIAL && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)) {
    errors.push('必须包含特殊字符');
  }
  return { valid: errors.length === 0, errors };
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let db;

function save() {
  if (!db) return;
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, Buffer.from(db.export()));
  fs.renameSync(tmp, DB_PATH);   // 原子替换，避免中途被杀损坏库
}

function exec(sql, params) {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  try { stmt.step(); } finally { stmt.free(); }
}

function queryOne(sql, params) {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  try {
    if (stmt.step()) return stmt.getAsObject();
    return null;
  } finally { stmt.free(); }
}

function queryAll(sql, params) {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const rows = [];
  try { while (stmt.step()) rows.push(stmt.getAsObject()); } finally { stmt.free(); }
  return rows;
}

async function init() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  db.exec(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    password TEXT DEFAULT '',
    check_data TEXT DEFAULT '{}',
    stars_data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS teacher (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    password TEXT NOT NULL DEFAULT '',
    password_changed_at TEXT,
    must_change_password INTEGER DEFAULT 1
  )`);
  // 初始化教师账号（密码为空，首次登录强制修改）
  const teacherRow = db.exec("SELECT * FROM teacher WHERE id = 1");
  if (!teacherRow.length || !teacherRow[0].values.length) {
    const hashed = await hashPassword(TEACHER_DEFAULT_PASSWORD);
    db.exec(`INSERT INTO teacher (id, password, must_change_password) VALUES (1, ?, 1)`, [hashed]);
  }
  db.exec(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    last_activity_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS bug_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT DEFAULT '',
    content TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS login_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    success INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )`);

  // 迁移：旧库补充列
  const info = db.exec('PRAGMA table_info(students)');
  const cols = info.length ? info[0].values : [];
  const hasCol = name => cols.some(c => c[1] === name);
  if (!hasCol('achievements')) db.exec("ALTER TABLE students ADD COLUMN achievements TEXT DEFAULT '{}'");
  if (!hasCol('level_finish_times')) db.exec("ALTER TABLE students ADD COLUMN level_finish_times TEXT DEFAULT '{}'");
  if (!hasCol('teacher_awards')) db.exec("ALTER TABLE students ADD COLUMN teacher_awards TEXT DEFAULT '{}'");
  if (!hasCol('last_login_date')) db.exec("ALTER TABLE students ADD COLUMN last_login_date TEXT");
  if (!hasCol('login_streak')) db.exec("ALTER TABLE students ADD COLUMN login_streak INTEGER DEFAULT 0");
  if (!hasCol('login_count')) db.exec("ALTER TABLE students ADD COLUMN login_count INTEGER DEFAULT 0");
  if (!hasCol('coins')) db.exec("ALTER TABLE students ADD COLUMN coins INTEGER DEFAULT 0");
  if (!hasCol('inventory')) db.exec("ALTER TABLE students ADD COLUMN inventory TEXT DEFAULT '{}'");
  if (!hasCol('last_salary_date')) db.exec("ALTER TABLE students ADD COLUMN last_salary_date TEXT");
  if (!hasCol('month_salary_total')) db.exec("ALTER TABLE students ADD COLUMN month_salary_total INTEGER DEFAULT 0");
  if (!hasCol('login_ach_notified')) db.exec("ALTER TABLE students ADD COLUMN login_ach_notified TEXT DEFAULT '{}'");
  if (!hasCol('password_changed_at')) db.exec("ALTER TABLE students ADD COLUMN password_changed_at TEXT");
  if (!hasCol('must_change_password')) db.exec("ALTER TABLE students ADD COLUMN must_change_password INTEGER DEFAULT 1");

  // 迁移教师表
  const teacherInfo = db.exec('PRAGMA table_info(teacher)');
  const teacherCols = teacherInfo.length ? teacherInfo[0].values : [];
  const hasTeacherCol = name => teacherCols.some(c => c[1] === name);
  if (!hasTeacherCol('password_changed_at')) db.exec("ALTER TABLE teacher ADD COLUMN password_changed_at TEXT");
  if (!hasTeacherCol('must_change_password')) db.exec("ALTER TABLE teacher ADD COLUMN must_change_password INTEGER DEFAULT 1");

  // 迁移 sessions 表（旧库缺 created_at/last_activity_at）
  const sessInfo = db.exec('PRAGMA table_info(sessions)');
  const sessCols = sessInfo.length ? sessInfo[0].values : [];
  const hasSessCol = name => sessCols.some(c => c[1] === name);
  if (!hasSessCol('created_at')) db.exec("ALTER TABLE sessions ADD COLUMN created_at TEXT");
  if (!hasSessCol('last_activity_at')) db.exec("ALTER TABLE sessions ADD COLUMN last_activity_at TEXT");

  save();
}

function findStudent(name) {
  return queryOne('SELECT * FROM students WHERE name = ?', [name]);
}

async function createStudent(name) {
  try {
    const hashed = await hashPassword(DEFAULT_PASSWORD);
    exec('INSERT INTO students (name, password, must_change_password) VALUES (?, ?, 1)', [name, hashed]);
    save();
    return findStudent(name);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return null;
    throw e;
  }
}

function deleteStudent(name) {
  if (!findStudent(name)) return false;
  exec('DELETE FROM students WHERE name = ?', [name]);
  save();
  return true;
}

function listStudents() {
  return queryAll('SELECT id, name, password, check_data, stars_data, achievements, level_finish_times, created_at, login_count, last_login_date, login_streak, password_changed_at, must_change_password FROM students ORDER BY name');
}

function updateStudentData(name, checkData, starsData) {
  const validLevels = new Set();
  const { getContent } = require('./routes/game');
  const contentRes = getContent();
  if (contentRes.ok && contentRes.data && contentRes.data.levels) {
    contentRes.data.levels.forEach(lv => validLevels.add(String(lv.id)));
  }

  let currentCheck = checkData || {};
  if (typeof currentCheck === 'object' && !Array.isArray(currentCheck)) {
    const filtered = {};
    Object.keys(currentCheck).forEach(k => {
      if (validLevels.has(String(k))) {
        const v = currentCheck[k];
        filtered[k] = (v && v.half) ? { half: true } : true;
      }
    });
    if (Object.keys(filtered).length > 0 || Object.keys(currentCheck).length === 0) {
      currentCheck = filtered;
    }
  }

  let currentStars = {};
  if (starsData && typeof starsData === 'object' && !Array.isArray(starsData)) {
    Object.keys(starsData).forEach(k => {
      if (validLevels.has(String(k))) {
        const s2 = starsData[k] || {};
        currentStars[k] = {
          self: Math.max(0, Number(s2.self) || 0),
          peer: Math.max(0, Number(s2.peer) || 0),
          teacher: Math.max(0, Number(s2.teacher) || 0)
        };
      }
    });
  }

  exec('UPDATE students SET check_data = ?, stars_data = ? WHERE name = ?',
    [JSON.stringify(currentCheck), JSON.stringify(currentStars), name]);
  save();
}

function updateStudentStars(name, levelId, teacherStars) {
  const student = findStudent(name);
  if (!student) return null;
  const stars = JSON.parse(student.stars_data || '{}');
  const cur = stars[levelId] || { self: 0, peer: 0, teacher: 0 };
  cur.teacher = Math.max(0, Math.min(5, Math.floor(teacherStars)));
  stars[levelId] = cur;
  exec('UPDATE students SET stars_data = ? WHERE name = ?', [JSON.stringify(stars), name]);
  save();
  return stars;
}

function updateStudentMeta(name, patch) {
  const student = findStudent(name);
  if (!student) return null;
  const fields = [];
  const params = [];
  if (patch.achievements !== undefined) { fields.push('achievements = ?'); params.push(JSON.stringify(patch.achievements)); }
  if (patch.levelFinishTimes !== undefined) { fields.push('level_finish_times = ?'); params.push(JSON.stringify(patch.levelFinishTimes)); }
  if (patch.teacherAwards !== undefined) { fields.push('teacher_awards = ?'); params.push(JSON.stringify(patch.teacherAwards)); }
  if (patch.loginAchNotified !== undefined) { fields.push('login_ach_notified = ?'); params.push(JSON.stringify(patch.loginAchNotified)); }
  if (!fields.length) return;
  params.push(name);
  exec(`UPDATE students SET ${fields.join(', ')} WHERE name = ?`, params);
  save();
}

async function updateStudentPassword(name, password) {
  const student = findStudent(name);
  if (!student) return false;

  const validation = validatePasswordStrength(password);
  if (!validation.valid) {
    throw new Error(validation.errors.join('，'));
  }

  const hashed = await hashPassword(password);
  exec('UPDATE students SET password = ?, password_changed_at = datetime(\'now\'), must_change_password = 0 WHERE name = ?',
    [hashed, name]);
  save();
  return true;
}

function resetStudent(name) {
  exec("UPDATE students SET check_data = '{}', stars_data = '{}', achievements = '{}', level_finish_times = '{}', teacher_awards = '{}' WHERE name = ?", [name]);
  save();
  return true;
}

async function getTeacherPassword() {
  const row = queryOne('SELECT password FROM teacher WHERE id = 1');
  return row ? row.password : '';
}

async function checkTeacherMustChangePassword() {
  const row = queryOne('SELECT must_change_password FROM teacher WHERE id = 1');
  return row ? Boolean(row.must_change_password) : true;
}

async function setTeacherPassword(password) {
  const validation = validatePasswordStrength(password);
  if (!validation.valid) {
    throw new Error(validation.errors.join('，'));
  }
  const hashed = await hashPassword(password);
  exec('UPDATE teacher SET password = ?, password_changed_at = datetime(\'now\'), must_change_password = 0 WHERE id = 1', [hashed]);
  save();
  return true;
}

async function createSession(role, name) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  exec('INSERT INTO sessions (token, role, name, expires_at, created_at, last_activity_at) VALUES (?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))',
    [token, role, name, expiresAt]);
  save();
  return token;
}

// 单点登录：同一账号（学生）重新登录时，作废其所有旧会话（旧 token 立即失效）
function invalidateStudentSessions(name) {
  exec("DELETE FROM sessions WHERE role='student' AND name=?", [name]);
  save();
}

function validateSession(token) {
  return queryOne("SELECT role, name FROM sessions WHERE token = ? AND expires_at > datetime('now')", [token]);
}

// 更新会话最后活动时间
function updateSessionActivity(token) {
  exec("UPDATE sessions SET last_activity_at = datetime('now') WHERE token = ?", [token]);
  // 不 save()，避免高频写盘，由 cleanupExpiredSessions 批量处理
}

// 记录登录审计
function recordLoginAudit(name, role, ip, userAgent, success) {
  exec('INSERT INTO login_audit (name, role, ip, user_agent, success) VALUES (?, ?, ?, ?, ?)',
    [name, role, ip || '', userAgent || '', success ? 1 : 0]);
  save();
}

// 登录计数
function incrementLoginCount(name) {
  exec('UPDATE students SET login_count = login_count + 1 WHERE name = ?', [name]);
  save();
  return true;
}

// 记录登录（初次登录 / 连续天数），幂等：同一天只算一次
function recordLogin(name) {
  const student = findStudent(name);
  if (!student) return null;
  const today = localDateString();
  const last = student.last_login_date || '';
  const yest = localDateString(new Date(Date.now() - 86400000));
  let firstTime = false, alreadyToday = false;
  let streak = parseInt(student.login_streak || 0, 10);
  if (!last) { firstTime = true; streak = 1; }
  else if (last === today) { alreadyToday = true; }
  else if (last === yest) { streak += 1; }
  else { streak = 1; }
  if (!alreadyToday) {
    exec('UPDATE students SET last_login_date = ?, login_streak = ? WHERE name = ?', [today, streak, name]);
    save();
  }
  return { firstTime, streak, alreadyToday, lastLoginDate: today };
}

// ===== 登录签到成就（与前端 achievements-meta.js 的 login_* 对应） =====
const LOGIN_ACH_MILESTONES = [
  { id: 'login_first', min: 1, firstOnly: true },
  { id: 'login_3', min: 3 },
  { id: 'login_7', min: 7 },
  { id: 'login_14', min: 14 },
  { id: 'login_30', min: 30 }
];

// 按连续登录天数算出应发放的登录成就 id（发放本身走 awardAchievements，幂等）
function loginAchievementIds(streak, firstTime) {
  const ids = [];
  LOGIN_ACH_MILESTONES.forEach(m => {
    if (m.firstOnly) { if (firstTime) ids.push(m.id); }
    else if (streak >= m.min) ids.push(m.id);
  });
  return ids;
}

// 已发放但尚未提示过（login_ach_notified 中无记录）的登录成就
// 前端弹完签到成就后会调 POST /api/student/notify-login-ach 标记，避免换设备/清缓存重复弹
function newlyAwardedLoginIds(student) {
  if (!student) return [];
  let ach = {}, notified = {};
  try { ach = JSON.parse(student.achievements || '{}'); } catch (e) {}
  try { notified = JSON.parse(student.login_ach_notified || '{}'); } catch (e) {}
  return Object.keys(ach).filter(id => id.indexOf('login_') === 0 && !notified[id]);
}

// ===== 工资 & 商城（钱包） =====
const SALARY_TABLE = [
  { min: 0,    rate: 100 },
  { min: 1000, rate: 200 },
  { min: 2500, rate: 350 },
  { min: 4500, rate: 500 },
  { min: 7000, rate: 800 }
];

function localDateString(d) { d = d || new Date(); const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0'); return y+'-'+m+'-'+dd; }

function salaryRate(xp) {
  let r = SALARY_TABLE[0];
  for (const row of SALARY_TABLE) if (xp >= row.min) r = row;
  return r.rate;
}

// 与前端 calcTotalXP 一致
function calcStudentXP(student, content) {
  let xp = 0;
  const check = (() => { try { return JSON.parse(student.check_data || '{}'); } catch (e) { return {}; } })();
  (content.levels || []).forEach(lv => {
    (lv.tasks || []).forEach(t => {
      const c = check[t.id];
      if (!c) return;
      let full = t.xp || 100;
      if (t.hidden) full = 300;
      else if (t.type === 'quiz' && (t.xp || 0) <= 50) full = 50;
      else if (t.xp === 0) full = 0;
      xp += (c && c.half) ? Math.floor(full / 2) : full;
    });
  });
  return xp;
}

function getWallet(name) {
  const s = findStudent(name);
  if (!s) return null;
  let inv = {};
  try { inv = JSON.parse(s.inventory || '{}'); } catch (e) {}
  return {
    coins: parseInt(s.coins || 0, 10),
    inventory: inv,
    lastSalaryDate: s.last_salary_date || '',
    monthSalaryTotal: parseInt(s.month_salary_total || 0, 10)
  };
}

// 领取当日工资（一天一次），返回是否领到
function claimSalary(name, xp) {
  const s = findStudent(name);
  if (!s) return null;
  const today = localDateString();
  const last = s.last_salary_date || '';
  if (last === today) return getWallet(name);
  const amount = salaryRate(xp);
  let coins = parseInt(s.coins || 0, 10) + amount;
  let monthTotal = parseInt(s.month_salary_total || 0, 10);
  if (last && last.slice(0, 7) !== today.slice(0, 7)) monthTotal = 0;   // 跨月重置
  monthTotal += amount;
  exec('UPDATE students SET coins = ?, month_salary_total = ?, last_salary_date = ? WHERE name = ?',
    [coins, monthTotal, today, name]);
  save();
  return getWallet(name);
}

function addInventory(name, itemId, n) {
  const inv = getWallet(name).inventory;
  inv[itemId] = (inv[itemId] || 0) + (n || 1);
  exec('UPDATE students SET inventory = ? WHERE name = ?', [JSON.stringify(inv), name]);
  save();
  return inv;
}

function consumeInventory(name, itemId, n) {
  const inv = getWallet(name).inventory;
  if (!inv[itemId]) return null;
  inv[itemId] -= (n || 1);
  if (inv[itemId] <= 0) delete inv[itemId];
  exec('UPDATE students SET inventory = ? WHERE name = ?', [JSON.stringify(inv), name]);
  save();
  return inv;
}

function setCoins(name, coins) {
  exec('UPDATE students SET coins = ? WHERE name = ?', [Math.max(0, Math.floor(coins || 0)), name]);
  save();
  return true;
}

// 发放成就：已存在的不覆盖，返回新增/已存在
function awardAchievements(name, ids) {
  const student = findStudent(name);
  if (!student) return null;
  const ach = JSON.parse(student.achievements || '{}');
  const awarded = [], exists = [];
  (ids || []).forEach(id => {
    if (ach[id]) exists.push(id);
    else { ach[id] = new Date().toISOString(); awarded.push(id); }
  });
  if (awarded.length) {
    exec('UPDATE students SET achievements = ? WHERE name = ?', [JSON.stringify(ach), name]);
    save();
  }
  return { awarded, exists };
}

function markLoginAchNotified(name, ids) {
  const student = findStudent(name);
  if (!student) return null;
  let n = {};
  try { n = JSON.parse(student.login_ach_notified || '{}'); } catch(e){}
  (ids || []).forEach(id => { if (id.indexOf('login_') === 0) n[id] = 1; });
  exec('UPDATE students SET login_ach_notified = ? WHERE name = ?', [JSON.stringify(n), name]);
  save();
  return n;
}

// 教师手动发放成就：同时记入 achievements（展示已解锁）与 teacher_awards（来源标记，供学生端动画）
function awardTeacherAchievements(name, ids) {
  const student = findStudent(name);
  if (!student) return null;
  const ach = JSON.parse(student.achievements || '{}');
  const ta = JSON.parse(student.teacher_awards || '{}');
  const awarded = [], exists = [];
  (ids || []).forEach(id => {
    if (ach[id]) exists.push(id);
    else { const ts = new Date().toISOString(); ach[id] = ts; ta[id] = ts; awarded.push(id); }
  });
  if (awarded.length) {
    exec('UPDATE students SET achievements = ?, teacher_awards = ? WHERE name = ?', [JSON.stringify(ach), JSON.stringify(ta), name]);
    save();
  }
  return { awarded, exists };
}

// ===== Bug 反馈 =====
function addBugReport(name, location, content) {
  exec('INSERT INTO bug_reports (name, location, content) VALUES (?, ?, ?)', [name, location || '', content]);
  save();
  return true;
}

function listBugReports() {
  return queryAll('SELECT id, name, location, content, status, created_at FROM bug_reports ORDER BY id DESC');
}

function deleteBugReport(id) {
  exec('DELETE FROM bug_reports WHERE id = ?', [id]);
  save();
  return true;
}

let _lastCleanup = 0;
function cleanupExpiredSessions() {
  const now = Date.now();
  if (now - _lastCleanup < 60000) return;   // 最多每分钟清一次，避免每次请求全量写盘
  _lastCleanup = now;
  exec("DELETE FROM sessions WHERE expires_at < datetime('now')");
  if (db.getRowsModified && db.getRowsModified() > 0) save();
}

module.exports = {
  init, save, queryAll,
  findStudent, createStudent, deleteStudent, listStudents,
  updateStudentData, updateStudentStars, updateStudentMeta, updateStudentPassword, resetStudent,
  getTeacherPassword, checkTeacherMustChangePassword, setTeacherPassword,
  createSession, validateSession, cleanupExpiredSessions, invalidateStudentSessions, updateSessionActivity,
  DEFAULT_PASSWORD, TEACHER_DEFAULT_PASSWORD, isDefaultPassword, hashPassword, verifyPassword, isHashed, validatePasswordStrength,
  recordLoginAudit, incrementLoginCount, awardAchievements, awardTeacherAchievements, markLoginAchNotified,
  addBugReport, listBugReports, deleteBugReport, recordLogin, loginAchievementIds, newlyAwardedLoginIds,
  // 工资 & 商城
  localDateString, salaryRate, calcStudentXP, getWallet, claimSalary, addInventory, consumeInventory, setCoins
};
