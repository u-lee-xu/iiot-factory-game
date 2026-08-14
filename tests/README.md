# 自动化测试

对小游戏做回归测试，防止重构破坏功能。

## 运行

```bash
# 先启动服务器（端口 3000）
npm start
# 另开终端跑测试
npm test
```

测试用 Python + Playwright（chromium 已就绪）。

## 覆盖内容

| 测试 | 文件 | 覆盖 |
|------|------|------|
| 全游戏 smoke | `tests/smoke_all.py` | 26 款游戏逐个打开→运行 2s→断言 0 JS 错误、关键元素存在 |
| 移动端检查 | `tests/mobile_check.py` | 竖屏 390×844 下各游戏画布铺满、可操作 |
| 游戏专区流程 | `tests/gamezone.py` | 打开专区→进游戏→关闭→验证无残留/循环泄漏 |

## 前置条件

- Node 服务器运行在 `http://localhost:3000`
- 测试账号：`张三 / 123456`（全通关，测完成态）或 `李四 / 123456`（未完成态）
- Python3 + `playwright` 库已安装

## 常见排查

- `401 跳回登录`：sessionStorage token 过期，脚本已自动重新登录
- 元素找不到：服务器未启动 / 端口不对，检查 `SERVER` 常量
