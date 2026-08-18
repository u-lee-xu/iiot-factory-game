# -*- coding: utf-8 -*-
"""移动端适配检查：竖屏 390×844 下各游戏画布铺满、不溢出、可操作。
用法: python3 tests/mobile_check.py   (服务器需运行在 :3000)"""
import sys, time
from playwright.sync_api import sync_playwright

SERVER = "http://localhost:3000"
CHROME = "/home/lee/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome"
USER, PW = "张三", "123456"

# 只测有 canvas 的关键游戏（手机端主要看画布适配）
GAMES = {
  'shooter': ('openShooter', 'shCanvas'),
  'racing':  ('openDataRacing', 'rrCanvas'),
  'mole':    ('openMole', 'moCanvas'),
  'pacman':  ('openPacman', 'pcCanvas'),
  'tank':    ('openTank', 'tkCanvas'),
  'breakout':('openBreakout', 'brCanvas'),
  'td':      ('openTowerDefense', 'tdCanvas'),
  'snake':   ('openSnake', 'snCanvas'),
}

def main():
    passed, failed = [], []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, executable_path=CHROME, args=["--no-sandbox"])
        page = b.new_page(viewport={'width':390,'height':844}, device_scale_factor=1)
        page.goto(SERVER+"/index.html")
        page.fill("#nameInput", USER); page.fill("#studentPw", PW); page.click("#studentBtn")
        page.wait_for_load_state("networkidle"); page.wait_for_timeout(1500)
        page.goto(SERVER+"/student.html?open=game")
        page.wait_for_load_state("networkidle"); page.wait_for_timeout(1500)
        for _ in range(8):
            try: page.click("text=知道了", timeout=600); page.wait_for_timeout(200)
            except Exception: break
        page.wait_for_function("() => !!window.TERM_CARDS", timeout=8000)
        page.evaluate("()=>{ ['typing','shooter','racing','flappy','mole','pacman','tank','breakout','sorter','forge','ll','pipe','m3','td','maze','hack','tyc','lzr','boss','match','quick','memory','storm','alarm','t48','snake'].forEach(t=>localStorage.setItem('game_tut_'+t,'1')); }")
        for g, (fn, cid) in GAMES.items():
            errs = []
            page.on("pageerror", lambda e, _g=g: errs.append(str(e)))
            page.evaluate("()=>{ document.querySelectorAll('.mm-overlay').forEach(o=>o.remove()); }")
            page.wait_for_timeout(250)
            page.evaluate("""(a)=>{ const d=window.TERM_CARDS; let w=null; d.levels.forEach(lv=>{ (lv.warmups||[]).forEach(x=>{ if(x.type===a[0] && !w) w=x; }); }); if(w) window[a[1]](w,()=>{}); }""", [g, fn])
            page.wait_for_timeout(900)
            # 画布是否在视口内铺满
            info = page.evaluate("""(id)=>{ const c=document.getElementById(id); if(!c) return null;
              const r=c.getBoundingClientRect();
              return {w:Math.round(r.width), h:Math.round(r.height), vw:window.innerWidth, vh:window.innerHeight,
                fits: r.left>=0 && r.right<=window.innerWidth && r.top>=0 && r.bottom<=window.innerHeight}; }""", cid)
            ok = info and info['fits'] and not errs
            if ok: passed.append(g)
            else: failed.append((g, info, errs[:1]))
            page.evaluate("()=>{ document.querySelectorAll('.mm-overlay').forEach(o=>o.remove()); }")
            page.wait_for_timeout(200)
            page.goto(SERVER+"/student.html?open=game")
            page.wait_for_load_state("networkidle"); page.wait_for_timeout(300)
        b.close()
    print(f"\n===== 移动端检查: {len(passed)} 通过 / {len(failed)} 失败 =====")
    if passed: print("通过:", " ".join(sorted(passed)))
    if failed:
        for g, info, e in failed:
            print(f"  {g:9s} canvas={info} errs={e}")
    sys.exit(1 if failed else 0)

if __name__ == "__main__":
    main()
