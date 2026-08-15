// ═══════════════════════════════════════════════════════════════════
// interactions/install_wizard.js — 任务类型「install_wizard」处理器
// 拆自 app.js；import core/*，其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { registerInteraction } from '../core/interactions.js';
import { taskXP } from '../core/utils.js';
import { playSound } from '../core/sound.js';
import { showWrongExplain } from '../core/fx.js';

registerInteraction('install_wizard', {
  render(container, task) {
    const cfg = task.config;
    const steps = cfg.steps || [];
    let current = 0;
    let multiSelected = new Set();
    let cmdErrorCount = 0;   // 命令被"给答案"的次数（>0 表示曾连续猜错）
    let cmdHintGiven = {};   // 每个命令步骤是否已给过功能提示

    container.innerHTML = `
      <div id="wizardBar">
        <div class="wizard-steps" id="wizardSteps"></div>
        <div class="prog-bar-bg"><div class="prog-bar-fill" id="wizardFill"></div></div>
      </div>
      <div id="wizardStage" style="margin-top:12px"></div>
    `;

    function updateProgress() {
      const pct = current / steps.length * 100;
      document.getElementById('wizardFill').style.width = pct + '%';
      const stepsEl = document.getElementById('wizardSteps');
      stepsEl.innerHTML = steps.map((s, i) => {
        let cls = 'wiz-dot';
        if (i < current) cls += ' done';
        if (i === current) cls += ' active';
        return '<span class="' + cls + '" title="' + s.title + '">' + (i + 1) + '</span>';
      }).join('');
    }

    function renderStep() {
      if (current >= steps.length) {
        var passSaved = (cmdErrorCount > 0 && window.__passActive);
        if (passSaved) window.__passActive = false;   // 用了免错金牌
        var finalXP = (cmdErrorCount > 0 && !passSaved) ? Math.floor(taskXP(task) / 2) : taskXP(task);
        var halfNote = cmdErrorCount > 0
          ? '<div style="font-size: 13px;color:var(--amber);margin-top:6px">经验减半 · 实得 +'+ finalXP +' XP</div>'
          : '<div style="font-size: 13px;color:var(--dim);margin-top:6px">全对完成 · 经验满额</div>';
        document.getElementById('wizardStage').innerHTML = '<div style="text-align:center;padding:20px"><div style="font-size:28px;margin-bottom:8px">\ud83d\udda5\ufe0f</div><div style="color:var(--green);font-size:14px">\u2705 工位搭建完成！</div>' + halfNote + '</div>';
        document.getElementById('modalFoot').innerHTML = '<button class="btn btn-success" onclick="window.completeTask(\'' + task.id + '\', ' + finalXP + ')">\u2713 领取 XP</button>';
        updateProgress();
        playSound('success');
        return;
      }
      updateProgress();
      const step = steps[current];
      const stage = document.getElementById('wizardStage');
      var _narr = String(step.narrative || '').replace(/^厂长[:：]\s*/, '');
      var html = '<div class="wizard-narrative"><span class="wiz-narr-icon">\ud83d\udc68\u200d\ud83d\udcbc</span> <span class="wiz-narr-label">厂长：</span>' + _narr.replace(/\n/g, '<br>') + '</div>';
      html += '<div class="wizard-question">' + step.question + '</div>';
      if (step.inputType === 'number') {
        html += '<div style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size: 15px"><input type="number" id="wizNum" placeholder="输入数字" style="width:80px;background:#0a0a10;border:1px solid var(--border);color:var(--text);padding:8px;font-size:14px" min="0" max="32"><span style="color:var(--dim)">GB</span></div>';
      } else if (step.inputType === 'command') {
        html += '<div class="term-root" style="margin-top:8px"><div class="term-header"><span class="term-dots"><span class="term-dot red"></span><span class="term-dot yellow"></span><span class="term-dot green"></span></span><span>终端</span></div><div class="term-body"><input type="text" id="wizCmd" placeholder="输入命令…" spellcheck="false" autocomplete="off" style="width:94%;background:transparent;border:none;color:var(--green);font:inherit;font-size: 15px;outline:none;padding:8px"></div></div>';
      } else if (step.multiSelect) {
        html += '<div id="wizMultiOpts" style="margin-top:8px;display:flex;flex-direction:column;gap:6px"></div>';
      } else if (step.options) {
        html += '<div id="wizOpts" style="margin-top:8px;display:flex;flex-direction:column;gap:6px"></div>';
      }
      stage.innerHTML = html;
      if (step.options && !step.multiSelect) {
        var optsEl = document.getElementById('wizOpts');
        step.options.forEach(function(opt, i) {
          var div = document.createElement('div');
          div.className = 'quiz-opt';
          div.innerHTML = '<span style="font-size: 14px;color:var(--dim);margin-right:6px">' + (opt.label || String.fromCharCode(65 + i)) + '</span>' + opt.text;
          div.onclick = function() {
            document.getElementById('wizOpts').querySelectorAll('.quiz-opt').forEach(function(el) { el.classList.remove('selected'); });
            div.classList.add('selected');
            document.getElementById('modalFoot').innerHTML = '<button class="btn btn-wiz-cancel" onclick="window.closeModal()">取消</button><button class="btn btn-primary" id="wizSubmitBtn">\u2713 确认</button>';
            document.getElementById('wizSubmitBtn').onclick = function() { submitWizard(i); };
          };
          optsEl.appendChild(div);
        });
        document.getElementById('modalFoot').innerHTML = '<button class="btn btn-wiz-cancel" onclick="window.closeModal()">取消</button>';
      } else if (step.multiSelect) {
        multiSelected = new Set();
        var mOptsEl = document.getElementById('wizMultiOpts');
        step.options.forEach(function(opt, i) {
          var div = document.createElement('div');
          div.className = 'quiz-opt';
          div.id = 'wizMultiOpt_' + i;
          div.innerHTML = '<span class="wiz-checkbox" style="display:inline-block;width:18px;height:18px;border:2px solid var(--border);margin-right:8px;font-size: 14px;line-height:18px;text-align:center;vertical-align:middle"></span><span>' + opt.text + '</span>';
          div.onclick = function() {
            if (multiSelected.has(i)) {
              multiSelected.delete(i);
              div.querySelector('.wiz-checkbox').textContent = '';
              div.querySelector('.wiz-checkbox').style.borderColor = 'var(--border)';
              div.style.borderColor = 'var(--border)';
            } else {
      window.errors++;
      window.streak = 0;
              multiSelected.add(i);
              div.querySelector('.wiz-checkbox').textContent = '\u2713';
              div.querySelector('.wiz-checkbox').style.color = 'var(--green)';
              div.querySelector('.wiz-checkbox').style.borderColor = 'var(--green)';
              div.style.borderColor = 'var(--amber)';
            }
            var sbEmpty = multiSelected.size === 0;
            document.getElementById('modalFoot').innerHTML = '<button class="btn btn-wiz-cancel" onclick="window.closeModal()">取消</button><button class="btn btn-primary" id="wizSubmitBtn"' + (sbEmpty ? ' disabled' : '') + '>\u2713 确认选择</button>';
            var sb = document.getElementById('wizSubmitBtn');
            if (sb) { sb.onclick = function() { submitWizardMulti(); }; }
          };
          mOptsEl.appendChild(div);
        });
        document.getElementById('modalFoot').innerHTML = '<button class="btn btn-wiz-cancel" onclick="window.closeModal()">取消</button>';
      } else if (step.inputType) {
        document.getElementById('modalFoot').innerHTML = '<button class="btn btn-wiz-cancel" onclick="window.closeModal()">取消</button><button class="btn btn-primary" id="wizSubmitBtn">\u2713 确认</button>';
        document.getElementById('wizSubmitBtn').onclick = function() {
          if (step.inputType === 'number') {
            var val = parseInt(document.getElementById('wizNum').value);
            if (isNaN(val)) { window.showToast('你得输入一个数字机器才认', 'error'); return; }
            submitWizard(val);
          } else if (step.inputType === 'command') {
            var inp = document.getElementById('wizCmd');
            if (!inp) return;
            var val = inp.value.trim();
            if (!val) { window.showToast('终端还等着你的命令', 'error'); return; }
            submitWizard(val);
          }
        };
        // Enter key binding
        setTimeout(function() {
          if (step.inputType === 'number') {
            var el = document.getElementById('wizNum');
            if (el) el.onkeydown = function(e) { if (e.key === 'Enter') document.getElementById('wizSubmitBtn').click(); };
          } else if (step.inputType === 'command') {
            var el = document.getElementById('wizCmd');
            if (el) { el.onkeydown = function(e) { if (e.key === 'Enter') document.getElementById('wizSubmitBtn').click(); }; el.focus(); }
          }
        }, 100);
      }
    }

    window.submitWizard = function(answer) {
      var step = steps[current];
      if (step.inputType === 'command') {
        runTerminalSim(answer);
        return;
      }
      var correct = false;
      if (step.inputType === 'number') {
        correct = step.correctNumber.includes(answer);
      } else {
      window.errors++;
      window.streak = 0;
        correct = step.options[answer].correct;
      }
      handleStepResult(correct, step.inputType === 'number' ? null : answer);
    };

    function runTerminalSim(cmd) {
      var step = steps[current];
      // → 立即验证命令，不正确的直接报错，不跑动画
      var normalized = cmd.toLowerCase().replace(/\s+/g, ' ');
      var commands = [step.correctCommand.toLowerCase()].concat((step.aliases || []).map(function(a) { return a.toLowerCase(); }));
      var ok = commands.some(function(c) { return normalized === c || normalized.startsWith(c); });
      
      var stage = document.getElementById('wizardStage');
      var termRoot = stage.querySelector('.term-root');
      document.getElementById('modalFoot').innerHTML = '';

      if (!ok) {
        // 渐进提示：若配置了 hints 数组则逐步给出答案片段，全部用完再给完整答案（标记经验减半）
        var tries = cmdHintGiven[current] || 0;
        var hintList = (step.hints && step.hints.length) ? step.hints : null;
        var hintText;
        if (hintList) {
          if (tries < hintList.length) {
            hintText = '💡 提示 ' + (tries + 1) + '/' + hintList.length + ': ' + String(hintList[tries]).replace(/</g,'&lt;');
            cmdHintGiven[current] = tries + 1;
          } else {
            hintText = '📖 答案是: ' + String(step.correctCommand).replace(/</g,'&lt;');
            cmdErrorCount++;
          }
        } else {
          if (tries === 0) {
            hintText = '💡 提示: ' + String(step.errorHint || '再看看厂长刚才教的，命令格式要对').replace(/</g,'&lt;');
            cmdHintGiven[current] = 1;
          } else {
            hintText = '📖 答案是: ' + String(step.correctCommand).replace(/</g,'&lt;');
            cmdErrorCount++;
          }
        }
        if (termRoot) {
          var termBody = termRoot.querySelector('.term-body');
          var input = document.getElementById('wizCmd');
          if (termBody && input) {
            var box = document.createElement('div');
            box.style.cssText = 'padding:4px 0';
            box.innerHTML = '<div style="color:var(--cyan)">$ ' + String(cmd).replace(/</g,'&lt;') + '</div>' +
              '<div style="color:var(--red)">bash: ' + String(cmd).split(' ')[0].replace(/</g,'&lt;') + ': 命令未找到，或参数不正确</div>' +
              '<div style="color:var(--amber);margin-top:4px">' + hintText + '</div>';
            termBody.insertBefore(box, input);
            input.onkeydown = function(e) { if (e.key === 'Enter') { var v = input.value.trim(); if (v) submitWizard(v); } };
            input.focus();
          }
        }
        playSound('error');
        window.shakeScreen();
        document.getElementById('modalFoot').innerHTML = '<button class="btn btn-wiz-cancel" onclick="window.closeModal()">取消</button>';
        return;
      }

      // 正确命令 → 替换为输出区并播放动画
      if (termRoot) {
        termRoot.innerHTML = '<div class="term-header"><span class="term-dots"><span class="term-dot red"></span><span class="term-dot yellow"></span><span class="term-dot green"></span></span><span>\u7aef</span></div><div class="term-body" id="wizTermOut" style="padding:8px;font-size: 14px;font-family:inherit;max-height:180px;overflow-y:auto;color:var(--dim)"></div>';
      }
      var out = document.getElementById('wizTermOut');
      if (!out) return;
      
      var lines = step.outputLines
        ? [{text: '$ ' + cmd, color: 'cyan', delay: 200}].concat(step.outputLines)
        : [
        {text: '$ ' + cmd, color: 'cyan', delay: 200},
        {text: 'Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease', color: '', delay: 300},
        {text: 'Get:2 http://archive.ubuntu.com/ubuntu noble-updates InRelease [126 kB]', color: '', delay: 250},
        {text: 'Reading package lists... Done', color: 'dim', delay: 400},
        {text: 'Building dependency tree... Done', color: 'dim', delay: 300},
        {text: 'Calculating upgrade... Done', color: 'dim', delay: 300},
        {text: 'The following packages will be upgraded:', color: 'dim', delay: 200},
        {text: '  openssh-server libc6 systemd base-files ...', color: 'dim', delay: 200},
        {text: 'Need to get 12.3 MB of archives.', color: 'dim', delay: 200},
        {text: 'Get:1 openssh-server 1:9.6p1 [380 kB]', color: '', delay: 300},
        {text: 'Get:2 libc6 2.39-0ubuntu9 [2.1 MB]', color: '', delay: 300},
        {text: 'Fetched 12.3 MB in 5s (2.46 MB/s)', color: 'dim', delay: 400},
        {text: 'Preconfiguring packages ... Done', color: 'dim', delay: 200},
        {text: 'Setting up packages ... Done', color: 'dim', delay: 200},
        {text: 'Processing triggers for libc-bin ...', color: 'dim', delay: 200},
        {text: '', color: '', delay: 100}
      ];

      var i = 0;
      function nextLine() {
        if (i >= lines.length) {
          setTimeout(function() {
            var normalized = cmd.toLowerCase().replace(/\s+/g, ' ');
            var commands = [step.correctCommand.toLowerCase()].concat((step.aliases || []).map(function(a) { return a.toLowerCase(); }));
            var ok = commands.some(function(c) { return normalized === c || normalized.startsWith(c); });
            if (ok) {
              var okDiv = document.createElement('div');
              okDiv.textContent = step.successText || '\u2705 系统更新完成，所有软件包已是最新版本！';
              okDiv.style.color = 'var(--green)';
              okDiv.style.marginTop = '6px';
              out.appendChild(okDiv);
              playSound('success');
              // 厂长解读终端输出含义（如有 explain 字段）
              if (step.explain) {
                var ex = document.createElement('div');
                ex.className = 'wiz-explain';
                ex.innerHTML = '<span style="color:var(--amber);font-weight:bold">厂长解读：</span>' + String(step.explain).replace(/</g,'&lt;');
                out.appendChild(ex);
                out.scrollTop = out.scrollHeight;
              }
              // 不自动跳转：看完结果点“确认”再进下一步
              document.getElementById('modalFoot').innerHTML =
                '<button class="btn btn-wiz-cancel" onclick="window.closeModal()">取消</button>' +
                '<button class="btn btn-primary" onclick="window.wizNext()">\u2713 确认，下一步</button>';
              window.wizNext = function() {
                current++;
                multiSelected = new Set();
                renderStep();
                stage.style.opacity = '1';
              };
            } else {
      window.errors++;
      window.streak = 0;
              var errDiv = document.createElement('div');
              errDiv.textContent = '\u274c 输入错误——终端拒绝了这条命令。厂长提示：apt update && apt upgrade';
              errDiv.style.color = 'var(--red)';
              errDiv.style.marginTop = '6px';
              out.appendChild(errDiv);
              playSound('error');
              window.shakeScreen();
              document.getElementById('modalFoot').innerHTML = '<button class="btn btn-wiz-cancel" onclick="window.closeModal()">取消</button><button class="btn btn-primary" onclick="window.wizRetry()">\uD83D\uDD04 重试</button>';
            }
          }, 400);
          return;
        }
        var line = lines[i];
        var div = document.createElement('div');
        div.textContent = line.text;
        if (line.color === 'dim') div.style.color = 'var(--dim)';
        else if (line.color === 'cyan') div.style.color = 'var(--cyan)';
        else if (line.color === 'green') div.style.color = 'var(--green)';
        out.appendChild(div);
        out.scrollTop = out.scrollHeight;
        i++;
        setTimeout(nextLine, line.delay);
      }
      nextLine();
    }


    window.submitWizardMulti = function() {
      var step = steps[current];
      var selectedArr = Array.from(multiSelected);
      var correctIndices = [];
      step.options.forEach(function(opt, i) { if (opt.correct) correctIndices.push(i); });
      var allSelectedCorrect = selectedArr.length === correctIndices.length && selectedArr.every(function(i) { return step.options[i].correct; });
      handleStepResult(allSelectedCorrect);
    };

    function handleStepResult(correct) {
      if (correct) {
        playSound('success');
        current++;
        multiSelected = new Set();
        var stage = document.getElementById('wizardStage');
        stage.style.transition = 'opacity .2s';
        stage.style.opacity = '0';
        setTimeout(function() { renderStep(); stage.style.opacity = '1'; }, 250);
      } else {
      window.errors++;
      window.streak = 0;
        window.shakeScreen();
        playSound('error');
        var step = steps[current];
        // 厂长针对所点选项解释（explain > 正确项 hint > 正确答案兜底）
        var wrongOpt = (arguments.length >= 2 && arguments[1] != null && step.options) ? step.options[arguments[1]] : null;
        var correctOpt = step.options ? step.options.find(function(o) { return o.correct; }) : null;
        var _txt = (wrongOpt && wrongOpt.explain) ? wrongOpt.explain
                 : (correctOpt && correctOpt.hint) ? correctOpt.hint
                 : ('正确答案是「' + (correctOpt ? correctOpt.text : '') + '」，再试试？');
        showWrongExplain(document.getElementById('wizardStage'), '厂长：' + _txt, null);
        if (step.options && !step.multiSelect) {
          document.querySelectorAll('#wizOpts .quiz-opt').forEach(function(el, i) {
            el.style.pointerEvents = 'none';
            if (step.options[i].correct) el.classList.add('correct');
          });
          setTimeout(function() {
            document.querySelectorAll('#wizOpts .quiz-opt').forEach(function(el) { el.style.pointerEvents = ''; el.classList.remove('correct', 'selected'); });
            document.getElementById('modalFoot').innerHTML = '<button class="btn btn-wiz-cancel" onclick="window.closeModal()">取消</button>';
          }, 1200);
        }
        document.getElementById('modalFoot').innerHTML = '<button class="btn btn-wiz-cancel" onclick="window.closeModal()">取消</button><button class="btn btn-primary" onclick="window.wizRetry()">\ud83d\udd04 重试</button>';
      }
    }

    window.wizRetry = function() {
      // 只重做当前这一步（命令输错就重新输入，选择题答错就重新选），不重头再来
      renderStep();
    };

    renderStep();
  }
});

// 8e. INTERACTION: SCENARIO_MATCH
// =========================================================================
