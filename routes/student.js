const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../auth');
const { getContent } = require('./game');

// ===== 商城目录（服务端统一定价，前端展示用 /shop 拉取） =====
const SHOP_ITEMS = {
  hint_card:   { id: 'hint_card',   name: '提示卡',   emoji: '📝', price: 200,  desc: '关卡卡住时给 1 条提示', type: 'task' },
  pass_card:   { id: 'pass_card',   name: '免错金牌', emoji: '🛡️', price: 300,  desc: '本局第 1 次答错不扣 XP', type: 'task' },
  slow_card:   { id: 'slow_card',   name: '慢速卡',   emoji: '⏳', price: 250,  desc: '蜂群敌人全场缓速 8 秒', type: 'shooter' },
  power_card:  { id: 'power_card',  name: '火力礼包', emoji: '🚀', price: 500,  desc: '蜂群开局直接 2 级火力', type: 'shooter' },
  shield_card: { id: 'shield_card', name: '开局护盾', emoji: '❤️', price: 400,  desc: '蜂群/防御战开局 +1 命', type: 'shooter' },
  plane_skin:  { id: 'plane_skin',  name: '黄金战机', emoji: '✈️', price: 800,  desc: '蜂群飞机黄金涂装（永久）', type: 'skin' },
  plane_red:   { id: 'plane_red',   name: '烈焰红',   emoji: '🔥', price: 800,  desc: '蜂群飞机烈焰红涂装（永久）', type: 'skin' },
  plane_blue:  { id: 'plane_blue',  name: '冰晶蓝',   emoji: '❄️', price: 800,  desc: '蜂群飞机冰晶蓝涂装（永久）', type: 'skin' },
  plane_purple:{ id: 'plane_purple',name: '紫电',     emoji: '⚡', price: 800,  desc: '蜂群飞机紫色涂装（永久）', type: 'skin' },
  plane_neon:  { id: 'plane_neon',  name: '霓虹',     emoji: '🌈', price: 1200, desc: '蜂群飞机霓虹涂装（永久）', type: 'skin' },
  enemy_night: { id: 'enemy_night', name: '夜战迷彩', emoji: '🌙', price: 600,  desc: '蜂群敌人夜战迷彩（永久）', type: 'enemy_skin' },
  enemy_matrix:{ id: 'enemy_matrix',name: '矩阵绿',   emoji: '🟩', price: 600,  desc: '蜂群敌人矩阵绿（永久）', type: 'enemy_skin' },
  enemy_lava:  { id: 'enemy_lava',  name: '岩浆橙',   emoji: '🌋', price: 600,  desc: '蜂群敌人岩浆橙（永久）', type: 'enemy_skin' },
  enemy_ice:   { id: 'enemy_ice',   name: '寒冰蓝',   emoji: '🧊', price: 600,  desc: '蜂群敌人寒冰蓝（永久）', type: 'enemy_skin' },
  enemy_void:  { id: 'enemy_void',  name: '紫雾',     emoji: '🟣', price: 600,  desc: '蜂群敌人紫雾（永久）', type: 'enemy_skin' },
  title_badge: { id: 'title_badge', name: '专属称号', emoji: '🏅', price: 1000, desc: '排行榜显示「厂级先锋」头衔（永久）', type: 'title' }
};
function shopCatalog() { return Object.values(SHOP_ITEMS); }

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

