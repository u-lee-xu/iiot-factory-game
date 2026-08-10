const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

app.use('/api', require('./routes/login'));
app.use('/api/student', require('./routes/student'));
app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/game', require('./routes/game').router);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: '服务器内部错误' });
});

async function start() {
  await db.init();
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`锐智工厂已启动: http://localhost:${PORT}`);
    console.log(`局域网访问: http://<本机IP>:${PORT}`);
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
