# AGENTS.md

局域网教学用"闯关游戏"服务器（锐智工厂，IIoT 工业互联网课程）。后端 Node.js + Express，前端纯原生 HTML/CSS/JS（无构建步骤），数据库 sql.js（SQLite wasm）。

## 常用命令

- `npm run dev` — 开发（`node --watch server.js`，改后端自动重启）；`npm start` — 生产
- 监听 `0.0.0.0:3000`（`PORT` 环境变量可改），教学时经局域网 IP 访问
- 无测试、无 lint、无类型检查。改完手动 `npm start` 起服务验证
- HTML 通过 Cache-Control: no-cache 强制不缓存；前端改动一般无需刷新缓存

## 结构

- `server.js` — 入口，挂载 `/api` 路由 + 静态 `public/`
- `db.js` — sql.js 封装。数据库是**真实文件** `data/game.db`（非内存库），每次写操作后 `save()` 全量导出写盘；schema 在 init 时自动建表（teacher 默认密码 `admin123`，无修改界面，只能改库）
- `auth.js` — Bearer token 中间件（sessions 表，24h 过期）
- `routes/` — `login.js`、`student.js`、`teacher.js`、`game.js`（游戏内容接口）
- `public/` — `index.html`（登录）、`student.html`（学生端）、`teacher.html`（教师端）

## 关键约定

- **游戏内容在 `data/game-content.json`**，由 `GET /api/game/content` 按 mtime 缓存提供——编辑该文件**无需重启服务器**。学生端渲染逻辑与关卡数据分离，改关卡内容不应动 student.html 渲染代码
- 任务类型（`terminal`、`quiz`、`chain_quiz`、`fill_blank`、`progress_bar`、`scenario_match`、`sort`、`code_review`、`ethics`、`diagnosis_tree`、`drag_classify`、`boss_fight`）：**新增类型必须在 `student.html` 中 `registerInteraction(type, ...)` 注册处理器**，否则渲染为 `default` 类型
- 前端无框架：student.html 是 2200+ 行单文件，职责按区块组织（api 封装 → registerInteraction → UI）；改前端遵循这一模式，勿拆文件（无打包器）
- 鉴权：token 存 `sessionStorage`，请求头 `Authorization: Bearer <token>`；任何 401 会清空 sessionStorage 并跳回 `index.html`。教师登录名必须是 `teacher`（见 `routes/login.js:13`）
- 学生/教师端所有 UI 文案、错误消息均为**中文**，新代码保持一致；后端错误统一 `{ ok: false, error: '中文消息' }`，成功 `{ ok: true, data }`
- 星级数据 `stars_data`：`{ [levelId]: { self, peer, teacher } }`，teacher 打分 0-5（`routes/teacher.js:45` 校验）；`check_data` 为任务勾选状态对象
- 修改学生数据/师评后必须走 `db.save()`（现有函数已处理，直接复用 db.js 的封装函数，勿自行拼接 SQL）

## 文档注意

- `设计文档.md` 已部分过时：写的是 better-sqlite3，实际是 **sql.js**；API 表格中的 `xp` 字段实际不存在（XP 由前端根据任务 xp 计算）。以代码为准
- `游戏概念设计.md` 是愿景稿（P1-P4 分期设想），部分功能（排名、升级特效）尚未实现，别把它当成现状文档

---

## 补充：开发工作流与规范指南

### 开发环境准备
```bash
npm install          # 安装依赖（仅 sql.js、express 等少量包）
npm run dev          # 开发模式，node --watch 自动重启
# 或
npm start            # 生产模式
```
- 端口默认 `3000`，可用 `PORT=xxxx npm start` 覆盖
- 无需构建步骤，前端直接服务 `public/` 静态文件
- 数据库文件 `data/game.db` 首次运行自动初始化（含 teacher 账号）

