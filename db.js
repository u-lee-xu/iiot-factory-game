const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'game.db');
const DEFAULT_PASSWORD = '123456';
function isDefaultPassword(pw) { return !pw || pw === DEFAULT_PASSWORD; }
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let db;

function save() {
  if (!db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
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
    password TEXT NOT NULL DEFAULT 'admin123'
  )`);
  db.exec(`INSERT OR IGNORE INTO teacher (id, password) VALUES (1, 'admin123')`);
  db.exec(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS bug_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT DEFAULT '',
    content TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )`);

  // 迁移：旧库补充 achievements / level_finish_times 列
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

  save();
}

function findStudent(name) {
  return queryOne('SELECT * FROM students WHERE name = ?', [name]);
}

function createStudent(name) {
  try {
    exec('INSERT INTO students (name, password) VALUES (?, ?)', [name, DEFAULT_PASSWORD]);
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
  return queryAll('SELECT id, name, password, check_data, stars_data, achievements, level_finish_times, created_at, login_count, last_login_date, login_streak FROM students ORDER BY name');
}

function updateStudentData(name, checkData, starsData) {
  exec('UPDATE students SET check_data = ?, stars_data = ? WHERE name = ?',
    [JSON.stringify(checkData), JSON.stringify(starsData), name]);
  save();
  return true;
}

function updateStudentStars(name, levelId, teacherStars) {
  const student = findStudent(name);
  if (!student) return null;
  const stars = JSON.parse(student.stars_data);
  if (!stars[levelId]) stars[levelId] = { self: 0, peer: 0, teacher: 0 };
  stars[levelId].teacher = teacherStars;
  exec('UPDATE students SET stars_data = ? WHERE name = ?', [JSON.stringify(stars), name]);
  save();
  return stars;
}

function updateStudentMeta(name, patch) {
  const student = findStudent(name);
  if (!student) return false;
  const achievements = Object.assign({}, JSON.parse(student.achievements || '{}'), patch.achievements || {});
  const finishTimes = Object.assign({}, JSON.parse(student.level_finish_times || '{}'), patch.levelFinishTimes || {});
  exec('UPDATE students SET achievements = ?, level_finish_times = ? WHERE name = ?',
    [JSON.stringify(achievements), JSON.stringify(finishTimes), name]);
  save();
  return true;
}

function localDateString(d) { d = d || new Date(); const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0'); return y+'-'+m+'-'+dd; }

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

// ===== 工资 & 商城（钱包） =====
const SALARY_TABLE = [
  { min: 0,    rate: 100 },
  { min: 1000, rate: 200 },
  { min: 2500, rate: 350 },
  { min: 4500, rate: 500 },
  { min: 7000, rate: 800 }
];
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

// 每次成功登录 +1（登录次数）
function incrementLoginCount(name) {
  exec('UPDATE students SET login_count = login_count + 1 WHERE name = ?', [name]);
  save();
  return true;
}

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

function updateStudentPassword(name, password) {
  if (!findStudent(name)) return false;
  exec('UPDATE students SET password = ? WHERE name = ?', [password, name]);
  save();
  return true;
}

function resetStudent(name) {
  exec("UPDATE students SET check_data = '{}', stars_data = '{}' WHERE name = ?", [name]);
  save();
  return true;
}

function getTeacherPassword() {
  const row = queryOne('SELECT password FROM teacher WHERE id = 1');
  return row ? row.password : 'admin123';
}

function createSession(role, name) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  exec('INSERT INTO sessions (token, role, name, expires_at) VALUES (?, ?, ?, ?)',
    [token, role, name, expiresAt]);
  save();
  return token;
}

function validateSession(token) {
  return queryOne("SELECT role, name FROM sessions WHERE token = ? AND expires_at > datetime('now')", [token]);
}

function cleanupExpiredSessions() {
  exec("DELETE FROM sessions WHERE expires_at < datetime('now')");
  save();
}

module.exports = {
  init, save,
  findStudent, createStudent, deleteStudent, listStudents,
  updateStudentData, updateStudentStars, updateStudentMeta, updateStudentPassword, resetStudent,
  getTeacherPassword, createSession, validateSession, cleanupExpiredSessions,
  DEFAULT_PASSWORD, isDefaultPassword,
  recordLogin, incrementLoginCount, awardAchievements, awardTeacherAchievements,
  addBugReport, listBugReports, deleteBugReport,
  // 工资 & 商城
  localDateString, salaryRate, calcStudentXP, getWallet, claimSalary, addInventory, consumeInventory, setCoins
};