router.post('/notify-login-ach', requireAuth, (req, res) => {
  const { ids } = req.body || {};
  const list = Array.isArray(ids) ? ids.map(String).filter(id => id.indexOf('login_') === 0) : [];
  if (list.length) db.markLoginAchNotified(req.session.name, list);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  if (req.session.role !== 'student') {
    return res.status(403).json({ ok: false, error: '仅学生可访问' });
  }
  let student = db.findStudent(req.session.name);
  if (!student) {
    return res.status(404).json({ ok: false, error: '账号不存在' });
  }
  // 登录签到（系统自动发放）：初次登录 / 连续登录成就
  let salaryJustClaimed = false;
  let newlyAwardedLogin = [];   // 本次真正新授予的登录成就（仅本次首次登录授予，客户端据此提示一次）
  const login = db.recordLogin(req.session.name);
  if (login && !login.alreadyToday) {
    const toAward = [];
    if (login.firstTime) toAward.push('login_first');
    const st = login.streak || 0;
    if (st >= 3) toAward.push('login_3');
    if (st >= 7) toAward.push('login_7');
    if (st >= 14) toAward.push('login_14');
    if (st >= 30) toAward.push('login_30');
    if (toAward.length) {
      db.awardAchievements(req.session.name, toAward);
    }
    // 上班打卡：新的一天登录自动领当日工资
    const cr = getContent();
    if (cr.ok && cr.data) {
      const xp0 = db.calcStudentXP(student, cr.data);
      db.claimSalary(req.session.name, xp0);
      salaryJustClaimed = true;
    }
    student = db.findStudent(req.session.name);
  }
  // 登录签到成就提示：返回"当天新授予"的 login_*（客户端据此提示一次）。
  // 用 achievements 里各 login 成就的授予日期判断——同一天首次 /me 授予后，后续 /me 也会返回，
  // 客户端以 seen 快照挡重复；张三这种历史授予的不会返回，避免每次进入都弹。
  const todayStr = db.localDateString();
  const achAll = JSON.parse(student.achievements || '{}');
  let notifiedLogin = {};
  try { notifiedLogin = JSON.parse(student.login_ach_notified || '{}'); } catch(e){}
  Object.keys(achAll).forEach(id => {
    if (id.indexOf('login_') === 0 && achAll[id] && String(achAll[id]).slice(0, 10) === todayStr && !notifiedLogin[id]) newlyAwardedLogin.push(id);
  });
  // 钱包信息
  const contentRes2 = getContent();
  const xp = (contentRes2.ok && contentRes2.data) ? db.calcStudentXP(student, contentRes2.data) : 0;
  const wallet = db.getWallet(student.name);
  const rate = db.salaryRate(xp);
  res.json({
    ok: true,
    data: {
      name: student.name,
      check: JSON.parse(student.check_data),
      stars: JSON.parse(student.stars_data),
      achievements: JSON.parse(student.achievements || '{}'),
      teacherAwards: JSON.parse(student.teacher_awards || '{}'),
      levelFinishTimes: JSON.parse(student.level_finish_times || '{}'),
      hasPassword: !db.isDefaultPassword(student.password),
      newlyAwardedLogin: newlyAwardedLogin,
      loginCount: student.login_count || 0,
      loginStreak: student.login_streak || 0,
      coins: wallet.coins,
      inventory: wallet.inventory,
      salaryInfo: {
        rate: rate,
        xp: xp,
        lastSalaryDate: wallet.lastSalaryDate,
        monthTotal: wallet.monthSalaryTotal,
        claimedToday: wallet.lastSalaryDate === db.localDateString(),
        justClaimed: salaryJustClaimed
      }
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

  const contentRes = getContent();
  const validTasks = new Set();
  const validLevels = new Set();
  if (contentRes.ok && contentRes.data) {
    contentRes.data.levels.forEach(lv => {
      validLevels.add(String(lv.id));
      (lv.tasks || []).forEach(t => validTasks.add(String(t.id)));
    });
  }
  // 校验 check：只保留合法任务 id；空对象不允许覆盖已有进度（防误清空/防刷假 id）
  let currentCheck = JSON.parse(student.check_data);
  if (check && typeof check === 'object' && !Array.isArray(check)) {
    const filtered = {};
    Object.keys(check).forEach(k => {
      if (validTasks.has(String(k))) {
        const v = check[k];
        filtered[k] = (v && v.half) ? { half: true } : true;
      }
    });
    if (Object.keys(filtered).length > 0 || Object.keys(currentCheck).length === 0) {
      currentCheck = filtered;
    }
  }
  // 校验 stars：只保留合法关卡，结构 {self,peer,teacher}
  let currentStars = JSON.parse(student.stars_data);
  if (stars && typeof stars === 'object' && !Array.isArray(stars)) {
    const f2 = {};
    Object.keys(stars).forEach(k => {
      if (validLevels.has(String(k))) {
        const s2 = stars[k] || {};
        f2[k] = { self: Math.max(0, Number(s2.self) || 0), peer: Math.max(0, Number(s2.peer) || 0), teacher: Math.max(0, Number(s2.teacher) || 0) };
      }
    });
    currentStars = f2;
  }
  const oldCheck = JSON.parse(student.check_data);

  db.updateStudentData(req.session.name, currentCheck, currentStars);

  const patch = {};
  if (achievements) patch.achievements = achievements;

  // 检测新完成关卡，记录首次完成时间（用于先锋判定）
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

// 学生反馈 Bug（抓虫有奖）
router.post('/bug-report', requireAuth, (req, res) => {
  if (req.session.role !== 'student') {
    return res.status(403).json({ ok: false, error: '仅学生可操作' });
  }
  const { location, content } = req.body || {};
  const text = String(content || '').trim();
  if (!text) {
    return res.status(400).json({ ok: false, error: '请填写遇到的问题' });
  }
  db.addBugReport(req.session.name, String(location || '').trim().slice(0, 100), text.slice(0, 2000));
  res.json({ ok: true, data: { name: req.session.name } });
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
  if (newPassword.trim() === db.DEFAULT_PASSWORD) {
    return res.status(400).json({ ok: false, error: '新密码不能为初始密码 123456' });
  }
  if (student.password && !db.isDefaultPassword(student.password)) {
    if (!oldPassword || !db.verifyPassword(student.password, oldPassword)) {
      return res.status(400).json({ ok: false, error: '原密码错误' });
    }
  }
  db.updateStudentPassword(req.session.name, newPassword.trim());
  res.json({ ok: true });
});

// 商城目录
router.get('/shop', requireAuth, (req, res) => {
  res.json({ ok: true, data: shopCatalog() });
});

// 手动打卡领工资（一般由 /me 自动领，这里兜底）
router.post('/claim-salary', requireAuth, (req, res) => {
  const student = db.findStudent(req.session.name);
  if (!student) return res.status(404).json({ ok: false, error: '账号不存在' });
  const cr = getContent();
  const xp = (cr.ok && cr.data) ? db.calcStudentXP(student, cr.data) : 0;
  const before = db.getWallet(student.name);
  db.claimSalary(req.session.name, xp);
  const after = db.getWallet(student.name);
  res.json({ ok: true, data: { coins: after.coins, monthTotal: after.monthSalaryTotal, rate: db.salaryRate(xp), gained: after.coins - before.coins } });
});

// 购买道具
router.post('/buy', requireAuth, (req, res) => {
  const { itemId } = req.body || {};
  const item = SHOP_ITEMS[itemId];
  if (!item) return res.status(400).json({ ok: false, error: '未知道具' });
  const wallet = db.getWallet(req.session.name);
  if (!wallet) return res.status(404).json({ ok: false, error: '账号不存在' });
  if (wallet.coins < item.price) return res.status(400).json({ ok: false, error: '金币不足' });
  db.setCoins(req.session.name, wallet.coins - item.price);
  const inv = db.addInventory(req.session.name, itemId, 1);
  res.json({ ok: true, data: { coins: wallet.coins - item.price, inventory: inv } });
});

// 使用/消耗道具
router.post('/consume-item', requireAuth, (req, res) => {
  const { itemId } = req.body || {};
  const inv = db.consumeInventory(req.session.name, itemId, 1);
  if (!inv) return res.status(400).json({ ok: false, error: '背包里没有该道具' });
  res.json({ ok: true, data: { inventory: inv } });
});

module.exports = router;
