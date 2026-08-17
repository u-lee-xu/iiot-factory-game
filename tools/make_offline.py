#!/usr/bin/env python3
# 生成"解压即玩"的离线单任务 HTML + zip（复用 core/interactions 渲染，config 用 base64 内联）
# 用法: python3 tools/make_offline.py <levelId> <taskId>
import json, base64, os, re, subprocess, sys, zipfile, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, 'data', 'game-content.json')
OUTDIR = os.path.join(ROOT, 'public', 'offline')
PLAYER = os.path.join(ROOT, 'public', 'js', 'offline-player.js')
TEMPLATE = os.path.join(ROOT, 'tools', 'offline_template.html')

def main():
    if len(sys.argv) < 3:
        print("用法: python3 tools/make_offline.py <levelId> <taskId>"); return
    lvId, taskId = sys.argv[1], sys.argv[2]
    d = json.load(open(CONTENT, encoding='utf-8'))
    task = None
    for lv in d['levels']:
        for t in lv['tasks']:
            if str(t['id']) == taskId:
                task = t; break
        if task: break
    if not task:
        print("任务不存在:", taskId); return
    # 读取当前任务类型对应的播放器类型（install_wizard 已内置；其它类型后续扩展）
    ptype = task.get('type')
    if ptype != 'install_wizard':
        print("暂只支持 install_wizard 类型（当前任务类型:", ptype, "）"); return
    cfg_json = json.dumps(task['config'], ensure_ascii=False)
    b64 = base64.b64encode(cfg_json.encode('utf-8')).decode('ascii')
    title = task.get('title','').replace("'","\\'")
    # 更新 offline-player.js（taskId/title/base64）
    src = open(PLAYER, encoding='utf-8').read()
    src = re.sub(r"window.currentTaskId='[^']*'", "window.currentTaskId='%s'" % taskId, src)
    src = re.sub(r"const TASK_TITLE = '[^']*'", "const TASK_TITLE = '%s'" % title, src)
    src = re.sub(r"atob\('[A-Za-z0-9+/=]*'\)", "atob('%s')" % b64, src)
    open(PLAYER, 'w', encoding='utf-8').write(src)
    # esbuild 打包
    bundle = os.path.join(tempfile.gettempdir(), 'offline-bundle.js')
    subprocess.run(['npx','esbuild',PLAYER,'--bundle','--format=iife','--outfile='+bundle,'--log-level=error'], cwd=ROOT, check=True)
    b = open(bundle, encoding='utf-8').read()
    html = open(TEMPLATE, encoding='utf-8').read().replace('/*__BUNDLE__*/', b)
    out = os.path.join(OUTDIR, taskId)
    os.makedirs(out, exist_ok=True)
    open(os.path.join(out,'index.html'),'w',encoding='utf-8').write(html)
    with zipfile.ZipFile(os.path.join(OUTDIR, taskId + '.zip'), 'w') as z:
        z.write(os.path.join(out,'index.html'), 'index.html')
    print("已生成: %s | 试玩: /offline/%s/index.html | zip: /offline/%s.zip" % (taskId, taskId, taskId))

if __name__ == '__main__':
    main()
