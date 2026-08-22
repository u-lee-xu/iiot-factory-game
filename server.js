const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const app = express();

// ===== 安全中间件 =====
// Helmet 基础安全头
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // 需要内联脚本用于初始化
      scriptSrcAttr: ["'unsafe-inline'"], // 项目用内联 onclick，需放开，否则点击无反应
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: null, // 禁用：HTTP 环境不强制升级 HTTPS
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: false, // HTTP 局域网/frp 环境：禁用 HSTS，避免浏览器强制 HTTPS 导致打不开
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// ===== 教材站（/textbook/）CSP 放宽 =====
// VitePress/Vue 运行时需要 unsafe-eval，此处仅对教材站放宽，游戏站保持原安全策略
app.use('/textbook', (req, res, next) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self';base-uri 'self';font-src 'self' data:;form-action 'self';frame-ancestors 'self';img-src 'self' data: blob:;object-src 'none';script-src 'self' 'unsafe-inline' 'unsafe-eval';script-src-attr 'unsafe-inline';style-src 'self' 'unsafe-inline';connect-src 'self'");
  next();
});

// 请求体大小限制（防止大包攻击）
app.use(express.json({ limit: '100kb' }));

// 通用 API 限流：每 IP 每分钟 120 请求
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: '请求过于频繁，请稍后再试' }
});
app.use('/api/', apiLimiter);

// 登录接口专用限流：每 IP 每分钟 10 次
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: '登录尝试过于频繁，请 1 分钟后再试' }
});
app.use('/api/login', loginLimiter);

// 静态文件服务（禁用缓存，开发期刷新即生效）
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.json')) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// ===== 路由挂载 =====
app.use('/api', require('./routes/login'));
app.use('/api/student', require('./routes/student'));
app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/game', require('./routes/game').router);

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ ok: false, error: '服务器内部错误' });
});

// ===== 启动 =====
async function start() {
  await db.init();
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`锐智工厂已启动: http://localhost:${PORT}`);
    console.log(`局域网访问: http://<本机IP>:${PORT}`);
    console.log(`安全头已启用: Helmet + Rate Limit`);
  });
  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`端口 ${PORT} 已被占用，请先关闭已有进程: kill $(lsof -t -i:${PORT})`);
    } else {
      console.error('启动失败:', err);
    }
    process.exit(1);
  });
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
