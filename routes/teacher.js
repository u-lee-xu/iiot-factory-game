const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireTeacher } = require('../auth');

router.use(requireAuth, requireTeacher);

// ===== 学生管理 =====
router.get('/students', async (req, res) => {
  const students = [];
  for (const s of db.listStudents()) {
    const w = db.getWallet(s.name);
    students.push({
      name: s.name,
      hasPassword: !(await db.isDefaultPassword(s.password)),
      check: JSON.parse(s.check_data || '{}'),
      stars: JSON.parse(s.stars_data || '{}'),
      created_at: s.created_at,
      loginCount: s.login_count || 0,
      lastLoginDate: s.last_login_date || '',
      loginStreak: s.login_streak || 0,
      coins: w ? w.coins : 0,
      inventory: w ? w.inventory : {},
      monthSalaryTotal: w ? w.monthSalaryTotal : 0,
      passwordChangedAt: s.password_changed_at,
      mustChangePassword: s.must_change_password === 1
    });
  }
  res.json({ ok: true, data: students });
});

// 批量添加（支持逗号/换行/空格分隔）
router.post('/students', async (req, res) => {
  const { names } = req.body || {};
  if (!Array.isArray(names) || names.length === 0) {
    return res.status(400).json({ ok: false, error: '请提供学生姓名列表' });
  }
  const results = { added: [], exists: [], errors: [] };
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    if (name.length > 20) {
      results.errors.push(`${name}：姓名过长（最多 20 字）`);
      continue;
    }
    try {
      const student = await db.createStudent(name);
      if (student) results.added.push(name);
      else results.exists.push(name);
    } catch (e) {
      results.errors.push(`${name}：${e.message}`);
    }
  }
  res.json({ ok: true, ...results });
});

// CSV 批量导入
router.post('/students/import', async (req, res) => {
  const { csv } = req.body || {};
  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ ok: false, error: '请提供 CSV 内容' });
  }

  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return res.status(400).json({ ok: false, error: 'CSV 至少需要表头 + 1 行数据' });
  }

  // 检测表头
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nameIdx = headers.indexOf('name') !== -1 ? headers.indexOf('name') :
                  headers.indexOf('姓名') !== -1 ? headers.indexOf('姓名') : 0;

  const results = { added: [], exists: [], errors: [] };
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const name = cols[nameIdx] || '';
    if (!name) {
      results.errors.push(`第 ${i+1} 行：姓名为空`);
      continue;
    }
    if (name.length > 20) {
      results.errors.push(`第 ${i+1} 行：${name} 姓名过长`);
      continue;
    }
    try {
      const student = await db.createStudent(name);
      if (student) results.added.push(name);
      else results.exists.push(name);
    } catch (e) {
      results.errors.push(`第 ${i+1} 行：${e.message}`);
    }
  }
  res.json({ ok: true, ...results });
});

// 获取单个学生详情
router.get('/student/:name', async (req, res) => {
  const s = db.findStudent(req.params.name);
  if (!s) return res.status(404).json({ ok: false, error: '学生不存在' });

  const [contentRes, w] = await Promise.all([
    (async () => { const { getContent } = require('./game'); return getContent(); })(),
    db.getWallet(s.name)
  ]);

  res.json({ ok: true, data: {
    name: s.name,
    hasPassword: !(await db.isDefaultPassword(s.password)),
    isDefaultPassword: await db.isDefaultPassword(s.password),
    check: JSON.parse(s.check_data || '{}'),
    stars: JSON.parse(s.stars_data || '{}'),
    achievements: JSON.parse(s.achievements || '{}'),
    teacherAwards: JSON.parse(s.teacher_awards || '{}'),
    levelFinishTimes: JSON.parse(s.level_finish_times || '{}'),
    created_at: s.created_at,
    loginCount: s.login_count || 0,
    lastLoginDate: s.last_login_date || '',
    loginStreak: s.login_streak || 0,
    coins: w ? w.coins : 0,
    inventory: w ? w.inventory : {},
    monthSalaryTotal: w ? w.monthSalaryTotal : 0,
    passwordChangedAt: s.password_changed_at,
    mustChangePassword: s.must_change_password === 1,
    content: contentRes.ok ? contentRes.data : null
  }});
});

router.delete('/student/:name', (req, res) => {
  const ok = db.deleteStudent(req.params.name);
  if (!ok) return res.status(404).json({ ok: false, error: '学生不存在' });
  res.json({ ok: true });
});

// 师评打分
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

