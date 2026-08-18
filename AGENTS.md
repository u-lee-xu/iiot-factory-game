# AGENTS.md

局域网教学用"闯关游戏"服务器（锐智工厂，IIoT 工业互联网课程）。后端 Node.js + Express，前端原生 HTML/CSS/JS（**ES Module 模块化，零构建**），数据库 sql.js（SQLite wasm）+ bcryptjs。

> 详细接口清单、数据库 schema、文档-代码核对表、已知问题 → 见 **`docs/项目现状与核对.md`**；前端模块架构 → **`docs/架构设计.md`**（权威）。

## 常用命令

- `npm run dev` — 开发（`node --watch server.js`）；`npm start` — 生产；监听 `0.0.0.0:3000`（`PORT` 可改）
- `npm test` — 全游戏 smoke（Playwright）；`npm run test:mobile` — 竖屏适配。**均需先 `npm start` 起服务 + 测试账号 `张三/123456`**，详见 `tests/README.md`
- 无 lint、无类型检查。改后端手动起服务验证；改前端浏览器实测（静态文件已 no-cache）

## 结构（现状，2026-08）

- 后端：`server.js`（helmet CSP + 限流 120/min + 静态 public + /api 路由）、`db.js`（sql.js + bcrypt，真实文件 `data/game.db`，写后原子落盘；init 自动建表+旧库迁移）、`auth.js`（Bearer 中间件，24h；学生单点登录）、`routes/`（login/student/teacher/game）
- 前端页面：`index.html`（登录，跳 **map_proto.html** 或 teacher.html）、`map_proto.html`（厂区地图，内联 JS）、`room.html`（俯视 RPG 房间 + `js/room-task-host.js` 任务宿主）、`student.html`（**跳转壳**：无参→map_proto、?level=X→room.html?room=X、?task/?open=→app.js 弹任务）、`teacher.html`、`student_detail.html`（教师看学生详情）
- 前端 JS（ES Module，无打包器）：`js/app.js`（唯一宿主入口：状态+常量+**window 挂载**+init）、`js/core/`（api/state/fx/sound/utils/kbd/cmd-annotate/interactions）、`js/interactions/`（16 个任务类型）、`js/ui/`（10 模块）、`js/games/`（26 款小游戏）
- `data/game-content.json`（8 关 117 任务，**mtime 缓存热更新，编辑免重启**）、`public/data/`（term-cards.json、music.js、knowledge-tags.json——**前端加载的是 public/data 这份**，根 data/ 那份是另一份）
- `tests/`（playwright smoke）、`tools/make_offline.py`（离线任务打包，仅 install_wizard）、`docs/`、`public/offline/`

## 关键约定

- **任务类型**（terminal、quiz、chain_quiz、fill_blank、progress_bar、install_wizard、scenario_match、sort、code_review、ethics、diagnosis_tree、drag_classify、boss_fight、config_debug、log_forensics、default）：新增类型 = 新建 `js/interactions/xxx.js` + `registerInteraction('xxx', handler)` + **在 app.js 和 room-task-host.js 两处 import**（房间内任务也用它），否则渲染为 default
- **小游戏生命周期**：`openXxx(cfg, onComplete)`；关闭必须对称 removeEventListener + cancel rAF/clearInterval（防泄漏，smoke 覆盖）
- **ES Module 三铁律**（详见 docs/架构设计.md）：① 被 onclick/测试调用的函数必须显式挂 window（`Object.assign`）；② 可变状态挂 window 用 `Object.defineProperty` getter（带 setter，避免 stale）；③ 子模块只 import core/*，其余公共函数经 `window.*`（避免循环依赖）
- 鉴权：token 存 sessionStorage，`Authorization: Bearer <token>`；401 清空跳 index.html。教师登录名必须 `teacher`；学生初始密码 `123456`，首次登录/默认密码**强制改密**（≥8 位+大小写+数字，后端校验）
- 所有 UI 文案/错误消息为**中文**；后端响应统一 `{ ok, data? }` / `{ ok:false, error:'中文' }`
- 星级 `stars_data`：`{ [levelId]: { self, peer, teacher } }`，师评 0-5（routes/teacher.js 校验）；`check_data` 为任务勾选（半完成 `{half:true}` 记一半 XP）
- XP 规则（前后端一致）：hidden 任务=300；quiz 且 xp≤50=50；xp=0=0；其余默认 100
- **数据库写操作一律走 db.js 导出函数**（自动 save）；db.js 未导出 `get/all/run/transaction`（旧文档写法已失效）；底层只有 `exec/queryOne/queryAll` 且未导出
- 排行榜排除 `张三`（routes/game.js:9，教师演示号）——测试/演示排行注意

## 已知问题（核对发现，改 bug 前先看）

见 `docs/项目现状与核对.md` 第十节（含 2026-08-18 修复记录与标注）。曾修复：/me 缺字段、recordLogin 未调用、/progress 过滤 bug、queryAll 未导出（dashboard 500）、PASSWORD_ENABLED 不联动、teacher hasPassword 未 await、smoke 依赖旧页面流、登录页音乐（改 ZzFXM 合成，全站无音频文件）等。当前遗留：
1. `张三` 被排除排行榜（routes/game.js:9，教师演示号）——测试/演示排行注意
2. 旧库学生 `must_change_password` 默认 1 → 首次登录强制改密（预期行为）
3. `room.html` 音乐按钮无声——**已修复（2026-08-18）**：内联 zzfxG/zzfxM 引擎（与 index.html 同源）

## Git 与安全

- `main` 分支 + 约定式提交（feat/fix/docs/refactor/chore）；推送用后台脚本：`/home/lee/bin/git-push-bg.sh [仓库] [远程] [分支]`（GitHub 直连不稳）
- `data/game.db` 与备份 `.bak*` 在 .gitignore，勿提交
- server.js helmet CSP **必须保留 `scriptSrcAttr:['unsafe-inline']`**（内联 onclick 依赖）；HSTS 已禁用（HTTP 环境）
- 教师密码已改 bcrypt + 首次登录强制改密（不再是无 UI 的 admin123）；生产注意初始密码 `123456`

## 文档注意

- `docs/项目现状与核对.md`（本扫描记录：接口/结构/核对表/问题清单，**最新**）、`docs/架构设计.md`（ES Module 重构，权威）、`docs/游戏重构规划.md`（小游戏评级）
- `设计文档.md` **严重过时**（better-sqlite3→sql.js、无 xp 字段、login.html→index.html、学生跳 student.html、教师密码无 UI 等全变了），以代码为准
- `游戏概念设计.md` 愿景稿，多数已实现（排行榜/成就/叙事）；`开发规划.md` 美术规划未启动
- 重大架构变更需同步更新 docs/ 与本文件
