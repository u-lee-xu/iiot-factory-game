const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../auth');
const { getContent } = require('./game');
const { PASSWORD_ENABLED } = require('./login');

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
  snake_gold:  { id: 'snake_gold',  name: '黄金蛇',   emoji: '🐍', price: 600,  desc: '贪吃蛇黄金涂装（永久）', type: 'snake_skin' },
  snake_ember: { id: 'snake_ember', name: '熔岩蛇',   emoji: '🌋', price: 600,  desc: '贪吃蛇熔岩橙涂装（永久）', type: 'snake_skin' },
  snake_ice:   { id: 'snake_ice',   name: '冰晶蛇',   emoji: '❄️', price: 600,  desc: '贪吃蛇冰晶蓝涂装（永久）', type: 'snake_skin' },
  snake_void:  { id: 'snake_void',  name: '紫晶蛇',   emoji: '💜', price: 800,  desc: '贪吃蛇紫晶涂装（永久）', type: 'snake_skin' },
  snake_neon:  { id: 'snake_neon',  name: '霓虹蛇',   emoji: '🌈', price: 1200, desc: '贪吃蛇霓虹粉涂装（永久）', type: 'snake_skin' },
  snake_coal:  { id: 'snake_coal',  name: '暗夜蛇',   emoji: '🌑', price: 600,  desc: '贪吃蛇暗夜黑涂装（永久）', type: 'snake_skin' },
  snake_mint:  { id: 'snake_mint',  name: '薄荷蛇',   emoji: '🍃', price: 600,  desc: '贪吃蛇薄荷涂装（永久）', type: 'snake_skin' },
  snake_sakura:{ id: 'snake_sakura',name: '樱花蛇',   emoji: '🌸', price: 600,  desc: '贪吃蛇樱花粉涂装（永久）', type: 'snake_skin' },
  snake_bamboo:{ id: 'snake_bamboo',name: '竹节蛇',   emoji: '🎋', price: 600,  desc: '一节节竹节身（永久）', type: 'snake_skin' },
  snake_bamboo_tea:{ id: 'snake_bamboo_tea', name: '竹节茶', emoji: '🍵', price: 800, desc: '竹节身·茶色（永久）', type: 'snake_skin' },
  snake_bamboo_purple:{ id: 'snake_bamboo_purple', name: '竹节紫', emoji: '💜', price: 800, desc: '竹节身·紫色（永久）', type: 'snake_skin' },
  snake_comet: { id: 'snake_comet', name: '彗星蛇',   emoji: '☄️', price: 800,  desc: '发光彗星拖尾（永久）', type: 'snake_skin' },
  snake_comet_pink:{ id: 'snake_comet_pink', name: '彗星粉', emoji: '🌌', price: 1000, desc: '彗星拖尾·粉色（永久）', type: 'snake_skin' },
  snake_comet_green:{ id: 'snake_comet_green', name: '彗星绿', emoji: '☄️', price: 1000, desc: '彗星拖尾·绿色（永久）', type: 'snake_skin' },
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