// 设置/重置学生密码
router.put('/student/:name/password', async (req, res) => {
  const { password } = req.body || {};
  const pw = String(password || '').trim();
  if (pw && pw.length < 8) {
    return res.status(400).json({ ok: false, error: '密码至少 8 位，留空则清除密码（下次登录用初始密码）' });
  }
  try {
    const ok = await db.updateStudentPassword(req.params.name, pw || '123456');
    if (!ok) return res.status(404).json({ ok: false, error: '学生不存在' });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
  res.json({ ok: true, data: { password: pw, hasPassword: !!pw } });
});

// 发放成就
router.post('/student/:name/achievements', (req, res) => {
  const { achievementIds } = req.body || {};
  if (!Array.isArray(achievementIds) || achievementIds.length === 0) {
    return res.status(400).json({ ok: false, error: '请选择要发放的成就' });
  }
  const ids = achievementIds.map(String).filter(Boolean);
  const result = db.awardTeacherAchievements(req.params.name, ids);
  if (!result) return res.status(404).json({ ok: false, error: '学生不存在' });
  res.json({ ok: true, data: result });
});

// 发放金币
router.post('/student/:name/coins', (req, res) => {
  const { amount } = req.body || {};
  const n = parseInt(amount, 10);
  if (!n || isNaN(n)) return res.status(400).json({ ok: false, error: '请输入金币数量' });
  const s = db.findStudent(req.params.name);
  if (!s) return res.status(404).json({ ok: false, error: '学生不存在' });
  const cur = db.getWallet(req.params.name);
  db.setCoins(req.params.name, (cur ? cur.coins : 0) + n);
  res.json({ ok: true, data: { coins: db.getWallet(req.params.name).coins } });
});

// 重置学生进度
router.post('/student/:name/reset', (req, res) => {
  const ok = db.resetStudent(req.params.name);
  if (!ok) return res.status(404).json({ ok: false, error: '学生不存在' });
  res.json({ ok: true });
});

// ===== Bug 反馈 =====
router.get('/bug-reports', (req, res) => {
  res.json({ ok: true, data: db.listBugReports() });
});
router.delete('/bug-reports/:id', (req, res) => {
  db.deleteBugReport(Number(req.params.id));
  res.json({ ok: true });
});

// ===== 班级仪表盘 =====
router.get('/dashboard', async (req, res) => {
  const { getContent } = require('./game');
  const contentRes = getContent();
  if (!contentRes.ok) return res.status(500).json(contentRes);
  const content = contentRes.data;

  const students = db.listStudents();

  // 基础统计
  const totalStudents = students.length;
  const activeToday = students.filter(s => s.last_login_date === db.localDateString()).length;
  const activeThisWeek = students.filter(s => {
    const last = s.last_login_date;
    if (!last) return false;
    const diff = (new Date(db.localDateString()) - new Date(last)) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  }).length;

  // XP/完成度统计
  function taskXP(t) {
    if (t.hidden) return 300;
    if (t.type === 'quiz' && t.xp <= 50) return 50;
    if (t.xp === 0) return 0;
    return t.xp || 100;
  }

  function levelCompleted(check, level) {
    let done = 0, total = 0;
    (level.tasks || []).forEach(t => {
      if (t.auto) return;
      total++;
      if (check['' + t.id]) done++;
    });
    return total > 0 && done >= total;
  }

  let totalXP = 0, totalTasks = 0, totalDone = 0;
  const levelStats = {};
  const xpDistribution = { '0-100': 0, '101-500': 0, '501-1000': 0, '1001-2000': 0, '2000+': 0 };

  students.forEach(s => {
    const check = JSON.parse(s.check_data || '{}');
    let xp = 0, done = 0, total = 0;
    content.levels.forEach(lv => {
      (lv.tasks || []).forEach(t => {
        if (t.auto) return;
        total++; totalTasks++;
        const c = check['' + t.id];
        if (c) { done++; totalDone++; xp += (c && c.half) ? Math.floor(taskXP(t) / 2) : taskXP(t); }
      });
    });
    totalXP += xp;

    if (xp <= 100) xpDistribution['0-100']++;
    else if (xp <= 500) xpDistribution['101-500']++;
    else if (xp <= 1000) xpDistribution['501-1000']++;
    else if (xp <= 2000) xpDistribution['1001-2000']++;
    else xpDistribution['2000+']++;

    // 关卡完成情况
    content.levels.forEach(lv => {
      if (!levelStats[lv.id]) levelStats[lv.id] = { name: lv.name, completed: 0, total: 0 };
      levelStats[lv.id].total++;
      if (levelCompleted(check, lv)) levelStats[lv.id].completed++;
    });
  });

  // 登录审计统计（最近 7 天）
  const audit = db.queryAll(
    "SELECT date(created_at) as day, role, success, count(*) as cnt FROM login_audit WHERE created_at >= date('now', '-7 days') GROUP BY day, role, success ORDER BY day DESC"
  );
  const loginStats = {};
  audit.forEach(r => {
    if (!loginStats[r.day]) loginStats[r.day] = { student: { success: 0, fail: 0 }, teacher: { success: 0, fail: 0 } };
    loginStats[r.day][r.role][r.success ? 'success' : 'fail'] = r.cnt;
  });

  res.json({ ok: true, data: {
    summary: {
      totalStudents,
      activeToday,
      activeThisWeek,
      avgXP: totalStudents ? Math.round(totalXP / totalStudents) : 0,
      avgCompletion: totalTasks ? Math.round(totalDone / totalTasks * 100) : 0
    },
    xpDistribution,
    levelStats: Object.entries(levelStats).map(([id, v]) => ({ id: Number(id), ...v, rate: v.total ? Math.round(v.completed / v.total * 100) : 0 })),
    loginStats,
    students: students.map(s => {
      const check = JSON.parse(s.check_data || '{}');
      let xp = 0, done = 0, total = 0;
      content.levels.forEach(lv => {
        (lv.tasks || []).forEach(t => {
          if (t.auto) return;
          total++;
          if (check['' + t.id]) { done++; xp += taskXP(t); }
        });
      });
      return {
        name: s.name,
        xp,
        completion: total ? Math.round(done / total * 100) : 0,
        lastLogin: s.last_login_date,
        loginStreak: s.login_streak || 0,
        loginCount: s.login_count || 0
      };
    })
  }});
});

// ===== 进度导出（CSV） =====
router.get('/export/progress', async (req, res) => {
  const { getContent } = require('./game');
  const contentRes = getContent();
  if (!contentRes.ok) return res.status(500).json(contentRes);
  const content = contentRes.data;

  const students = db.listStudents();

  function taskXP(t) {
    if (t.hidden) return 300;
    if (t.type === 'quiz' && t.xp <= 50) return 50;
    if (t.xp === 0) return 0;
    return t.xp || 100;
  }

  // 表头
  const headers = ['姓名', 'XP', '总完成度%', '创建时间', '最后登录', '连续登录天数', '登录次数'];
  content.levels.forEach(lv => {
    headers.push(`${lv.name}_完成度%`);
    headers.push(`${lv.name}_完成时间`);
  });

  const rows = [headers.join(',')];

  students.forEach(s => {
    const check = JSON.parse(s.check_data || '{}');
    const stars = JSON.parse(s.stars_data || '{}');
    const finishTimes = JSON.parse(s.level_finish_times || '{}');
    let xp = 0, done = 0, total = 0;
    const levelData = [];

    content.levels.forEach(lv => {
      let ld = 0, lt = 0;
      (lv.tasks || []).forEach(t => {
        if (t.auto) return;
        lt++; total++;
        const c = check['' + t.id];
        if (c) { ld++; done++; xp += (c && c.half) ? Math.floor(taskXP(t) / 2) : taskXP(t); }
      });
      const pct = lt ? Math.round(ld / lt * 100) : 0;
      levelData.push(pct, finishTimes[lv.id] || '');
    });

    const row = [
      s.name,
      xp,
      total ? Math.round(done / total * 100) : 0,
      s.created_at || '',
      s.last_login_date || '',
      s.login_streak || 0,
      s.login_count || 0,
      ...levelData
    ];
    rows.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  });

  const csv = rows.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="progress_export_${db.localDateString()}.csv"`);
  res.send('\uFEFF' + csv); // BOM for Excel
});

// ===== 登录审计导出 =====
router.get('/export/audit', (req, res) => {
  const { days = 30 } = req.query;
  const audit = db.queryAll(
    `SELECT id, name, role, ip, user_agent, success, created_at FROM login_audit WHERE created_at >= date('now', '-${parseInt(days)} days') ORDER BY id DESC`
  );

  const headers = ['ID', '姓名', '角色', 'IP', 'User-Agent', '成功', '时间'];
  const rows = [headers.join(',')];
  audit.forEach(r => {
    rows.push([r.id, r.name, r.role, r.ip || '', `"${(r.user_agent || '').replace(/"/g, '""')}"`, r.success ? '是' : '否', r.created_at].join(','));
  });

  const csv = rows.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="login_audit_${db.localDateString()}.csv"`);
  res.send('\uFEFF' + csv);
});

module.exports = router;
