// ═══════════════════════════════════════════════════════════════════
// interactions/config_debug.js — 任务类型「config_debug」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { taskXP } from '../core/utils.js';
import { playSound } from '../core/sound.js';

registerInteraction('config_debug', {
  render(container, task) {
    const cfg = task.config;
    const brokenConfig = cfg.brokenConfig || '# 配置文件加载失败';
    const expectedOutput = cfg.expectedOutput || '';
    const hints = cfg.hints || ['检查语法', '对照示例修正', '运行验证'];
    let editorContent = brokenConfig;
    let executed = false;

    container.innerHTML = `
      <div style="margin-bottom:10px;font-size: 14px;color:var(--dim)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span>🛠 修复配置文件</span>
          <span id="cfgStatus" style="font-size: 14px;color:var(--amber)">待修复</span>
        </div>
        ${cfg.description ? '<div style="font-size: 14px;color:var(--text);margin-bottom:8px">' + cfg.description + '</div>' : ''}
      </div>
      <div class="term-root" style="height:320px;display:flex;flex-direction:column">
        <div class="term-header">
          <span class="term-dots"><span class="term-dot red"></span><span class="term-dot yellow"></span><span class="term-dot green"></span></span>
          <span>${cfg.fileName || 'config.yaml'}</span>
          <span id="cfgStatus2"></span>
        </div>
        <div class="term-body" style="flex:1;overflow:auto;position:relative">
          <textarea id="cfgEditor" spellcheck="false" style="
            width:100%;height:100%;background:#0a0a10;color:var(--text);
            border:none;outline:none;font-family:inherit;font-size: 14px;line-height:1.5;
            padding:10px;resize:none;tab-size:2"
          ></textarea>
        </div>
        <div class="term-body" id="cfgOutputArea" style="min-height:60px;max-height:120px;overflow:auto;display:none;border-top:1px solid var(--border);background:#0a0a10">
          <div style="padding:8px;font-size: 14px;color:var(--dim)">▼ 运行输出</div>
          <pre id="cfgOutput" style="padding:0 8px 8px;font-family:inherit;font-size: 14px;line-height:1.5;white-space:pre-wrap;color:var(--green)"></pre>
        </div>
      </div>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" id="cfgRunBtn">▶ 运行验证</button>
        <button class="btn" id="cfgHintBtn">💡 提示 (${hints.length})</button>
        <button class="btn" id="cfgResetBtn">↺ 重置</button>
      </div>
    `;

    const editor = document.getElementById('cfgEditor');
    editor.value = brokenConfig;

    let hintIdx = 0;
    document.getElementById('cfgRunBtn').onclick = async () => {
      if (executed) return;
      const userConfig = editor.value;
      document.getElementById('cfgOutputArea').style.display = 'block';
      document.getElementById('cfgRunBtn').textContent = '⏳ 运行中...';
      document.getElementById('cfgRunBtn').disabled = true;

      // Simulate validation - in real impl, could POST to backend sandbox
      await new Promise(r => setTimeout(r, 500));
      
      // Simple validation: check if key fixes are present
      const checks = cfg.validationChecks || [];
      let passed = true;
      let output = '';
      
      if (checks.length > 0) {
        output = '=== 验证结果 ===\n';
        checks.forEach((check, i) => {
          const ok = check.test(userConfig);
          output += ok ? ` ✅ ${check.desc}\n` : ` ❌ ${check.desc}\n`;
          if (!ok) passed = false;
        });
      } else {
      window.errors++;
      window.streak = 0;
        // Fallback: compare with expected output keywords
        const keywords = (cfg.keywords || []).filter(k => userConfig.includes(k));
        passed = keywords.length === (cfg.keywords || []).length;
        output = passed 
          ? '✅ 配置验证通过！\n' + (expectedOutput || '预期输出匹配')
          : '❌ 配置仍有问题，请检查关键字段';
      }

      document.getElementById('cfgOutput').textContent = output;
      document.getElementById('cfgStatus').textContent = passed ? '✅ 通过' : '❌ 失败';
      document.getElementById('cfgStatus').style.color = passed ? 'var(--green)' : 'var(--red)';
      document.getElementById('cfgStatus2').textContent = passed ? '✅ 验证通过' : '❌ 验证失败';
      document.getElementById('cfgRunBtn').textContent = passed ? '✅ 完成' : '🔄 重新运行';
      document.getElementById('cfgRunBtn').classList.toggle('btn-success', passed);
      document.getElementById('cfgRunBtn').classList.toggle('btn-primary', !passed);
      document.getElementById('cfgRunBtn').disabled = false;
      executed = passed;

      if (passed) {
        playSound('success');
        setTimeout(() => window.completeTask(task.id, taskXP(task)), 800);
      } else {
      window.errors++;
      window.streak = 0;
        playSound('error');
      }
    };

    document.getElementById('cfgHintBtn').onclick = () => {
      if (hintIdx < hints.length) {
        window.showToast(hints[hintIdx], 'info');
        hintIdx++;
      } else {
      window.errors++;
      window.streak = 0;
        window.showToast('厂长摇头——最后一条提示也给你了', 'info');
      }
    };

    document.getElementById('cfgResetBtn').onclick = () => {
      editor.value = brokenConfig;
      document.getElementById('cfgOutputArea').style.display = 'none';
      document.getElementById('cfgStatus').textContent = '待修复';
      document.getElementById('cfgStatus').style.color = 'var(--amber)';
      document.getElementById('cfgStatus2').textContent = '';
      document.getElementById('cfgRunBtn').textContent = '▶ 运行验证';
      document.getElementById('cfgRunBtn').classList.remove('btn-success');
      document.getElementById('cfgRunBtn').classList.add('btn-primary');
      document.getElementById('cfgRunBtn').disabled = false;
      executed = false;
      hintIdx = 0;
    };
  }
});

// =========================================================================
// NEW: log_forensics - 给日志片段，学生定位根因（多选/拖拽排序）
// =========================================================================