// 学生提交进度（前端使用 PUT /me；此接口已删除，避免与 /me 重复逻辑与 validLevels 未定义 bug）

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
router.put('/password', requireAuth, async (req, res) => {
  if (req.session.role !== 'student') {
    return res.status(403).json({ ok: false, error: '仅学生可操作' });
  }
  const { oldPassword, newPassword } = req.body || {};
  const student = db.findStudent(req.session.name);
  if (!student) {
    return res.status(404).json({ ok: false, error: '账号不存在' });
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 8) {
    return res.status(400).json({ ok: false, error: '新密码至少 8 位' });
  }

  const mustChange = student.must_change_password === 1 || await db.isDefaultPassword(student.password);

  if (!mustChange) {
    if (!oldPassword || !(await db.verifyPassword(student.password, oldPassword))) {
      return res.status(400).json({ ok: false, error: '原密码错误' });
    }
  }

  try {
    await db.updateStudentPassword(req.session.name, newPassword.trim());
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
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


// ===== 兼容接口：/me（前端 room/map 仍用，恢复以避免学生端 404） =====
// 获取学生完整数据（前端加载进度用）
router.get('/me', requireAuth, async (req, res) => {
  if (req.session.role !== 'student') return res.status(403).json({ ok: false, error: '仅学生可操作' });
  const student = db.findStudent(req.session.name);
  if (!student) return res.status(404).json({ ok: false, error: '账号不存在' });

  // 自动领取今日工资（幂等：当天已领则不加），供登录 toast 与钱包页展示
  const cr = getContent();
  const xp = (cr.ok && cr.data) ? db.calcStudentXP(student, cr.data) : 0;
  const before = db.getWallet(req.session.name) || {};
  const after = db.claimSalary(req.session.name, xp) || before;
  const gained = (after.coins || 0) - (before.coins || 0);

  const wallet = after;
  const pw = student.password || '';
  res.json({ ok: true, data: {
    name: student.name,
    check: JSON.parse(student.check_data || '{}'),
    stars: JSON.parse(student.stars_data || '{}'),
    achievements: JSON.parse(student.achievements || '{}'),
    teacherAwards: JSON.parse(student.teacher_awards || '{}'),
    newlyAwardedLogin: db.newlyAwardedLoginIds(student),
    salaryInfo: {
      xp,
      rate: db.salaryRate(xp),
      monthTotal: wallet.monthSalaryTotal || 0,
      claimedToday: (wallet.lastSalaryDate || '') === db.localDateString(),
      justClaimed: gained > 0,
      gained,
      coins: wallet.coins || 0
    },
    passwordEnabled: PASSWORD_ENABLED,
    levelFinishTimes: JSON.parse(student.level_finish_times || '{}'),
    loginCount: student.login_count || 0,
    lastLoginDate: student.last_login_date || '',
    loginStreak: student.login_streak || 0,
    coins: wallet.coins || 0,
    inventory: wallet.inventory || {},
    monthSalaryTotal: wallet.monthSalaryTotal || 0,
    hasPassword: !!pw && !(await db.isDefaultPassword(pw)),
    mustChangePassword: student.must_change_password === 1 || (await db.isDefaultPassword(pw))
  }});
});

// 前端弹完登录签到成就后标记"已提示"（防换设备/清缓存重复弹）
router.post('/notify-login-ach', requireAuth, (req, res) => {
  if (req.session.role !== 'student') {
    return res.status(403).json({ ok: false, error: '仅学生可操作' });
  }
  const { ids } = req.body || {};
  if (Array.isArray(ids) && ids.length) db.markLoginAchNotified(req.session.name, ids.slice(0, 50));
  res.json({ ok: true });
});

// 存档进度（前端用 PUT /me；逻辑与 /progress 一致）
router.put('/me', requireAuth, async (req, res) => {
  if (req.session.role !== 'student') return res.status(403).json({ ok: false, error: '仅学生可操作' });
  const { check, stars, achievements } = req.body || {};
  const student = db.findStudent(req.session.name);
  if (!student) return res.status(404).json({ ok: false, error: '账号不存在' });
  const contentRes = getContent();
  const validTasks = new Set(), validLevels = new Set();
  if (contentRes.ok && contentRes.data) {
    contentRes.data.levels.forEach(lv => { validLevels.add(String(lv.id)); (lv.tasks || []).forEach(t => validTasks.add(String(t.id))); });
  }
  let currentCheck = JSON.parse(student.check_data || '{}');
  if (check && typeof check === 'object' && !Array.isArray(check)) {
    const filtered = {};
    Object.keys(check).forEach(k => { if (validTasks.has(String(k))) { const v = check[k]; filtered[k] = (v && v.half) ? { half: true } : true; } });
    if (Object.keys(filtered).length > 0 || Object.keys(currentCheck).length === 0) currentCheck = filtered;
  }
  let currentStars = JSON.parse(student.stars_data || '{}');
  if (stars && typeof stars === 'object' && !Array.isArray(stars)) {
    const f2 = {};
    Object.keys(stars).forEach(k => { if (validLevels.has(String(k))) { const s2 = stars[k] || {}; f2[k] = { self: Math.max(0, Math.min(5, Number(s2.self) || 0)), peer: Math.max(0, Math.min(5, Number(s2.peer) || 0)), teacher: 0 }; } });
    currentStars = f2;
  }
  const oldCheck = JSON.parse(student.check_data || '{}');
  db.updateStudentData(req.session.name, currentCheck, currentStars);
  const patch = {};
  if (achievements) patch.achievements = achievements;
  if (contentRes.ok && contentRes.data && contentRes.data.levels) {
    const finishTimes = JSON.parse(student.level_finish_times || '{}');
    let changed = false;
    contentRes.data.levels.forEach(lv => { if (finishTimes[lv.id]) return; if (!levelCompleted(oldCheck, lv) && levelCompleted(currentCheck, lv)) { finishTimes[lv.id] = new Date().toISOString(); changed = true; } });
    if (changed) patch.levelFinishTimes = finishTimes;
  }
  if (Object.keys(patch).length) db.updateStudentMeta(req.session.name, patch);
  res.json({ ok: true });
});

module.exports = router;
