const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'game.db');
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

  // 迁移：旧库补充 achievements / level_finish_times 列
  const info = db.exec('PRAGMA table_info(students)');
  const cols = info.length ? info[0].values : [];
  const hasCol = name => cols.some(c => c[1] === name);
  if (!hasCol('achievements')) db.exec("ALTER TABLE students ADD COLUMN achievements TEXT DEFAULT '{}'");
  if (!hasCol('level_finish_times')) db.exec("ALTER TABLE students ADD COLUMN level_finish_times TEXT DEFAULT '{}'");

  save();
}

function findStudent(name) {
  return queryOne('SELECT * FROM students WHERE name = ?', [name]);
}

function createStudent(name) {
  try {
    exec('INSERT INTO students (name) VALUES (?)', [name]);
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
  return queryAll('SELECT id, name, password, check_data, stars_data, achievements, level_finish_times, created_at FROM students ORDER BY name');
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
  getTeacherPassword, createSession, validateSession, cleanupExpiredSessions
};
