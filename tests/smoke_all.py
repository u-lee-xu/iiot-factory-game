# -*- coding: utf-8 -*-
"""全游戏 smoke 测试：逐个打开 26 款小游戏，运行 2s，断言 0 JS 错误、关键元素存在。
用法: python3 tests/smoke_all.py   (服务器需运行在 :3000)"""
import sys, time, json, random
from playwright.sync_api import sync_playwright

SERVER = "http://localhost:3000"
CHROME = "/home/lee/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome"
USER, PW = "张三", "123456"

# 每个游戏: (type, open函数, 关键元素id 或 None)
GAMES = {
  'typing':  ('openTypingDefense', 'tyField'),
  'shooter': ('openShooter', 'shCanvas'),
  'racing':  ('openDataRacing', 'rrCanvas'),
  'flappy':  ('openFlappy', 'fpCanvas'),
  'mole':    ('openMole', 'moCanvas'),
  'pacman':  ('openPacman', 'pcCanvas'),
  'tank':    ('openTank', 'tkCanvas'),
  'breakout':('openBreakout', 'brCanvas'),
  'sorter':  ('openSorter', 'soBelt'),
  'forge':   ('openForge', 'fgCanvas'),
  'll':      ('openLianLian', 'llGrid'),
  'pipe':    ('openPipe', 'pipeGrid'),
  'm3':      ('openMatch3', 'm3Grid'),
  'td':      ('openTowerDefense', 'tdCanvas'),
  'maze':    ('openMaze', 'mzGrid'),
  'hack':    ('openHacknet', 'hkMap'),
  'tyc':     ('openTycoon', 'tycData'),
  'lzr':     ('openLaser', 'lzrGrid'),
  'boss':    ('openBoss', 'bzCanvas'),
  'memory':  ('openMemoryMatch', None),
  'match':   ('openMatchGame', None),
  'quick':   ('openQuickMatch', None),
  'storm':   ('openStormDefense', None),
  'alarm':   ('openAlarmRush', None),
  't48':     ('openTile2048', None),
  'snake':   ('openSnake', 'snCanvas'),
}

def close_all(page):
    # 正常关闭:点击各游戏关闭按钮(触发 closeGame->cancel rAF),避免循环泄漏
    js=("()=>{"
        "const ovs=[...document.querySelectorAll('.mm-overlay')];"
        "ovs.forEach(ov=>{ const x=ov.querySelector('.mm-close'); if(x){ try{x.click();}catch(e){} } });"
        "document.querySelectorAll('.mm-overlay').forEach(o=>o.remove());"
      "}")

def main():
    passed, failed = [], []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, executable_path=CHROME, args=["--no-sandbox"])
        page = b.new_page(viewport={'width':900,'height':760}, device_scale_factor=1)
        # 登录
        page.goto(SERVER+"/index.html")
        page.fill("#nameInput", USER); page.fill("#studentPw", PW); page.click("#studentBtn")
        page.wait_for_load_state("networkidle"); page.wait_for_timeout(1500)
        page.goto(SERVER+"/student.html?level=5")
        page.wait_for_load_state("networkidle"); page.wait_for_timeout(1500)
        for _ in range(8):
            try: page.click("text=知道了", timeout=600); page.wait_for_timeout(200)
            except Exception: break
        page.wait_for_function("() => !!window.TERM_CARDS", timeout=8000)
        # 标记所有教程已看
        page.evaluate("()=>{ ['typing','shooter','racing','flappy','mole','pacman','tank','breakout','sorter','forge','ll','pipe','m3','td','maze','hack','tyc','lzr','boss','match','quick','memory','storm','alarm','t48','snake'].forEach(t=>localStorage.setItem('game_tut_'+t,'1')); }")
        all_errs = []
        page.on("pageerror", lambda e: all_errs.append(str(e)))
        for g, (fn, cid) in GAMES.items():
            close_all(page); page.wait_for_timeout(250)
            # 清除上一游戏残留的异步错误（同一收集器，避免闭包 late-binding 串扰）
            del all_errs[:]
            try:
                r = page.evaluate("""(a)=>{ try{
                  const d=window.TERM_CARDS; let w=null;
                  d.levels.forEach(lv=>{ (lv.warmups||[]).forEach(x=>{ if(x.type===a[0] && !w) w=x; }); });
                  if(!w) return 'no-warmup';
                  window[a[1]](w,()=>{}); return 'ok';
                }catch(e){ return 'ERR:'+e.message; } }""", [g, fn])
                page.wait_for_timeout(900)
                # 断言关键元素
                if cid:
                    has = page.evaluate("(id)=>!!document.getElementById(id)", cid)
                else:
                    has = page.evaluate("()=>!!document.querySelector('.mm-overlay')")
                errs = list(all_errs)   # 本轮收集的错误（打开该游戏期间新增）
                ok = (r == 'ok' or r == 'no-warmup') and has and not errs
                if ok: passed.append(g)
                else:
                    failed.append((g, r, has, errs[:1]))
            except Exception as e:
                failed.append((g, 'EXC:'+str(e)[:60], False, []))
            del all_errs[:]
            close_all(page); page.wait_for_timeout(200)
            # 每测完一个游戏强制刷新页面，彻底清除 rAF/setInterval 残留（避免交叉污染）
            page.goto(SERVER+"/student.html?level=5")
            page.wait_for_load_state("networkidle"); page.wait_for_timeout(300)
        b.close()
    print(f"\n===== 结果: {len(passed)} 通过 / {len(failed)} 失败 =====")
    if passed: print("通过:", " ".join(sorted(passed)))
    if failed:
        print("失败:")
        for g, r, has, e in failed:
            print(f"  {g:9s} open={r} 关键元素={has} errs={e}")
    sys.exit(1 if failed else 0)

if __name__ == "__main__":
    main()