### 代码风格约定
| 项 | 规范 |
|---|---|
| 缩进 | 2 空格 |
| 变量/函数 | camelCase |
| 常量/枚举 | UPPER_SNAKE_CASE |
| 文件命名 | kebab-case (`game-content.json`, `login.js`) |
| 后端响应 | 统一 `{ ok: bool, data?, error? }`，错误信息**必须中文** |
| 前端模块 | `student.html` 内部按区块组织：`API` → `registerInteraction` → `UI/渲染` → `事件绑定`，**禁止拆分文件** |

### Git 与提交规范
- **分支**：`main` 受保护，功能开发建立 `feat/xxx`、`fix/xxx` 分支
- **提交信息**：约定式提交
  ```
  feat: add drag_classify interaction type
  fix: teacher star rating validation boundary
  docs: update AGENTS.md with git workflow
  refactor: extract db.save() wrapper
  chore: bump sql.js version
  ```
- **PR 检查清单**：
  - [ ] 后端改动已手动 `npm start` 验证关键路径
  - [ ] 前端改动在浏览器（教师端/学生端）实测通过
  - [ ] 修改 `game-content.json` 后确认 mtime 更新、无需重启即生效
  - [ ] 新增任务类型已在 `student.html` 调用 `registerInteraction(type, handler)`
  - [ ] 涉及数据库写操作均复用 `db.js` 封装函数（自动 `save()`），未手写 SQL

### 常用数据库操作（db.js 导出函数）
```js
// 查询单条
db.get(sql, params)
// 查询多条
db.all(sql, params)
// 写操作（自动 save()）
db.run(sql, params)
// 事务批量写入
db.transaction(() => { ... })
```
> ⚠️ 所有写操作均会同步调用 `save()` 将整库写回 `data/game.db`，勿在循环中高频调用，必要时用 `db.transaction` 批量。

### 前端交互扩展：registerInteraction 模式
```js
// student.html 约 2200 行，搜索 "registerInteraction" 定义处
registerInteraction('terminal', {
  render: (task, container) => { ... },      // 必填：渲染 DOM
  validate: (task, userInput) => bool,       // 选填：自定义校验
  getAnswer: (task) => any,                  // 选填：提取学生作答
  onSubmit: (task, answer) => Promise        // 选填：提交额外逻辑
});
```
- **新类型必须注册**，否则回退到 `default` 渲染（仅显示题干）
- 现有 12 类型：`terminal` `quiz` `chain_quiz` `fill_blank` `progress_bar` `scenario_match` `sort` `code_review` `ethics` `diagnosis_tree` `drag_classify` `boss_fight`

### 常见问题排查
| 现象 | 排查方向 |
|---|---|
| 401 跳回登录页 | `sessionStorage.token` 过期/丢失，检查 `auth.js` 24h 过期逻辑 |
| 关卡内容不更新 | 确认 `game-content.json` mtime 变化；浏览器强制刷新（Cache-Control: no-cache） |
| 教师打分不生效 | 检查 `routes/teacher.js:45` 校验 0-5；确认 `db.save()` 执行 |
| 端口被占用 | `lsof -i:3000` 或改 `PORT` 环境变量 |
| 数据库锁定/损坏 | 确保单进程访问；`data/game.db` 仅由 Node 进程写入 |

### 安全与部署提醒
- **默认口令**：teacher / `admin123`（仅数据库可改，**无 UI 修改入口**），生产**必须**改密
- **HTTPS**：局域网教学建议配合 Nginx 反向代理 + 自签证书
- **数据库文件**：`data/game.db` 含敏感数据，**已在 .gitignore**，勿提交
- **防火墙**：教学机器需开放 3000 端口（或配置端口映射）

### 文档同步提醒
- `设计文档.md` **部分过时**（better-sqlite3 → sql.js，xp 字段不存在），以代码为准
- `游戏概念设计.md` 为**愿景稿**（P1-P4），排名/升级特效等尚未实现
- 重大架构变更（如换数据库、引入构建工具）需同步更新本文件
